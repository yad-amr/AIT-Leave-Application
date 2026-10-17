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

### Temporary public access from your Windows laptop

For a short trial without moving MongoDB to the cloud, keep MongoDB on your laptop and expose only the app through a temporary Cloudflare Tunnel. From the repository root, run:

```powershell
.\scripts\start-laptop-host.ps1
```

The script downloads Cloudflare's Windows tunnel client if needed, verifies its Windows signature, creates a temporary HTTPS URL, and starts the production-built app against the laptop's local MongoDB. Demo seeding is disabled, and accounts created by the local demo seeder are blocked from signing in through the public tunnel. Share the temporary URL only with intended users. The URL changes when restarted; your laptop, MongoDB, internet connection, and the script window must remain available. Do not expose port 27017 or enable MongoDB network binding to the internet. This temporary tunnel has no production availability guarantee.

## Public deployment

To let students and faculty use the same live requests from any network, deploy one copy of the API and connect it to one shared, managed MongoDB database (for example, MongoDB Atlas). Do not use `localhost` for the production database: `localhost` on a hosted service or another computer points to that machine, not to your computer. The frontend can be served by the backend, Vercel with a same-origin API proxy, or GitHub Pages with a cross-origin API connection.

For a Node.js web service (for example, Render or Railway), configure the repository root as the service root and use:

```text
Build command: npm run setup && npm run build
Start command: npm start
```

### Deploying the frontend on Vercel

Vercel hosts the Vite frontend and proxies `/api/*` requests to the Express backend. Deploy the backend separately as a long-running Node.js web service using the commands above. In Vercel, import this repository and set **Root Directory** to `client`, **Framework Preset** to `Vite`, **Build Command** to `npm run build`, and **Output Directory** to `dist`. Set the Vercel project's Node.js version to 22 or newer.

In Vercel's project environment variables, add `API_ORIGIN` with the backend's HTTPS origin only, for example `https://leave-api.example.com` (no path or trailing slash). Add it for Production and any Preview environments you intend to use. Set the backend's `APP_ORIGIN` to the exact Vercel origin used by the frontend, and set its other production variables as described above. If you add a custom domain or use Vercel preview deployments, update `APP_ORIGIN` to match that exact origin; the backend rejects write requests from other origins.

The Vercel API proxy keeps browser requests and the secure session cookie on the frontend's origin. It returns an explicit error if `API_ORIGIN` is missing or invalid, or if the backend cannot be reached.

### Deploying the frontend on GitHub Pages

The `Deploy GitHub Pages` workflow builds and publishes the frontend from `main` at `https://yad-amr.github.io/AIT-Leave-Application/`, using the Render API origin configured in the workflow. In the GitHub repository, open **Settings → Pages** and choose **GitHub Actions** as the build and deployment source. Subsequent pushes to `main` deploy the frontend automatically.

For the Render backend, set `APP_ORIGIN=https://yad-amr.github.io` and `COOKIE_SAME_SITE=none`, then redeploy it. The API sends credentialed CORS responses only to the configured `APP_ORIGIN`. The Pages build uses `VITE_API_ORIGIN` to call the Render API directly; change the value in `.github/workflows/deploy-pages.yml` if the backend URL changes.

**Browser compatibility warning:** GitHub Pages (`github.io`) and Render (`onrender.com`) are different sites. The login session cookie must be sent as a third-party cookie; browsers or privacy settings that block third-party cookies can prevent sign-in from working. A custom domain shared by the frontend and API (for example, `leave.example.edu` and `api.example.edu`) is recommended for reliable cookie behavior. GitHub Pages cannot proxy API requests.

Set these environment variables in the hosting provider's private service settings:

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DEV_MODE` | `false` |
| `MONGODB_URI` | The connection string for the shared hosted MongoDB database |
| `SESSION_SECRET` | A unique random secret of at least 32 characters |
| `APP_ORIGIN` | The app's public HTTPS origin, e.g. `https://leave.example.edu` (no path or trailing slash) |
| `COLLEGE_DOMAIN` | The college email domain used for sign-in |

The host must pass its assigned port through `PORT` and allow outbound database connections. Configure the MongoDB provider's network access to allow connections from the app host, and create/provision real student and faculty accounts in that shared database before opening the site. Demo account seeding is disabled in production. Never put database credentials or production secrets in source control or a public chat.

Run exactly one server instance: login revocations and rate limits are currently kept in process memory, so additional instances would not share them. Students and faculty on different computers must visit the same hosted HTTPS URL; requests then read and write the same MongoDB database. The dashboard refreshes leave requests every 15 seconds.

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
| `COOKIE_SAME_SITE` | Session cookie SameSite setting; defaults to `strict`. Use `none` only for HTTPS cross-site frontend/API deployments. |
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
