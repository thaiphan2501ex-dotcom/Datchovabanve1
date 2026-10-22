CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organizers (
    organizer_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20)
);

CREATE TABLE venues (
    venue_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    total_seats INT NOT NULL DEFAULT 0
);

-- Sơ đồ ghế vật lý của địa điểm
CREATE TABLE seat_maps (
    seat_id BIGSERIAL PRIMARY KEY,
    venue_id INT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
    seat_code VARCHAR(20) NOT NULL,
    row_num VARCHAR(10) NOT NULL,
    col_num INT NOT NULL,
    seat_type VARCHAR(20) DEFAULT 'STANDARD',
    UNIQUE (venue_id, seat_code)
);

CREATE TABLE events (
    event_id SERIAL PRIMARY KEY,
    organizer_id INT NOT NULL REFERENCES organizers(organizer_id),
    venue_id INT NOT NULL REFERENCES venues(venue_id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    banner_url TEXT,
    status VARCHAR(20) DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE showtimes (
    showtime_id BIGSERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(event_id),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'UPCOMING'
);
CREATE INDEX idx_showtimes_event ON showtimes(event_id, start_time);

CREATE TABLE ticket_types (
    ticket_type_id SERIAL PRIMARY KEY,
    showtime_id BIGINT NOT NULL REFERENCES showtimes(showtime_id),
    name VARCHAR(50) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    total_quantity INT NOT NULL,
    available_quantity INT NOT NULL,
    CONSTRAINT chk_qty CHECK (available_quantity >= 0)
);

CREATE TABLE bookings (
    booking_id BIGSERIAL PRIMARY KEY,
    booking_code VARCHAR(32) UNIQUE NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    showtime_id BIGINT NOT NULL REFERENCES showtimes(showtime_id),
    total_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_bookings_user ON bookings(user_id);

CREATE TABLE tickets (
    ticket_id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(booking_id),
    showtime_id BIGINT NOT NULL REFERENCES showtimes(showtime_id),
    seat_id BIGINT REFERENCES seat_maps(seat_id),
    ticket_type_id INT NOT NULL REFERENCES ticket_types(ticket_type_id),
    ticket_code VARCHAR(64) UNIQUE NOT NULL,
    qr_code_hash VARCHAR(255) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'RESERVED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (showtime_id, seat_id)
);

INSERT INTO users (email, phone, full_name, password_hash)
SELECT 'admin@gmail.com', '+1000000000', 'Admin', '$2b$10$9sxBgehoMFYvHve8b2Axneua.MMaWSFCPUmYp9TMdEuu/GYc9HZkm'
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'admin@gmail.com'
);

INSERT INTO users (email, phone, full_name, password_hash)
SELECT 'customer@gmail.com', '+1000000001', 'Khách test', '$2b$10$9ATKUzFsVSDOiHBMi/TRce.hDuyvhmprmLQqOUEdS2uSgRdmHC.S.'
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'customer@gmail.com'
);

INSERT INTO organizers (name, email, phone)
SELECT 'TicketPro Admin', 'admin@gmail.com', '+1000000000'
WHERE NOT EXISTS (
    SELECT 1 FROM organizers WHERE email = 'admin@gmail.com'
);

INSERT INTO venues (name, address, total_seats)
SELECT 'Main Venue', 'Central City Hall', 200
WHERE NOT EXISTS (
    SELECT 1 FROM venues WHERE name = 'Main Venue'
);

INSERT INTO events (organizer_id, venue_id, title, description, banner_url, status)
SELECT o.organizer_id, v.venue_id, 'Spring Music Festival', 'A seeded demo event for the TicketPro dashboard.', 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a', 'PUBLISHED'
FROM organizers o
JOIN venues v ON v.name = 'Main Venue'
WHERE o.email = 'admin@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM events WHERE title = 'Spring Music Festival'
);
