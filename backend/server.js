const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    host: process.env.DB_HOST || 'db',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.POSTGRES_USER || 'ticketuser',
    password: process.env.POSTGRES_PASSWORD || 'ticketpass',
    database: process.env.POSTGRES_DB || 'ticket_booking_db',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

app.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() AS current_time');
        res.json({
            status: 'ok',
            database: process.env.POSTGRES_DB || 'ticket_booking_db',
            current_time: result.rows[0].current_time
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/v1/events', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM events ORDER BY event_id ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Backend Server đang chạy ở cổng ${PORT}`);
});

process.on('SIGINT', async () => {
    await pool.end();
    process.exit(0);
});