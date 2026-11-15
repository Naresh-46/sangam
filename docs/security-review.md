# Security review notes

This is a source review of the current development code, not a penetration test or deployment certification.

## Controls in the code

- Protected API routes re-read the active account from PostgreSQL and check regulator role, organization approval, organization type, batch custody, or transfer recipient as appropriate.
- Zod parses request fields before writes. Prisma uses parameterized database operations.
- React renders database strings as text; there is no `dangerouslySetInnerHTML` use.
- Passwords use Node `scrypt` with a random salt. Login failures use a generic response and have route-level rate limits.
- Web login stores the API JWT only in a `HttpOnly`, `SameSite=Lax` cookie, marked `Secure` in production. Mutating browser proxy routes check the request origin.
- Next.js has nonce-based script CSP and browser security headers; Fastify uses Helmet. HSTS is limited to production.
- API requests do not trust forwarded IP headers unless specific proxy IPs/CIDRs are configured through `TRUSTED_PROXIES`.
- Public batch verification omits internal audit text and the regulator's detailed recall reason.
- `.env` files are ignored by Git while `.env.example` files remain trackable. Local PostgreSQL is bound to loopback.

## Checks still needed in a running environment

- Build and run the web, API and database; confirm expected `401`/`403`/`429` responses with separate regulator and organization accounts.
- Inspect actual browser cookies and response headers in development and HTTPS production.
- Run `npm audit` after installing dependencies and generating a lockfile; review any suggested dependency update before applying it.
- Run a scoped OWASP ZAP baseline against the local app. Only run active scans against a local disposable database or a system you own and have permission to test.
- Exercise concurrency around batch transfers and recalls, then review database backups, restore, secret rotation and host proxy configuration.

The rate limits, headers, CSP nonce behavior and production cookie settings have not been verified in a running build. The application is not yet ready for real medicine or patient data.
