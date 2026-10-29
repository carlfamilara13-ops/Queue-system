# Appointment and Queue Management System

A web application for booking service appointments and running the service queue at ICCT Colleges, Cainta Main Campus. Built with the MERN stack (MongoDB, Express, React, Node.js), Socket.IO for live updates, and email one-time codes (Gmail) for verification.

The student interface follows the observed ePila workflow and colour palette. The ePila and ICCT logos in `client/public` were supplied by the project owner; confirm you have permission from the institution before public deployment.

## Roles

| Role | Access |
| --- | --- |
| Student | Find a service, book a slot, verify by email code, prepare the requirements checklist, check in with a QR code, cancel, reschedule when staff allow it |
| Staff | Live queue, QR scanning, walk-ins, schedule and closures, requirements checklist editor, records. Limited to the assigned window |
| Administrator | Everything staff can do for any window, plus departments, windows, services, staff accounts, holidays and the audit log |

## Requirements checklist

Each requirement can be text, an image, or both. Students tick items as they prepare them. At the window, staff open the student's checklist and verify each item. The checklist shown at booking time is stored with the appointment, so later edits do not change past records. Images are limited to JPG, PNG or WebP, are verified by file signature on the server, and are resized in the browser before upload.

## Time-in and time-out logging

Staff scan the student's QR code in Check-in mode when the student arrives and in Check-out mode after service. The server validates the appointment, date, window and current status, and records every timestamp itself (the browser never supplies a time). A duplicate check-in is handled idempotently, and an invalid or repeated check-out is rejected with a clear message, so no duplicate completion is created. Each record stores the check-in, call, service-start and check-out times, the method, and which staff member performed each step. Records can be downloaded as an Excel time log (columns: Time in, Time out, Name, Student number, Course, Purpose, Date; one row per visit that has a recorded check-in; date range selectable) and completed, missed, cancelled or expired records can be deleted from the Records page. Scanning needs the staff device to be online.

## Courses

New students choose their course when they register, and students without one are asked once after signing in. Administrators manage the course list under Organization. Until a list is configured, students type their course. No official course list is bundled because it has not been provided. Walk-ins can be logged with an optional student number and course. There is no signature column: the verified QR scan, the recorded staff member and the audit log replace the paper signature.

## Queue rules

- Order: appointment slot first, then check-in time within the slot. Walk-ins are served after booked students.
- A called student has 5 minutes. The timeout is enforced on the server.
- A missed student cannot jump back. Staff approval places them at the end of the queue.
- Slot capacity is enforced atomically, so two simultaneous bookings cannot oversell a slot.
- One active appointment per student.

## Local development

Requirements: Node.js 20 or newer, MongoDB (local or Atlas).

```
cd server
cp .env.example .env        # then edit .env
npm install
npm run seed                # demo data, development only
npm start
```
In a second terminal:
```
cd client
npm install
npm run dev                 # http://localhost:5173
```
With no Gmail credentials and `DEV_LOG_OTP=true`, verification codes are printed in the server console.

## Configuration

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Random string, at least 32 characters in production |
| `CLIENT_URL` | Public URL of the app, used for CORS and origin checks |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Gmail account and App Password for sending codes (2-Step Verification must be on) |
| `UPLOAD_DIR` | Where requirement images are stored. Use a persistent volume |
| `TRUST_PROXY` | Set to `true` behind a reverse proxy or platform load balancer |
| `HTTPS` | Set to `true` when served over HTTPS |

In production the server refuses to start if the secret is weak, Gmail is not configured, or `DEV_LOG_OTP` is enabled.

## Production deployment

The server serves the built client, so a single service is enough.

```
cp .env.production.example .env.production   # edit values
docker compose up -d --build
docker compose exec app node create-admin.js you@example.com "Your Name"
```
Put the app behind HTTPS (for example Caddy, Nginx, or a platform such as Render or Railway) and set `CLIENT_URL` to the public address. Health endpoints: `/healthz` (liveness) and `/readyz` (database ready).

Never run `npm run seed` in production. It wipes data and refuses to run when `NODE_ENV=production`.

## Security measures

Role checks on every protected route, staff locked to their window on the server, httpOnly cookie sessions with server-side revocation on sign out, hashed one-time codes with expiry and attempt limits, rate limiting, strict origin check on state-changing requests, Helmet security headers with a content security policy, input whitelisting on all administrator endpoints, and an audit log of every state-changing action (kept 400 days).

## Known limitations and open decisions

- Email verification proves control of an inbox, not enrollment. Eligibility rules are not enforced.
- Camera QR scanning requires HTTPS (or localhost) and has not been tested on a range of devices.
- No automated test suite is included yet. The server and client build is checked in CI.
- Open policy decisions: check-in window per slot (currently any time on the appointment date), cancellation deadlines, whether students may hold multiple appointments, and the official service and requirement lists. The seeded services and requirements are demo data.
- Uploaded images are kept after a requirement is removed, because past appointments reference them.
