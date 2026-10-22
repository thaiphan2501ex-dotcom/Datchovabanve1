const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT || 5000);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.POSTGRES_USER || 'ticketuser',
  password: process.env.POSTGRES_PASSWORD || 'ticketpass',
  database: process.env.POSTGRES_DB || 'ticket_booking_db',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'ticket-app-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8,
      sameSite: 'lax',
      secure: false,
    },
  })
);

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id BIGSERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20) UNIQUE NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizers (
      organizer_id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(20)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS venues (
      venue_id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      address TEXT NOT NULL,
      total_seats INT NOT NULL DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      event_id SERIAL PRIMARY KEY,
      organizer_id INT NOT NULL REFERENCES organizers(organizer_id),
      venue_id INT NOT NULL REFERENCES venues(venue_id),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      banner_url TEXT,
      status VARCHAR(20) DEFAULT 'DRAFT',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function ensureDefaultOrganizerVenue() {
  let organizer = await pool.query('SELECT organizer_id FROM organizers WHERE email = $1', ['admin@ticketpro.local']);
  if (!organizer.rows[0]) {
    organizer = await pool.query(
      'INSERT INTO organizers (name, email, phone) VALUES ($1, $2, $3) RETURNING organizer_id',
      ['TicketPro Admin', 'admin@ticketpro.local', '+0000000000']
    );
  }

  let venue = await pool.query('SELECT venue_id FROM venues WHERE name = $1', ['Main Venue']);
  if (!venue.rows[0]) {
    venue = await pool.query(
      'INSERT INTO venues (name, address, total_seats) VALUES ($1, $2, $3) RETURNING venue_id',
      ['Main Venue', 'Central City Hall', 200]
    );
  }

  return {
    organizerId: organizer.rows[0].organizer_id,
    venueId: venue.rows[0].venue_id,
  };
}

async function serializeUser(userRow) {
  return {
    userId: userRow.user_id,
    fullName: userRow.full_name,
    email: userRow.email,
    phone: userRow.phone,
    createdAt: userRow.created_at,
  };
}

app.get('/api/v1/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    res.json({
      status: 'ok',
      database: process.env.POSTGRES_DB || 'ticket_booking_db',
      current_time: result.rows[0].current_time,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ error: 'fullName, email, phone and password are required' });
    }

    const lowerEmail = email.trim().toLowerCase();
    const existingUser = await pool.query('SELECT user_id FROM users WHERE email = $1 OR phone = $2', [lowerEmail, phone.trim()]);
    if (existingUser.rows[0]) {
      return res.status(409).json({ error: 'A user with this email or phone already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, full_name, email, phone, created_at`,
      [fullName.trim(), lowerEmail, phone.trim(), passwordHash]
    );

    const user = userResult.rows[0];
    req.session.user = await serializeUser(user);

    res.status(201).json({
      message: 'User registered successfully',
      user: req.session.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userResult = await pool.query(
      'SELECT user_id, full_name, email, phone, password_hash, created_at FROM users WHERE email = $1',
      [String(email).trim().toLowerCase()]
    );

    if (!userResult.rows[0]) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.user = await serializeUser(user);
    res.json({
      message: 'Login successful',
      user: req.session.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/auth/session', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({ user: req.session.user });
});

app.post('/api/v1/auth/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: 'Unable to log out' });
    }

    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/api/v1/events', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, o.name AS organizer_name, v.name AS venue_name
       FROM events e
       INNER JOIN organizers o ON o.organizer_id = e.organizer_id
       INNER JOIN venues v ON v.venue_id = e.venue_id
       ORDER BY e.event_id DESC`
    );

    res.json({ events: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/events/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const result = await pool.query(
      `SELECT e.*, o.name AS organizer_name, v.name AS venue_name
       FROM events e
       INNER JOIN organizers o ON o.organizer_id = e.organizer_id
       INNER JOIN venues v ON v.venue_id = e.venue_id
       WHERE e.event_id = $1`,
      [eventId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ event: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/events', requireAuth, async (req, res) => {
  try {
    const { title, description, status, bannerUrl } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const { organizerId, venueId } = await ensureDefaultOrganizerVenue();
    const result = await pool.query(
      `INSERT INTO events (organizer_id, venue_id, title, description, banner_url, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [organizerId, venueId, title.trim(), description || '', bannerUrl || '', status || 'DRAFT']
    );

    res.status(201).json({
      message: 'Event created successfully',
      event: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/v1/events/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { title, description, status, bannerUrl } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await pool.query(
      `UPDATE events
       SET title = $1,
           description = $2,
           banner_url = $3,
           status = $4
       WHERE event_id = $5
       RETURNING *`,
      [title.trim(), description || '', bannerUrl || '', status || 'DRAFT', eventId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event updated successfully', event: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/v1/events/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const payload = req.body;

    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const allowedFields = ['title', 'description', 'status', 'banner_url'];
    const updates = [];
    const values = [];

    Object.entries(payload).forEach(([key, value], index) => {
      if (!allowedFields.includes(key)) {
        return;
      }

      updates.push(`${key} = $${index + 1}`);
      values.push(key === 'title' ? String(value).trim() : value);
    });

    if (!updates.length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(eventId);
    const query = `UPDATE events SET ${updates.join(', ')} WHERE event_id = $${values.length} RETURNING *`;
    const result = await pool.query(query, values);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event patched successfully', event: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/v1/events/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const result = await pool.query('DELETE FROM events WHERE event_id = $1 RETURNING *', [eventId]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event deleted successfully', event: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  try {
    await ensureSchema();
    await ensureDefaultOrganizerVenue();
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start backend server:', error.message);
    process.exit(1);
  }
}

startServer();

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});