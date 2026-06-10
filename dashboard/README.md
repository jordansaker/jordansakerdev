# Studio Dashboard

A single-user app for running Jordan Saker's freelance studio: services & pricing, clients,
quotes, invoices (with ATO-compliant PDF + email), and quarterly BAS / GST summary.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Drizzle ORM · Postgres ·
Resend (email) · react-pdf (PDFs). Deploys to Vercel + Fly Postgres.

## Local dev

1. Install deps:

   ```sh
   npm install
   ```

2. Copy env:

   ```sh
   cp .env.example .env.local
   ```

   Fill in:

   - `ADMIN_PASSWORD` — the password you'll use to sign in
   - `SESSION_SECRET` — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `RESEND_API_KEY` — from https://resend.com (only needed for sending email)
   - `RESEND_FROM` — `Jordan Saker <invoices@jordansakerdev.com>` (domain must be verified in Resend)

   `DATABASE_URL` is already set to the local docker postgres.

3. Start the local DB:

   ```sh
   npm run db:up      # docker compose up -d
   npm run db:push    # apply schema (no migrations folder needed for first time)
   npm run db:seed    # seed your business identity + standard services
   ```

   `db:push` syncs the schema directly to the DB. Once you start tracking history, use
   `db:generate` to create a migration SQL file, then `db:migrate` to apply it.

4. Run the dev server:

   ```sh
   npm run dev
   ```

   Open http://localhost:3002 and sign in with `ADMIN_PASSWORD`.

## Sending email

Resend sends from a verified domain. Until you verify `jordansakerdev.com` in Resend
(or whichever domain you use), the "Send" button on the invoice list will return a
domain-not-verified error. You can still download the PDF and email it manually.

To verify:
1. https://resend.com → Domains → Add `jordansakerdev.com`
2. Add the DNS records they show
3. Once verified, the "Send" button works

## Deploy — Fly Postgres + Vercel

### 1. Create the Postgres on Fly

Install `flyctl`, then:

```sh
fly auth login
fly postgres create --name studio-db --region syd
```

This prints a `DATABASE_URL` ending in `.flycast` (private). For Vercel to reach it, you
need the public URL. Two options:

- **Attach with `--external`**: Fly Postgres now lets you allocate a shared IP and use a
  public connection string. After `fly postgres create`, run:

  ```sh
  fly postgres connect -a studio-db    # to verify it works
  fly secrets list -a studio-db        # find the public DATABASE_URL
  ```

  If your cluster doesn't expose a public address, allocate one:

  ```sh
  fly ips allocate-v6 -a studio-db
  fly ips allocate-v4 -a studio-db
  ```

- **Or, use a hosted Postgres**: Neon and Supabase are simpler if Fly Postgres networking
  feels heavy. The app only needs a `DATABASE_URL`.

### 2. Apply the schema

From your local machine, with the production `DATABASE_URL` exported:

```sh
DATABASE_URL="postgres://…production…" npm run db:push
DATABASE_URL="postgres://…production…" npm run db:seed
```

### 3. Vercel

```sh
npx vercel link
npx vercel env add DATABASE_URL production
npx vercel env add ADMIN_PASSWORD production
npx vercel env add SESSION_SECRET production
npx vercel env add RESEND_API_KEY production
npx vercel env add RESEND_FROM production
npx vercel --prod
```

### 4. After first deploy

- Sign in with `ADMIN_PASSWORD` at `https://your-deployment.vercel.app/login`
- Add a client on `/clients`
- Build your first quote, save & convert to an invoice
- Verify the PDF renders (`/api/invoices/1/pdf`)
- Send a test invoice to yourself

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Production server (after `build`) |
| `npm run db:up` / `db:down` | Start/stop the local docker Postgres |
| `npm run db:push` | Sync the Drizzle schema to the DB (no migration file) |
| `npm run db:generate` | Generate a migration SQL file from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio (GUI) |
| `npm run db:seed` | Seed settings + standard services |
| `npm run lint` | ESLint |

## Architecture notes

- `src/db/schema.ts` — the canonical schema. Money is stored in **integer cents**.
- `src/lib/money.ts` — formatting and GST math, all in cents.
- `src/lib/queries.ts` — read-side queries used by pages.
- `src/lib/email.ts` — Resend integration. Renders the PDF on demand and attaches it.
- `src/lib/pdf/invoice-pdf.tsx` — react-pdf invoice template; ATO-compliant fields.
- `proxy.ts` — Next.js 16 proxy (was `middleware.ts`); single-user auth gate.
- `src/app/(app)/` — authenticated routes share a sidebar layout. `/login` is public.

## ATO tax invoice fields

Every PDF includes:

- The words "Tax invoice"
- Legal name and ABN
- Invoice date and number
- Description, quantity, unit price for each line
- GST shown separately on a separate line (when GST registered)
- Buyer name and ABN (where provided)
- Payment instructions

Confirm specifics with your accountant — this isn't tax advice.
