# Smart Leave Management System

Student and faculty sign-in, leave applications, and outpasses built with React, Vite, Express, and MongoDB/Mongoose. Leave applications require four sequential approvals; an outpass requires the selected Warden only. Pending requests expire and are removed after five days. Students can mark an application normal or urgent.

## Local setup

Requires Node.js 22.12+ and npm. From the repository root:

```sh
npm run setup
Copy-Item server/.env.example server/.env
```

Set `SESSION_SECRET` in `server/.env` to a random value with at least 32 characters. `DEV_MODE=true` enables the local demo setup. Start both services with:

```sh
npm run dev
```

Open http://localhost:5173/login/student or http://localhost:5173/login/faculty. With the default domain `aitpune.edu.in`, local seed accounts are:

| Role | Email | Password |
| --- | --- | --- |
| Student 1 | `aarav.sharma_240101@aitpune.edu.in` | `CampusLeave123!` |
| Student 2 | `ananya.iyer_240102@aitpune.edu.in` | `CampusLeave123!` |
| Student 3 | `rohan.mehta_240103@aitpune.edu.in` | `CampusLeave123!` |
| Student 4 | `priya.nair_240104@aitpune.edu.in` | `CampusLeave123!` |
| Student 5–10 | `kabir.patel_240105`, `meera.joshi_240106`, `ishaan.kulkarni_240107`, `sana.khan_240108`, `dev.malhotra_240109`, `tara.desai_240110` (append `@aitpune.edu.in`) | `CampusLeave123!` |
| Faculty | `faculty@aitpune.edu.in` | `CampusLeave123!` |
| Warden reviewers | `nisha.rao@aitpune.edu.in`, `rahul.shah@aitpune.edu.in` | `CampusLeave123!` |
| Counsellor reviewers | `anjali.desai@aitpune.edu.in`, `arjun.kulkarni@aitpune.edu.in` | `CampusLeave123!` |
| HOD reviewers | `sneha.patil@aitpune.edu.in`, `vikram.menon@aitpune.edu.in` | `CampusLeave123!` |
| Joint Director | `vivek.desai@aitpune.edu.in` | `CampusLeave123!` |

Change the local demo password with `DEMO_PASSWORD` before seeding. Never use demo credentials in production.

In local dev, leaving `MONGODB_URI` blank starts a temporary MongoDB instance and seeds demo student and faculty accounts. It may download a MongoDB binary the first time and needs network access. Data in this temporary database disappears on restart. To persist data, set `MONGODB_URI` to your MongoDB connection string. The seeder creates missing demo accounts and preserves their password hashes on later runs, so a user's password change is not reset at restart.

## Configuration

See [server/.env.example](server/.env.example). Configuration loads from `server/.env`.

| Variable | Purpose |
| --- | --- |
| `COLLEGE_DOMAIN` | Allowed email domain; default `aitpune.edu.in`. Students use `name_123456@domain`; faculty use `name@domain`. |
| `SESSION_SECRET` | Random secret of at least 32 characters used to sign sessions. |
| `SESSION_EXPIRY_SECONDS` | Session lifetime; default 28800 seconds. |
| `DEV_MODE` | Enables demo seeding and local temporary MongoDB when `true` outside production. |
| `DEMO_PASSWORD` | Optional password for local seeded demo accounts. |
| `MONGODB_URI` | MongoDB connection string; required outside local dev mode. |
| `APP_ORIGIN` | Allowed browser origin; default `http://localhost:5173`. |
| `PORT` | API port; default 3001. |
| `NODE_ENV` | Set to `production` behind HTTPS to enable Secure cookies and disable development fallbacks. |

Accounts must already exist in MongoDB and have a `passwordHash`. The login API does not create accounts. Existing database accounts without a password hash need to have one provisioned before they can sign in. Raw passwords are never stored. Signed-in students and faculty can use **Change password** on their dashboard; after a successful change they must sign in again using the new password.

## API

- `GET /api/auth/config` — returns the allowed college email domain.
- `POST /api/auth/login` — accepts `{ email, password, role }` and sets the session cookie for a stored account with a valid password hash.
- `GET /api/auth/session` — returns the current signed-in user or 401.
- `POST /api/auth/logout` — revokes the current session and clears the cookie.
- `POST /api/auth/change-password` — verifies the current password, stores a new bcrypt hash, and ends the current session.
- `GET /api/student/dashboard` and `GET /api/faculty/dashboard` — authenticated role-specific endpoints.
- `GET /api/leave-requests/approvers` — returns available warden, counsellor, and HOD choices plus the single configured Joint Director.
- `GET /api/leave-requests` — lists the current student's requests.
- `POST /api/leave-requests` — submits a student leave request.
- `GET /api/leave-requests/:id/pdf` — downloads the approval PDF after the relevant approval path completes, including reviewer names and IST timestamps.
- Pending requests are removed after five days if the required approvals are not complete. Outpass approval PDFs are available immediately after Warden approval.
- `GET /api/faculty/approvals` and `POST /api/faculty/approvals/:id/decision` — assigned faculty review and decide requests in sequence.

Leave requests begin at `pending_warden` and proceed Warden → Counsellor → HOD → Joint Director. Outpasses begin at `pending_warden` and become approved after the Warden's decision. Urgent items are sorted to the top of faculty queues. The API derives the student identity from the signed session and checks ownership for reads and PDF downloads. Session revocations and rate limits are in process memory, so use one API process for this prototype. Production hosting needs HTTPS, same-origin routing for `/api`, and SPA fallback for the client.

## Validation

```sh
npm test
npm --prefix client run lint
npm run build
```
