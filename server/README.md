# Student leave request and approval API

The Express API uses MongoDB/Mongoose for users and leave requests. The browser sends the HTTP-only session cookie; student identity comes from the verified JWT, never from the request body.

## Student endpoints

- `GET /api/leave-requests/approvers` — lists available Warden, Counsellor, and HOD accounts, plus the single configured Joint Director.
- `GET /api/leave-requests` — list the signed-in student's requests.
- `GET /api/leave-requests/summary` — total, pending, approved, and rejected counts.
- `POST /api/leave-requests` — submit `leaveType`, `startDate`, `endDate`, `reason`, and `approverIds` for Warden, Counsellor, and HOD. The Joint Director is assigned by the server.
- `GET /api/leave-requests/:id/pdf` — download the approval letter after required approvals are complete. Leave PDFs contain all four approvals; outpass PDFs contain the Warden approval and outpass times.
- Requests accept `applicationType: "leave" | "outpass"` and `priority: "normal" | "urgent"`. A leave uses four approval stages. An outpass needs only a Warden and includes same-day departure and return times.
- Leave requests and their approval history are stored in MongoDB and are not automatically deleted. They remain available to students and assigned faculty after server restarts.

## Faculty endpoints

- `GET /api/faculty/approvals` — list requests assigned to the signed-in faculty member at their current stage.
- `POST /api/faculty/approvals/:id/decision` — submit `{ decision: "approved" | "rejected", comment }`. Approval forwards leave requests to the next stage, completes outpasses after the Warden, and rejection requires an explanation visible to the student. The API checks the assigned account and stage before recording a decision.

## Approver accounts

Faculty users who may review leave requests have an `approvalRole` of `warden`, `counsellor`, `hod`, or `joint_director`. The Joint Director is unique in MongoDB. The student selection list is loaded from these records. For local development, `npm run dev` seeds multiple demo students and named reviewers using `DEMO_PASSWORD` (default `CampusLeave123!`). The seeder preserves changed password hashes on future runs. Signed-in users can change their password from their dashboard. Add real reviewer accounts with the corresponding `approvalRole` before using the workflow with college users.

## Run locally

From the repository root, run `npm run setup`, copy `server/.env.example` to `server/.env`, and set a random `SESSION_SECRET` of at least 32 characters. Requests are stored in persistent MongoDB running on this laptop at `mongodb://localhost:27017/leave_management`. Start MongoDB, then run `npm run dev`. The API binds only to `127.0.0.1:3001`; remote database addresses and non-local frontend origins are rejected. The Vite client proxies `/api` to the local API, so the browser and HTTP-only session cookie use the same origin.

For full authentication and environment setup, see the root `README.md`.
