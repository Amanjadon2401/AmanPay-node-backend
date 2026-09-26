# AmanPay Node.js Backend

Educational UPI-like payment simulator. **It uses fake money. It is NOT connected to UPI, NPCI, banks, or real payment rails.**

## Architecture

React/website
    |
Node.js + Express
    |
+---+---------+----------------+
|             |                |
PostgreSQL   Redis           Kafka
|             |                |
Wallets      locks/          events
Payments     cache           notifications

The payment flow uses:
- PostgreSQL transaction
- row-level wallet locks
- integer paise instead of floating-point money
- idempotency key
- transactional outbox
- Kafka event
- JWT authentication

## Requirements

- Node.js 20+
- Docker Desktop

## Run

1. Copy env:
   `copy .env.example .env` on Windows
   or
   `cp .env.example .env`

2. Start infrastructure:
   `docker compose up -d`

3. Install:
   `npm install`

4. Start API:
   `npm run dev`

5. In another terminal start Kafka consumer:
   `npm run consumer`

API:
http://localhost:4000

Health:
GET /health

## Example

Register first user:

POST /api/auth/register

{
  "name": "Aman",
  "email": "aman@example.com",
  "password": "password123"
}

Every new user starts with **₹10,000 fake money**.

The generated UPI ID is:

`aman_example_upi?`

Actually the implementation derives it as:
`aman_example_upi` based on the email local/domain replacement. For example:
`aman@example.com` -> `aman_example.com@amanpay`

Login:

POST /api/auth/login

Then:

GET /api/wallet
Authorization: Bearer <token>

Payment:

POST /api/payments
Authorization: Bearer <token>
Idempotency-Key: 4f8c1c9e-12345678

{
  "receiverUpiId": "rajat_example.com@amanpay",
  "amountRupees": 500
}

Repeat the exact request with the same Idempotency-Key:
it returns the original transaction instead of transferring twice.

## Important production notes

This project intentionally does NOT implement:
- real UPI integration
- real bank accounts
- UPI PIN handling
- KYC
- PCI/payment certification
- fraud/risk systems
- production secrets management
- HA Kafka/Postgres
- distributed tracing

Those require additional regulatory, security and infrastructure work.
