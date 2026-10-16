# Smart Leave Management System

Student and faculty email-OTP login for hostel leave and academic outpasses. Built on the existing React 19 + Vite + React Router client, plain CSS with system light/dark themes, and CommonJS Express backend. MongoDB/Mongoose stores users; Nodemailer delivers codes; JWT sessions use HTTP-only, SameSite=Strict cookies (Secure in production).

## Local setup

Requires Node.js 22.12+ and npm. From the repository root:

```sh
npm run setup
cp server/.env.example server/.env
```

Set `SESSION_SECRET` in `server/.env` to a random value of at least 32 characters (for example generate one with `openssl rand -hex 32`). The example uses `DEV_MODE=true`. Start both services with one command:

```sh
npm run dev
```

Open http://localhost:5173/login/student or /login/faculty. With the demo domain `ait.edu`, use `student@ait.edu` or `faculty@ait.edu`. Copy the six-digit code from the **server terminal**. Only explicit local `DEV_MODE=true` permits console codes; production never prints them. This exception is solely for development without SMTP.

Without `MONGODB_URI`, local dev starts an ephemeral MongoDB and seeds sample student, faculty, and warden users. The first run may download a MongoDB binary and requires network access and a supported OS. The data disappears on restart. For persistent users, set `MONGODB_URI` and run `npm --prefix server run seed`. Dev startup also seeds missing demo users without overwriting existing records. Wardens exist in the model but have no login page in this scope.

## Configuration

See [server/.env.example](server/.env.example). Configuration is loaded from `server/.env` when using the documented commands.

| Variable | Purpose |
| --- | --- |
| `COLLEGE_DOMAIN` | Exact allowed email domain; demo default `ait.edu`, replace with the actual Outlook/Microsoft 365 college domain. Subdomains are not implicitly accepted. |
| `SESSION_SECRET` | Required random secret, at least 32 characters; signs sessions and keys OTP hashes. |
| `OTP_EXPIRY_SECONDS` | OTP validity, default 300 seconds. |
| `SESSION_EXPIRY_SECONDS` | Session validity, default 28800 seconds. |
| `DEV_MODE` | Explicit `true` enables console email and ephemeral database locally. Ignored for these purposes in production. |
| `MONGODB_URI` | MongoDB connection string, required outside local development. |
| `APP_ORIGIN` | Allowed browser origin, default `http://localhost:5173`. |
| `PORT` | API port, default 3001; adjust Vite proxy if changed. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | SMTP host, port (587 by default), and whether to use TLS from connection start (typically true for 465). STARTTLS is used when offered on 587. |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | SMTP credentials and sender. Required according to your mail provider. |
| `NODE_ENV` | Use `production` behind HTTPS to enable Secure cookies and prohibit development email/database fallbacks. |

Unknown emails are **not auto-provisioned**. A stored user must match both email and selected role. Domain membership and email ownership are checked; this is email OTP authentication, not Microsoft OAuth. All valid-domain addresses receive the same OTP mail and challenge response to avoid disclosing registration before email ownership is proved. Administrative enrollment of real users is outside scope.

## API and security behavior

- `GET /api/auth/config`: public college domain.
- `POST /api/auth/request-otp`: `{ email, role }`.
- `POST /api/auth/verify-otp`: `{ email, role, otp }`; issues the session cookie.
- `GET /api/auth/session`: current user, or 401 when expired.
- `POST /api/auth/logout`: clears and revokes the current session.
- `GET /api/student/dashboard`, `/api/faculty/dashboard`: authenticated role-specific placeholders.

Codes use cryptographic randomness and keyed SHA-256 hashes with constant-time comparison. They expire after five minutes by default and are consumed before account lookup. Requests enforce a 30-second cooldown, five requests per email and twenty per IP per fifteen minutes. Verification allows five attempts per email per OTP validity window and sixty per IP per fifteen minutes. Resending cannot reset the email verification budget. Expired entries are pruned every minute. No raw OTP is persisted or returned by the API.

Challenges, rate limits, and session revocations are in process memory for this hackathon implementation: restart signs everyone out and clears limits. Run one API process; shared persistent storage is needed before scaling to multiple instances. The API binds to loopback. Production hosting must provide HTTPS and same-origin routing for `/api`, and serve the client build with SPA fallback. Do not enable an untrusted proxy configuration to override client IPs.

## Validation

```sh
npm test
npm --prefix client run lint
npm run build
```

Tests cover domain validation, OTP expiry, five-attempt lock and recovery, resend protection, single-use codes, email/IP request limits, student/faculty API protection, unknown users, logout revocation, expiry redirects, frontend role guards, and six-digit paste with auto-submit. Real SMTP delivery requires your provider credentials and was not exercised by these tests.
