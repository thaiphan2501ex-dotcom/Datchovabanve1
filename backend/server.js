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

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
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
      role VARCHAR(20) NOT NULL DEFAULT 'customer',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'customer';
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seat_maps (
      seat_id BIGSERIAL PRIMARY KEY,
      venue_id INT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
      seat_code VARCHAR(20) NOT NULL,
      row_num VARCHAR(10) NOT NULL,
      col_num INT NOT NULL,
      seat_type VARCHAR(20) DEFAULT 'STANDARD',
      UNIQUE (venue_id, seat_code)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_seat_bookings (
      booking_id BIGSERIAL PRIMARY KEY,
      event_id INT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
      seat_code VARCHAR(20) NOT NULL,
      user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'BOOKED',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (event_id, seat_code)
    );
  `);
}

async function ensureDefaultSeatMap(venueId) {
  const existingSeats = await pool.query('SELECT seat_id FROM seat_maps WHERE venue_id = $1', [venueId]);
  if (existingSeats.rows.length > 0) {
    return;
  }

  const rows = ['A', 'B', 'C', 'D', 'E'];
  const seatValues = [];

  for (const row of rows) {
    for (let col = 1; col <= 8; col += 1) {
      seatValues.push([venueId, `${row}${col}`, row, col, col >= 7 ? 'VIP' : 'STANDARD']);
    }
  }

  for (const [venue, code, row, col, type] of seatValues) {
    await pool.query(
      'INSERT INTO seat_maps (venue_id, seat_code, row_num, col_num, seat_type) VALUES ($1, $2, $3, $4, $5)',
      [venue, code, row, col, type]
    );
  }
}

async function ensureDefaultOrganizerVenue() {
  let organizer = await pool.query('SELECT organizer_id FROM organizers WHERE email = $1', ['admin@ticketpro.local']);
  if (!organizer.rows[0]) {
    organizer = await pool.query(
      'INSERT INTO organizers (name, email, phone) VALUES ($1, $2, $3) RETURNING organizer_id',
      ['TicketPro Admin', 'admin@ticketpro.local', '+1000000000']
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

async function ensureSeedData() {
  const adminEmail = 'admin@ticketpro.local';
  const customerEmail = 'customer@ticketpro.local';
  const defaultPasswordHash = '$2b$10$9sxBgehoMFYvHve8b2Axneua.MMaWSFCPUmYp9TMdEuu/GYc9HZkm';
  const customerPasswordHash = '$2b$10$9ATKUzFsVSDOiHBMi/TRce.hDuyvhmprmLQqOUEdS2uSgRdmHC.S.';

  const adminExists = await pool.query('SELECT user_id FROM users WHERE email = $1', [adminEmail]);
  if (!adminExists.rows[0]) {
    await pool.query(
      'INSERT INTO users (email, phone, full_name, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
      [adminEmail, '+1000000000', 'System Admin', defaultPasswordHash, 'admin']
    );
  } else {
    await pool.query(
      'UPDATE users SET role = $1 WHERE email = $2 AND role IS DISTINCT FROM $1',
      ['admin', adminEmail]
    );
  }

  const customerExists = await pool.query('SELECT user_id FROM users WHERE email = $1', [customerEmail]);
  if (!customerExists.rows[0]) {
    await pool.query(
      'INSERT INTO users (email, phone, full_name, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
      [customerEmail, '+1000000001', 'Test Customer', customerPasswordHash, 'customer']
    );
  } else {
    await pool.query(
      'UPDATE users SET role = $1 WHERE email = $2 AND role IS DISTINCT FROM $1',
      ['customer', customerEmail]
    );
  }

  const { organizerId, venueId } = await ensureDefaultOrganizerVenue();
  await ensureDefaultSeatMap(venueId);

  const eventExists = await pool.query('SELECT event_id FROM events WHERE title = $1', ['Spring Music Festival']);
  if (!eventExists.rows[0]) {
    await pool.query(
      `INSERT INTO events (organizer_id, venue_id, title, description, banner_url, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        organizerId,
        venueId,
        'Spring Music Festival',
        'A seeded demo event for the TicketPro dashboard.',
        'https://images.unsplash.com/photo-1501386761578-eac5c94b800a',
        'PUBLISHED',
      ]
    );
  }
}

async function serializeUser(userRow) {
  return {
    userId: userRow.user_id,
    fullName: userRow.full_name,
    email: userRow.email,
    phone: userRow.phone,
    role: userRow.role || 'customer',
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
      `INSERT INTO users (full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, full_name, email, phone, role, created_at`,
      [fullName.trim(), lowerEmail, phone.trim(), passwordHash, 'customer']
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
      'SELECT user_id, full_name, email, phone, password_hash, role, created_at FROM users WHERE email = $1',
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

app.get('/api/v1/venues', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT venue_id, name, address, total_seats FROM venues ORDER BY name ASC'
    );

    res.json({ venues: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/events', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, o.name AS organizer_name, v.name AS venue_name, v.venue_id
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

app.get('/api/v1/events/:eventId/seats', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const eventResult = await pool.query(
      'SELECT venue_id FROM events WHERE event_id = $1',
      [eventId]
    );

    if (!eventResult.rows[0]) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const venueId = eventResult.rows[0].venue_id;
    await ensureDefaultSeatMap(venueId);

    const bookedSeats = await pool.query(
      'SELECT seat_code FROM event_seat_bookings WHERE event_id = $1',
      [eventId]
    );
    const bookedSet = new Set(bookedSeats.rows.map((seat) => seat.seat_code));

    const seatsResult = await pool.query(
      'SELECT seat_id, seat_code, seat_type, row_num, col_num FROM seat_maps WHERE venue_id = $1 ORDER BY row_num, col_num',
      [venueId]
    );

    res.json({
      seats: seatsResult.rows.map((seat) => ({
        ...seat,
        isBooked: bookedSet.has(seat.seat_code),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/seats/order', requireAuth, async (req, res) => {
  try {
    const { eventId, seatCodes } = req.body;

    if (req.session.user.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot book seats as customers' });
    }

    if (!eventId || !Array.isArray(seatCodes) || seatCodes.length === 0) {
      return res.status(400).json({ error: 'eventId and seatCodes are required' });
    }

    const eventResult = await pool.query('SELECT venue_id FROM events WHERE event_id = $1', [eventId]);
    if (!eventResult.rows[0]) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const venueId = eventResult.rows[0].venue_id;
    const normalizedSeatCodes = [...new Set(seatCodes.map((seatCode) => String(seatCode).trim()).filter(Boolean))];

    if (normalizedSeatCodes.length === 0) {
      return res.status(400).json({ error: 'At least one valid seat is required' });
    }

    const seatResults = await Promise.all(
      normalizedSeatCodes.map(async (seatCode) => {
        const seat = await pool.query(
          'SELECT seat_id, seat_code, seat_type FROM seat_maps WHERE venue_id = $1 AND seat_code = $2',
          [venueId, seatCode]
        );
        return seat.rows[0];
      })
    );

    if (seatResults.some((seat) => !seat)) {
      return res.status(400).json({ error: 'One or more selected seats do not exist in this venue' });
    }

    const bookedSeats = await pool.query(
      'SELECT seat_code FROM event_seat_bookings WHERE event_id = $1',
      [eventId]
    );
    const bookedSet = new Set(bookedSeats.rows.map((seat) => seat.seat_code));
    const alreadyBooked = normalizedSeatCodes.filter((seatCode) => bookedSet.has(seatCode));

    if (alreadyBooked.length > 0) {
      return res.status(409).json({ error: `Seat(s) already booked: ${alreadyBooked.join(', ')}` });
    }

    const inserts = normalizedSeatCodes.map((seatCode) => {
      return pool.query(
        'INSERT INTO event_seat_bookings (event_id, seat_code, user_id, status) VALUES ($1, $2, $3, $4)',
        [eventId, seatCode, req.session.user.userId, 'BOOKED']
      );
    });

    await Promise.all(inserts);

    res.json({
      message: 'Seat order created successfully',
      eventId,
      userId: req.session.user.userId,
      seats: seatResults.map((seat) => ({ seatCode: seat.seat_code, seatType: seat.seat_type })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/events', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, status, bannerUrl, venueId } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const { organizerId } = await ensureDefaultOrganizerVenue();
    const targetVenueId = venueId ? Number(venueId) : (await ensureDefaultOrganizerVenue()).venueId;

    const venueCheck = await pool.query('SELECT venue_id FROM venues WHERE venue_id = $1', [targetVenueId]);
    if (!venueCheck.rows[0]) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    const result = await pool.query(
      `INSERT INTO events (organizer_id, venue_id, title, description, banner_url, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [organizerId, targetVenueId, title.trim(), description || '', bannerUrl || '', status || 'DRAFT']
    );

    res.status(201).json({
      message: 'Event created successfully',
      event: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/v1/events/:eventId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { title, description, status, bannerUrl, venueId } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const targetVenueId = venueId ? Number(venueId) : null;
    if (targetVenueId) {
      const venueCheck = await pool.query('SELECT venue_id FROM venues WHERE venue_id = $1', [targetVenueId]);
      if (!venueCheck.rows[0]) {
        return res.status(404).json({ error: 'Venue not found' });
      }
    }

    const result = await pool.query(
      `UPDATE events
       SET title = $1,
           description = $2,
           banner_url = $3,
           status = $4,
           venue_id = COALESCE($5, venue_id)
       WHERE event_id = $6
       RETURNING *`,
      [title.trim(), description || '', bannerUrl || '', status || 'DRAFT', targetVenueId, eventId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event updated successfully', event: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/v1/events/:eventId', requireAuth, requireAdmin, async (req, res) => {
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

app.delete('/api/v1/events/:eventId', requireAuth, requireAdmin, async (req, res) => {
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
    await ensureSeedData();
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