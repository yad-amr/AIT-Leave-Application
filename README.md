# Smart Leave Management System

Student and faculty sign-in, leave applications, and outpasses built with React, Vite, Express, and MongoDB/Mongoose. Leave applications require four sequential approvals; an outpass requires the selected Warden only. Requests and approval history are stored in MongoDB and remain available across server restarts. Students can mark an application normal or urgent.

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

Open http://localhost:5173/login/student or http://localhost:5173/login/faculty. To access the development app from another device on the same network, use the host machine's LAN address, for example `http://192.168.1.20:5173/login/student`. Allow Node.js through the host firewall on private networks if prompted. With the default domain `aitpune.edu.in`, local seed accounts are:

| Role | Email | Password |
| --- | --- | --- |
| Student 1 | `aarav.sharma_240101@aitpune.edu.in` | `CampusLeave123!` |
| Student 2 | `ananya.iyer_240102@aitpune.edu.in` | `CampusLeave123!` |
| Student 3 | `rohan.mehta_240103@aitpune.edu.in` | `CampusLeave123!` |
| Student 4 | `priya.nair_240104@aitpune.edu.in` | `CampusLeave123!` |
| Student 5–10 | `kabir.patel_240105`, `meera.joshi_240106`, `ishaan.kulkarni_240107`, `sana.khan_240108`, `dev.malhotra_240109`, `tara.desai_240110` (append `@aitpune.edu.in`) | `CampusLeave123!` |
| Faculty | `faculty@aitpune.edu.in` | `CampusLeave123!` |
| Warden reviewers | `beauty.das_wardengirlshostel@aitpune.edu.in`, `umesh.kumar.singh_wardenboyshostel@aitpune.edu.in`, `kajal.khatri_wardenboyshostel@aitpune.edu.in`, `mangesh.uttam.amberkar_wardenboyshostel@aitpune.edu.in`, `vikas.d.ambre_wardenboyshostel@aitpune.edu.in` | `CampusLeave123!` |
| Counsellor reviewers | `anjali.desai@aitpune.edu.in`, `arjun.kulkarni@aitpune.edu.in` | `CampusLeave123!` |
| HOD reviewers | `sushma.patil_hodentc@aitpune.edu.in`, `s.r.dhore_hodcomputerengg@aitpune.edu.in`, `sangeeta.jadhav_hodit@aitpune.edu.in`, `u.v.awasarmol_hodmechanicalengg@aitpune.edu.in`, `j.d.patil_hodare@aitpune.edu.in` | `CampusLeave123!` |
| Joint Director | `sudip.khasnavis_jointdirector@aitpune.edu.in` | `CampusLeave123!` |
| Other hostel faculty (not approvers) | `sandip.shivaji.mahadik_rectorboyshostel`, `dhanjee.singh.yadav_supervisorboyshostel`, `r.s.talikoti_supervisorboyshostel`, `amol.tejrao.mogal_supervisorboyshostel` (append `@aitpune.edu.in`) | `CampusLeave123!` |

Change the local demo password with `DEMO_PASSWORD` before seeding. Never use demo credentials in production.

The app connects to persistent MongoDB at `mongodb://localhost:27017/leave_management` by default. Ensure MongoDB is running before starting the app. To use another persistent MongoDB server, set `MONGODB_URI` in `server/.env` to its connection string. The app no longer silently falls back to a temporary database if MongoDB is unavailable. The seeder creates missing demo accounts and preserves their password hashes on later runs, so a user's password change is not reset at restart. Devices on the same network access the same app and database through the host machine's LAN address.

## Configuration

See [server/.env.example](server/.env.example). Configuration loads from `server/.env`.

| Variable | Purpose |
| --- | --- |
| `COLLEGE_DOMAIN` | Allowed email domain; default `aitpune.edu.in`. Students use `name_123456@domain`; faculty use `name@domain` or `name_designation@domain`. |
| `SESSION_SECRET` | Random secret of at least 32 characters used to sign sessions. |
| `SESSION_EXPIRY_SECONDS` | Session lifetime; default 28800 seconds. |
| `DEV_MODE` | Enables local demo account seeding when `true` outside production. |
| `DEMO_PASSWORD` | Optional password for local seeded demo accounts. |
| `MONGODB_URI` | MongoDB connection string; defaults to `mongodb://localhost:27017/leave_management`. |
| `APP_ORIGIN` | Allowed browser origin; default `http://localhost:5173`. |
| `PORT` | API port; default 3001. |
| `NODE_ENV` | Set to `production` behind HTTPS to enable Secure cookies and disable demo account seeding. |

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
- Leave requests and approval history remain stored in MongoDB, including pending requests, until explicitly cancelled or changed through the approval workflow. Outpass approval PDFs are available immediately after Warden approval.
- `GET /api/faculty/approvals` and `POST /api/faculty/approvals/:id/decision` — assigned faculty review and decide requests in sequence.

Leave requests begin at `pending_warden` and proceed Warden → Counsellor → HOD → Joint Director. Outpasses begin at `pending_warden` and become approved after the Warden's decision. Urgent items are sorted to the top of faculty queues. The API derives the student identity from the signed session and checks ownership for reads and PDF downloads. Session revocations and rate limits are in process memory, so use one API process for this prototype. Production hosting needs HTTPS, same-origin routing for `/api`, and SPA fallback for the client.

## Validation

```sh
npm test
npm --prefix client run lint
npm run build
```
