const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Cấu hình kết nối Database
const pool = mysql.createPool({
    host: 'db',
    user: 'root',
    password: 'rootpassword',
    database: 'ticket_booking_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// =====================================================================
// DANH SÁCH REST API CỦA HỆ THỐNG
// =====================================================================

// API 1: Lấy danh sách sự kiện (Dành cho Trang chủ)
app.get('/api/v1/events', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM events ORDER BY id ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API 2: Tạo sự kiện và tự động sinh 50 ghế (Dành cho Admin)
app.post('/api/v1/events', async (req, res) => {
    const { title, description, location, start_time, end_time } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [eventResult] = await connection.query(
            'INSERT INTO events (title, description, location, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, "UPCOMING")',
            [title, description, location, start_time, end_time]
        );
        const newEventId = eventResult.insertId;

        const rows = ['A', 'B', 'C', 'D', 'E'];
        const columns = 10;
        const seatValues = [];

        for (let r of rows) {
            for (let c = 1; c <= columns; c++) {
                const seatNumber = `${r}${c}`;
                const tier = (r === 'A' || r === 'B') ? 'VIP' : 'STANDARD';
                const price = (tier === 'VIP') ? 1000000.00 : 500000.00;
                seatValues.push([newEventId, seatNumber, tier, price, 'AVAILABLE']);
            }
        }

        await connection.query(
            'INSERT INTO seats (event_id, seat_number, tier, price, status) VALUES ?',
            [seatValues]
        );

        await connection.commit();
        res.status(201).json({ message: 'Đã tạo sự kiện và sinh tự động 50 ghế thành công!' });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// API 3: Lấy danh sách ghế của 1 sự kiện (Dành cho Sơ đồ ghế)
app.get('/api/v1/events/:id/seats', async (req, res) => {
    try {
        const [seats] = await pool.query('SELECT * FROM seats WHERE event_id = ? ORDER BY id ASC', [req.params.id]);
        res.status(200).json(seats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API 4: Đặt vé chống trùng ghế với Row Locking (Transaction)
app.post('/api/v1/bookings', async (req, res) => {
    const { user_id, event_id, seat_number } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [seats] = await connection.query(
            'SELECT id, status, price FROM seats WHERE event_id = ? AND seat_number = ? FOR UPDATE',
            [event_id, seat_number]
        );

        if (seats.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Ghế không tồn tại.' });
        }

        const targetSeat = seats[0];

        if (targetSeat.status !== 'AVAILABLE') {
            await connection.rollback();
            return res.status(409).json({ error: 'Ghế đã bị người khác đặt.' });
        }

        await connection.query(
            'UPDATE seats SET status = "RESERVED", reserved_until = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?',
            [targetSeat.id]
        );

        const [bookingResult] = await connection.query(
            'INSERT INTO bookings (user_id, event_id, total_amount, status) VALUES (?, ?, ?, "PENDING")',
            [user_id, event_id, targetSeat.price]
        );

        await connection.commit();
        res.status(201).json({ 
            message: `Đã giữ chỗ ghế ${seat_number} thành công!`,
            booking_id: bookingResult.insertId
        });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// =====================================================================
// HỆ THỐNG TỰ ĐỘNG DỌN DẸP GHẾ QUÁ HẠN (CRON JOB BẰNG SETINTERVAL)
// =====================================================================
setInterval(async () => {
    try {
        const [result] = await pool.query(`
            UPDATE seats 
            SET status = 'AVAILABLE', reserved_until = NULL 
            WHERE status = 'RESERVED' AND reserved_until <= NOW()
        `);
        if (result.affectedRows > 0) {
            console.log(`[CRON JOB] 🧹 Đã tự động nhả ${result.affectedRows} ghế quá hạn về trạng thái AVAILABLE.`);
        }
    } catch (error) {
        console.error('[CRON JOB] ❌ Lỗi:', error.message);
    }
}, 60000);

// =====================================================================
// KHỞI ĐỘNG SERVER
// =====================================================================
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Backend Server đang chạy ở cổng ${PORT}`);
});