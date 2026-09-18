# Wedding Invitation Platform

## Architecture summary

- **Frontend** (`src/`): existing Vite + React invitation experience, extended with React Router.
  - `/` demo invitation (static fallback content until event API is used via personalized links)
  - `/i/:token` personalized invitation (loads guest + event from API)
  - `/admin` authenticated dashboard
- **Backend** (`server/`): Express + TypeScript + Prisma + PostgreSQL
- **Database**: PostgreSQL via Prisma migrations
- **Auth**: Argon2id password hashes + JWT in HTTP-only cookie

## Database schema

Models: `AdminUser`, `Event`, `Guest`, `Rsvp`, `InvitationEvent`

Key constraints:
- `Guest.inviteToken` UNIQUE
- Cascade deletes from Event → Guests and Guest → RSVP/Events
- Indexes on language, invitationStatus, name/phone/email

Migration: `server/prisma/migrations/20260918125122_init`

## Environment variables

### Server (`server/.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | ≥32 char secret for admin sessions |
| `PORT` | API port (default 4000) |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated |
| `PUBLIC_APP_URL` | Public site URL used in invite/WhatsApp/QR links |
| `COOKIE_NAME` | Admin session cookie name |
| `ADMIN_BOOTSTRAP_EMAIL` | First admin email (seed/bootstrap) |
| `ADMIN_BOOTSTRAP_PASSWORD` | First admin password |
| `OPEN_DEDUP_MINUTES` | Invitation open dedupe window (default 10) |

### Frontend

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Leave empty in local dev (Vite proxies `/api`). Set to API origin in split deployments. |

## API routes

### Public
- `GET /api/health`
- `GET /api/invitations/:token`
- `POST /api/invitations/:token/open`
- `GET /api/invitations/:token/rsvp`
- `POST /api/invitations/:token/rsvp`
- `GET /api/invitations/:token/calendar.ics`
- `POST /api/invitations/:token/events`
- `GET /api/invitations/:token/qr.png`

### Admin auth
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/me`

### Admin
- `GET /api/admin/dashboard`
- `GET /api/admin/guests`
- `POST /api/admin/guests`
- `GET /api/admin/guests/:id`
- `PATCH /api/admin/guests/:id`
- `DELETE /api/admin/guests/:id`
- `POST /api/admin/guests/bulk-delete`
- `POST /api/admin/guests/import`
- `GET /api/admin/guests/export`
- `GET /api/admin/guests/export-rsvp`
- `POST /api/admin/guests/:id/regenerate-link`
- `POST /api/admin/guests/:id/rsvp`
- `GET /api/admin/guests/:id/whatsapp`
- `GET /api/admin/guests/:id/qr.png`
- `GET /api/admin/events/current`
- `PATCH /api/admin/events/current`

## Security measures

- Argon2id password hashing
- HTTP-only cookie JWT sessions
- Helmet, CORS allowlist, rate limiting (auth/RSVP/public)
- Zod validation on inputs
- Prisma parameterized queries
- Sanitized RSVP messages (HTML stripped, 500 char limit)
- Public invitation responses omit IDs, notes, other guests
- Unguessable invite tokens (`crypto.randomBytes(24).toString('base64url')`)
- Disabled invitations return 404
- Server-side max guest count enforcement
- RSVP deadline enforced for guests (admin can override)

## Local development

```bash
# 1) Postgres running + database created
# 2) Copy env
cp server/.env.example server/.env

# 3) Migrate + seed
cd server && npm install && npx prisma migrate deploy && npm run db:seed

# 4) API
npm run dev

# 5) Frontend (separate terminal, repo root)
npm install
npm run dev
```

- Invitation demo: http://localhost:5173/
- Admin: http://localhost:5173/admin/login
- Personalized: http://localhost:5173/i/<token> (copy from Guests table)

Default seed admin (change immediately):
- email from `ADMIN_BOOTSTRAP_EMAIL`
- password from `ADMIN_BOOTSTRAP_PASSWORD`

Optional Docker Postgres:

```bash
docker compose up -d
```

## Deployment

1. Provision PostgreSQL.
2. Set production env vars on the API host.
3. Run `npx prisma migrate deploy && npm run db:seed` (seed once).
4. Build/start API: `npm run build && npm start` in `server/`.
5. Build frontend: `npm run build` at repo root; host `dist/` on Vercel/static CDN.
6. Point `VITE_API_BASE_URL` / reverse-proxy `/api` to the API.
7. Set `PUBLIC_APP_URL` and `CORS_ORIGIN` to the live site origin.
8. Use `sameSite=none; secure` cookies when frontend/API are on different sites (already enabled when `NODE_ENV=production`).

## Testing

```bash
cd server && npm test
```

Current critical unit tests cover:
- token uniqueness/entropy
- RSVP max guest validation
- WhatsApp localization
- message sanitization

## Files created / modified

### Created
- `server/**` (API, Prisma, tests)
- `docker-compose.yml`
- `src/api/client.ts`
- `src/invitation/**`
- `src/locales/{en,ar,he}.json`
- `src/pages/InvitationPage*`
- `src/admin/**`
- `src/components/InvitationExtras*`
- `ARCHITECTURE.md`

### Modified
- `src/App.tsx`, `src/main.tsx`
- `src/components/OpeningExperience.tsx`
- `src/components/EnvelopePage.tsx`
- `src/components/InvitationHero.tsx`
- `src/components/InteractivePreviewLayer.tsx`
- `vite.config.ts`, `package.json`, `tsconfig.app.json`, `.gitignore`
