# Smart Leave Management System

The client currently opens directly into student and faculty portals without a login screen. This iteration is a **browser-local demo**: sample requests and decisions are stored in local storage for the current browser only. It does not submit requests to the server, identify real people, or create official approvals.

## Run locally

Requires Node.js 22.12+ and npm. From the repository root:

```sh
npm run setup
npm run dev
```

Open http://localhost:5173. Use the home page to open either portal. The faculty portal lets you switch between Warden, Counsellor, HOD, and Joint Director stages. Demo requests can be reviewed through the four stages; student requests and decisions are shared between the portal views in the same browser.

The portal's sample token, audit IDs, and printable approval are for demonstration only. They are not authenticated signatures or valid leave approvals. Clearing browser local storage resets the demo data.

## Backend status

The existing Express/MongoDB API and its OTP authentication routes remain in the repository, but this client demo does not call them. Do not treat the client-only portal as suitable for real student or faculty use. Before production, connect the portal to a secured backend, restore verified user identities and role authorization, and generate official approval records server-side.

## Validation

```sh
npm test
npm --prefix client run lint
npm run build
```
