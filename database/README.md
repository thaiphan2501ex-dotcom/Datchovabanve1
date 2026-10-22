# TicketPro Database Notes

This folder contains the database bootstrap and the default seeded account information used during project setup.

## Default logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@ticketpro.local | admin123 |
| Customer | customer@ticketpro.local | customer123 |

## Seed details

- The admin account is used for dashboard management and event administration.
- The customer account is the test buyer account for login and seat selection flows.
- These credentials are seeded automatically when the database starts empty.

## Database initialization

The initialization script is located at:

- `./init.sql`

This script creates the base schema and inserts the demo records when the database is first created.

## Useful checks

```bash
docker compose ps
docker compose logs db
docker compose logs backend
```

## Quick login test

```bash
curl -i -H 'Content-Type: application/json' \
  -d '{"email":"admin@ticketpro.local","password":"admin123"}' \
  http://localhost:8081/api/v1/auth/login
```
