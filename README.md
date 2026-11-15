# ANANTA Medicine Tracker

ANANTA is a web app for looking up medicine batches and recording parts of their supply-chain history. It has a public lookup page, a regulator dashboard for organizations and recalls, and a workspace for approved supply-chain organizations.

This is an early development version. Registry lookups reflect what has been recorded in the system and do not verify the physical product. Do not use this as a production healthcare service.

## Run locally

You need Node.js 20.11 or later, npm, and Docker with Compose.

1. From the project root, start PostgreSQL:

   ```sh
   docker compose up -d db
   ```

2. Create local environment files:

   ```sh
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```

3. In `backend/.env`, set `JWT_SECRET` and `BOOTSTRAP_TOKEN` to long random values. For example, generate values with `openssl rand -hex 32`. Put the same `JWT_SECRET` in `frontend/.env.local`. Keep these files private; they are for local development.

4. Install packages and prepare the database:

   ```sh
   npm install
   npm run db:generate
   npm run db:migrate
   ```

5. Start the API and website with one command:

   ```sh
   npm run dev   # starts Fastify on :8000 and Next.js on :3000
   ```

   Open <http://localhost:3000>.

6. Create the first regulator account once. Use the `BOOTSTRAP_TOKEN` from `backend/.env` and choose a password of at least 12 characters:

   ```sh
   curl -X POST http://localhost:8000/auth/bootstrap \
     -H 'Content-Type: application/json' \
     -d '{"email":"regulator@example.test","password":"replace-with-a-long-password","bootstrapToken":"paste-your-bootstrap-token-here"}'
   ```

   Sign in at <http://localhost:3000/login>. The regulator can create and approve organizations. Approved organizations sign in to `/workspace`; their available actions depend on whether they are a manufacturer, distributor, or pharmacy.

## Folder map

- `frontend/src/app/` — public page, login, dashboards, and Next.js route handlers.
- `frontend/src/app/api/` — same-origin routes for login and forwarding browser API calls to Fastify.
- `frontend/src/components/` — shared interface components.
- `frontend/src/lib/` — browser API helper.
- `frontend/src/middleware.ts` — redirects unauthenticated users away from protected pages.
- `backend/src/server.ts` — Fastify routes, authentication, and authorization.
- `backend/src/env.ts` — backend environment variable parsing.
- `backend/prisma/schema.prisma` — database model.
- `backend/prisma/migrations/` — versioned database changes.
- `docs/` — security review and blockchain design notes.
- `compose.yaml` — local PostgreSQL service.

## Decisions in this version

- **The browser calls the Next.js app first.** Its same-origin API routes read the HttpOnly session cookie and forward the token to Fastify. Browser JavaScript does not need to read the token.
- **Both layers check authentication.** Next.js middleware helps with page navigation; Fastify verifies the token and checks the account and permissions for API requests. The backend is the security boundary.
- **The frontend and backend currently share a JWT signing secret.** This keeps local setup straightforward, but it means a compromised Next.js server could mint tokens. A stricter deployment should have Fastify sign with a private key and Next.js verify with a public key.
- **Bootstrap only works before the first regulator account exists.** After that, another bootstrap attempt returns `409`. If you reset the database, rotate `BOOTSTRAP_TOKEN` in `backend/.env` before bootstrapping again.
- **PostgreSQL stores the operational records.** Prisma models the data and applies versioned migrations, keeping related organizations, users, batches, transfers, and audit events together.
- **Blockchain anchoring is not implemented.** The design notes describe a possible use for recording hashes, while keeping certificates and personal information off-chain. It should only be added if the threat model and participating organizations justify it.
