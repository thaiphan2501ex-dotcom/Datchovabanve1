# Vé Việt Database Notes

This folder contains the database bootstrap and the default seeded account information used during project setup.

## Default logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@gmail.com | admin123 |
| Customer | customer@gmail.com | customer123 |

## Useful checks

```bash
docker compose ps
docker compose logs db
docker compose logs backend
```

## Quick login test

```bash
curl -i -H 'Content-Type: application/json' \
  -d '{"email":"admin@veviet.local","password":"admin123"}' \
  http://localhost:8081/api/v1/auth/login
```
