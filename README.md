# Smart Leave Management System

Student and faculty email-OTP login for hostel leave and academic outpasses. Built on the existing React 19 + Vite + React Router client, plain CSS with system light/dark themes, and CommonJS Express backend. MongoDB/Mongoose stores users; Nodemailer delivers codes; JWT sessions use HTTP-only, SameSite=Strict cookies (Secure when APP_ORIGIN uses HTTPS).

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

Open http://localhost:5173/login/student or /login/faculty. With the demo domain `aitpune.edu.in`, use `student_123456@aitpune.edu.in` or `faculty@aitpune.edu.in`. Copy the six-digit code from the **server terminal**. Only explicit local `DEV_MODE=true` permits console codes; production never prints them. This exception is solely for development without SMTP.

Without `MONGODB_URI`, local dev starts an ephemeral MongoDB and seeds sample student, faculty, and warden users. The first run may download a MongoDB binary and requires network access and a supported OS. The data disappears on restart. For persistent users, set `MONGODB_URI` and run `npm --prefix server run seed`. Dev startup also seeds missing demo users without overwriting existing records. Wardens exist in the model but have no login page in this scope.

## Configuration

See [server/.env.example](server/.env.example). Configuration is loaded from `server/.env` when using the documented commands.

| Variable | Purpose |
| --- | --- |
| `COLLEGE_DOMAIN` | Exact allowed email domain; default `aitpune.edu.in`. Students use `name_123456@aitpune.edu.in` (exactly six registration digits); faculty use `name@aitpune.edu.in`. Subdomains are not implicitly accepted. |
| `SESSION_SECRET` | Required random secret, at least 32 characters; signs sessions and keys OTP hashes. |
| `OTP_EXPIRY_SECONDS` | OTP validity, default 300 seconds. |
| `SESSION_EXPIRY_SECONDS` | Absolute session validity, default 28800 seconds (8 hours). |
| `SESSION_IDLE_SECONDS` | Idle validity, default 1800 seconds (30 minutes); explicit user activity refreshes it. |
| `DEV_MODE` | Explicit `true` enables console email and ephemeral database locally. Ignored for these purposes in production. |
| `MONGODB_URI` | MongoDB connection string, required outside local development. |
| `APP_ORIGIN` | Allowed browser origin, default `http://localhost:5173`. |
| `PORT` | API port, default 3001; adjust Vite proxy if changed. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | SMTP host, port (587 by default), and whether to use TLS from connection start (typically true for 465). STARTTLS is used when offered on 587. |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | SMTP credentials and sender. Required according to your mail provider. |
| `NODE_ENV` | Use `production` behind HTTPS with an HTTPS `APP_ORIGIN` for Secure cookies and prohibit development email/database fallbacks. |

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

## Student leave and outpass portal

After student OTP sign-in, `/student/dashboard` displays the responsive home page. Navigation includes applications, outpass, and profile. Leave and outpass forms submit to the existing same-origin API. Application details show signatures, comments, rejection reasons, and the audit trail. Active urgent requests appear on the home page; lists put urgent requests first.

Start the configured project with **`npm run dev`**. Initial installation remains `npm run setup`; retain your existing `server/.env`. Development automatically seeds the following accounts at `COLLEGE_DOMAIN` (default `aitpune.edu.in`):

| Account | Sign-in page | Approval role |
| --- | --- | --- |
| `student_123456@aitpune.edu.in` | `/login/student` | Student |
| `class.teacher@aitpune.edu.in` | `/login/faculty` | Class Teacher / Counselor |
| `hod@aitpune.edu.in` | `/login/faculty` | HOD |
| `warden@aitpune.edu.in` | `/login/faculty` | Warden |
| `director@aitpune.edu.in` | `/login/faculty` | Director |

Each uses email OTP, with codes in the server terminal only when local `DEV_MODE=true`. Existing faculty accounts remain available. Approver dashboards remain outside scope. To demo approvals, sign in as the appropriate approver in a separate browser profile, then use its browser console on the app origin:

```js
await fetch('/api/applications/APPLICATION_ID/approvals', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ decision: 'APPROVED', signature_data: 'Demo Signer', comment: 'Reviewed' })
}).then(r => r.json())
```

Replace `APPLICATION_ID` with the ID from the student's details URL. Sign as Class Teacher, HOD, Warden, then Director for leave; only Warden for outpass. Use `decision: 'REJECTED'` and a required rejection comment to stop the chain. Refresh student details to see updates. Home and list data refresh every 15 seconds; application details refresh on page reload. Session state is checked once on app load and cached across navigation. Live push updates are not implemented.

New endpoints (all prefixed `/api`):

- `GET /home/summary`: own status counts, active urgent items, and recent applications.
- `GET /leave-types`: active configurable choices, stored in the `leavetypes` collection.
- `POST /applications/leave`: JSON or multipart fields `leave_type`, `from_date`, `to_date`, `reason`, `is_urgent`; optional multipart `proof`.
- `POST /applications/outpass`: JSON fields `out_at`, `return_at`, `destination`, `contact`, `reason`, `is_urgent`.
- `GET /applications?type=LEAVE&status=SUBMITTED&urgent=true`: own applications with optional filters.
- `GET /applications/:id`: own detail and history.
- `GET /applications/:id/proof`: authenticated owner-only download.
- `POST /applications/:id/cancel`: only before any approval.
- `POST /applications/:id/approvals`: current approver role only, with decision, typed signature, and comment.

Architecture additions follow the existing stack: `server/Application.js` defines Mongoose application and leave-type models; `server/applications.js` holds validation, data-driven chains, API routes, and workflow transitions. Approval steps, private attachment bytes/metadata, and history are embedded in each application, allowing an atomic revision-checked workflow update without requiring MongoDB replica-set transactions. `client/src/Student.jsx` and `Student.css` provide the portal using existing React Router and plain CSS; the illustration is original inline SVG. Auth and user/seed code extend the existing session claims with a trusted approver role. No additional frontend framework or styling system is used.

Assumptions and limitations: students choose their counselor, HOD, and warden from the active approver directory; only that assigned user may sign. Department/hostel filtering is not applied because student profiles do not store these fields. Dates for outpass are college-local wall times; leave days include both endpoints. Pending counts mean SUBMITTED. Signatures are typed names linked to the authenticated signer, timestamp, and application in the audit record: **these are not cryptographic PKI signatures**. Proofs are limited to 5 MB, checked for extension, MIME and file magic, and stored privately in MongoDB; production malware scanning and database encryption depend on deployment infrastructure. Each application stores one optional proof. Submission limits are per-IP, in memory, and reset on restart. The existing single-process session limitations still apply. Configure persistent MongoDB to retain application records.

Tests additionally cover all approval steps, rejection at each leave step, warden-only outpasses, mandatory reasons and optional proof, urgent flags, student ownership, wrong-role signing, file type/size validation, cancellation rules, and frontend urgent leave submission through to its tracker. Run `npm test`, `npm --prefix client run lint`, and `npm run build`.

### Temporary direct development login

With `DEV_MODE=true` outside production, the login form now signs seeded users in directly by college email through `POST /api/auth/login`; no OTP is needed. For the student preview use `student_123456@aitpune.edu.in`. Normal session cookies, role guards, and ownership checks still apply. Disable `DEV_MODE` to return to OTP login. Direct login is rejected in production regardless of the flag.


### Selected approvers and directory

The rerunnable seed now creates **10 counselors, 5 HODs, 10 wardens, and 1 director**, each linked to a faculty login account. Placeholder names and departments appear in selection lists. The first accounts keep `class.teacher@aitpune.edu.in`, `hod@aitpune.edu.in`, `warden@aitpune.edu.in`, and `director@aitpune.edu.in`; additional accounts append `.b`, `.c`, etc. before `@`. Sign in at `/login/faculty`. The domain follows `COLLEGE_DOMAIN`. With persistent MongoDB, run `npm --prefix server run seed` once to add the directory; local development seeds at startup. Run the app with `npm run dev`.

`GET /api/approvers?role=COUNSELOR|HOD|WARDEN|DIRECTOR` is student-only and returns `{ approvers: [{ id, name, role, department }] }` for active records. Omitting `role` returns all active records; contact email and linked user ID are never included in this response. `server/Approver.js` defines the directory collection.

Leave submission now requires `class_teacher_id`, `hod_id`, and `warden_id` (directory IDs). The single active director is assigned automatically. Outpass requires only `warden_id`; extra approver ID fields and multiple warden IDs are rejected. JSON and multipart leave requests use the same field names. Each step stores the assigned directory ID, linked user ID, name, and department. Existing approval routes additionally verify the assigned user and current active directory entry. The strict chain order is unchanged. Names are snapshotted at submission so history remains readable after directory edits.

Older applications without assigned approvers remain readable and cancellable under the existing cancellation rules, but cannot be signed by an arbitrary role holder. Cancel and resubmit an unsigned legacy request to select approvers. No approver dashboard or notifications are added.

The shared logo is a flat blue rounded square with a white check; `Logo.jsx` renders the inline SVG and wordmark. SVG, 32px PNG and 180px Apple touch favicons use the same mark. Student navigation uses 18px medium-weight text, including the mobile drawer and account menu. Login uses the same blue, light-grey surfaces, typography and logo as the student home page.


### Application status details

Click an application row on Home or My Applications to open `/applications/:id`. The previous `/student/applications/:id` URLs remain supported by the same student guard. The page uses the existing session, API and CSS tokens. `ApplicationDetail.jsx` provides an ordered horizontal approval stepper (vertical below 768px), expandable step details, typed signature previews, status banners, summary, proof download, selected approvers, and chronological timeline. The timeline starts collapsed on mobile. Cancellation opens a native modal confirmation dialog and remains subject to the existing server-side restrictions. The detail page loads once; refresh to see new decisions. No push or live status subscription is added.

The existing `GET /api/applications/:id` response now derives its ordered steps from the shared application-type chain and includes `current_step_index` (zero-based within the approver steps; null for terminal applications), `display_state` (`IN_PROGRESS`, `APPROVED`, `REJECTED`, `CANCELLED`), per-step `display_state` (`APPROVED`, `CURRENT`, `PENDING`, `REJECTED`, `STOPPED`), `completed_steps`, and `can_cancel`. List and summary responses share these fields, enabling matching mini progress bars. Signature previews remain typed names because this application only captures typed signatures. History remains embedded in the application document. Missing, invalid, and another student's application IDs all return the same 404 message.

Files added: `client/src/ApplicationDetail.jsx`, `ApplicationDetail.css`, `ApplicationDetail.test.jsx`, and `MiniProgress.jsx`. Existing routing, student rows/forms, API presentation, and tests are extended. Run `npm run dev`; validate with `npm test`, `npm --prefix client run lint`, and `npm run build`.


### Session navigation fix

`SessionProvider.jsx` caches the initial `/api/auth/session` result and shares it across routes; guards wait during loading. Direct and OTP login update that cache, and logout clears it after server revocation. The shared `api.js` always sends same-origin credentials. Unrelated API errors are displayed inline rather than redirecting to login. Only a 401 from `/api/auth/session` changes authenticated state to signed out (apart from explicit logout).

Sessions default to an eight-hour absolute deadline and a 30-minute idle deadline, both enforced server-side. Pointer, keyboard, touch, and scroll activity sends throttled `POST /api/auth/activity` heartbeats; background summary polling does not count as user activity. The client checks `/api/auth/session` at the next expiry deadline to confirm expiry before redirecting. Activity endpoint failures cannot directly sign the user out: a 401 prompts a session-endpoint check. Cookies remain HTTP-only, host-only, SameSite=Strict, Path=/; Secure follows an HTTPS `APP_ORIGIN`, allowing HTTP localhost development. Keep APP_ORIGIN consistent with the browser URL.

Diagnosis: ordinary clicks and route refreshes worked in the baseline reproduction, but a diagnostic 401 from `/api/home/summary` reproduced the unwanted login redirect despite a valid cookie. Multiple non-session API handlers contained these redirects, and route guards also repeated session checks every 15 seconds. These paths are now removed. The existing in-memory session store remains a hackathon limitation: API restarts or switching API processes invalidates sessions. No persistence or multi-instance storage was added.

Verification includes Chrome navigation, refresh, form/card clicks, injected unrelated 401, logout cookie removal, an isolated browser run with a short idle timeout, and fake-clock tests covering the full 30-minute idle and eight-hour absolute windows. Run `npm run dev` as before.
