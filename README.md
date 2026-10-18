# Smart Leave Management System

A local leave-management app for students and faculty, built with React, Vite, Express, and MongoDB/Mongoose. Students can submit leave applications or outpasses and track their status. Leave applications pass through four sequential approvals; outpasses require approval from the selected Warden. Students can mark leave applications as normal or urgent.

Requests and approval history are stored in MongoDB and remain available after the app restarts.

## Run on this laptop

### Requirements

- Node.js 22.12 or newer
- npm
- MongoDB installed and running on this laptop

### Install and configure

From the repository root, install dependencies and create the local environment file:

```powershell
npm run setup
Copy-Item server/.env.example server/.env
```

Edit `server/.env` and replace `SESSION_SECRET` with a random value of at least 32 characters. The default database is `mongodb://localhost:27017/leave_management`; `DEV_MODE=true` enables local demo account seeding.

Start the API and frontend together:

```powershell
npm run dev
```

Open the app on this laptop:

- Student sign-in: <http://localhost:5173/login/student>
- Faculty sign-in: <http://localhost:5173/login/faculty>

Leave the terminal and MongoDB running while using the app. If MongoDB is unavailable, the API reports a startup error instead of switching to a temporary database.

The frontend and API bind to the laptop's loopback interface only. The app is not available to other devices on the network or the public internet. It is configured for local use: remote MongoDB connections and non-local frontend origins are rejected. There are no Vercel, Render, GitHub Pages, or public tunnel deployment configurations in this project.

## Local demo accounts

The seeded accounts use the default college domain `aitpune.edu.in` and password `CampusLeave123!`.

| Role | Email |
| --- | --- |
| Student 1 | `aarav.sharma_240101@aitpune.edu.in` |
| Student 2 | `ananya.iyer_240102@aitpune.edu.in` |
| Student 3 | `rohan.mehta_240103@aitpune.edu.in` |
| Student 4 | `priya.nair_240104@aitpune.edu.in` |
| Students 5–10 | `kabir.patel_240105`, `meera.joshi_240106`, `ishaan.kulkarni_240107`, `sana.khan_240108`, `dev.malhotra_240109`, `tara.desai_240110` (append `@aitpune.edu.in`) |
| Faculty | `faculty@aitpune.edu.in` |
| Wardens | `beauty.das_wardengirlshostel@aitpune.edu.in`, `umesh.kumar.singh_wardenboyshostel@aitpune.edu.in`, `kajal.khatri_wardenboyshostel@aitpune.edu.in`, `mangesh.uttam.amberkar_wardenboyshostel@aitpune.edu.in`, `vikas.d.ambre_wardenboyshostel@aitpune.edu.in` |
| Counsellors | `anjali.desai@aitpune.edu.in`, `arjun.kulkarni@aitpune.edu.in` |
| HOD reviewers | `sushma.patil_hodentc@aitpune.edu.in`, `s.r.dhore_hodcomputerengg@aitpune.edu.in`, `sangeeta.jadhav_hodit@aitpune.edu.in`, `u.v.awasarmol_hodmechanicalengg@aitpune.edu.in`, `j.d.patil_hodare@aitpune.edu.in` |
| Joint Director | `sudip.khasnavis_jointdirector@aitpune.edu.in` |

Set `DEMO_PASSWORD` in `server/.env` before the first seed to use a different local demo password. The seeder creates missing accounts and preserves their password hashes on subsequent runs, so a password change is not reset when the app restarts. Demo accounts are for local testing only.

## How approvals work

- Leave applications proceed through Warden → Counsellor → HOD → Joint Director.
- Outpasses are approved or rejected by the selected Warden.
- Urgent leave applications appear first in faculty queues.
- Completed approvals can be downloaded as PDFs. Outpass PDFs are available after Warden approval.
- Students and faculty can change their password from their dashboard.
- The API checks the signed-in user's role and ownership for protected operations.

## Configuration

Configuration is loaded from `server/.env`. See [`server/.env.example`](server/.env.example) for the local template.

| Variable | Purpose |
| --- | --- |
| `COLLEGE_DOMAIN` | Allowed email domain; defaults to `aitpune.edu.in`. Student addresses use `name_123456@domain`; faculty addresses use `name@domain` or `name_designation@domain`. |
| `SESSION_SECRET` | Random secret of at least 32 characters used to sign sessions. |
| `SESSION_EXPIRY_SECONDS` | Maximum session lifetime; defaults to 28800 seconds. |
| `SESSION_IDLE_SECONDS` | Session idle timeout; defaults to 1800 seconds. |
| `DEV_MODE` | Enables local demo account seeding when `true` outside production mode. |
| `DEMO_PASSWORD` | Optional password for locally seeded demo accounts. |
| `MONGODB_URI` | MongoDB connection string. It must point to this laptop, for example `mongodb://localhost:27017/leave_management`. |
| `APP_ORIGIN` | Optional compatibility setting; if present, it must be `http://localhost:5173`. |
| `PORT` | Local API port; defaults to `3001`. The API always binds to `127.0.0.1`. |
| `NODE_ENV` | `production` serves the built frontend locally and disables demo seeding. |

`APP_ORIGINS` and non-strict `COOKIE_SAME_SITE` settings are rejected. Remove old deployment values from `server/.env`. Do not configure a cloud database or a public URL.

Accounts must exist in MongoDB and have a `passwordHash` before they can sign in. Raw passwords are not stored. After changing a password, the user must sign in again with the new password.

## API overview

- `GET /api/auth/config` — returns the allowed college email domain.
- `POST /api/auth/login` — signs in a stored account using `{ email, password, role }`.
- `GET /api/auth/session` — returns the current signed-in user or `401`.
- `POST /api/auth/logout` — revokes the current session and clears the cookie.
- `POST /api/auth/change-password` — verifies the current password, saves a new bcrypt hash, and ends the current session.
- `GET /api/student/dashboard` and `GET /api/faculty/dashboard` — authenticated role-specific dashboards.
- `GET /api/leave-requests/approvers` — returns available Warden, Counsellor, and HOD choices and the configured Joint Director.
- `GET /api/leave-requests` and `POST /api/leave-requests` — list and submit the current student's leave requests.
- `GET /api/leave-requests/:id/pdf` — downloads the approval PDF after its required approvals.
- `GET /api/faculty/approvals` and `POST /api/faculty/approvals/:id/decision` — retrieve and decide assigned faculty approvals.

The browser uses the Vite development proxy to send `/api` requests to the local API. Session revocations and rate limits are held in process memory, so the project runs one local API process.

## Run checks

```powershell
npm test
npm --prefix client run lint
npm run build
```
