# DEPLOY TODAY — Neon + Vercel (fastest real path)

This gets a real, live, publicly-accessible URL. Follow in order. Total
time if nothing breaks: **30-45 minutes**. If something breaks, paste me
the exact error and I'll fix it immediately — that's the one thing I could
never test myself in my own sandbox, so this is the first time any of this
touches a real server.

---

## Step 1 — Push this code to GitHub (5 min)

If you don't already have a GitHub repo:
1. Go to https://github.com/new, create a repo (public or private, either works)
2. In your terminal, inside the `salon-platform` folder:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## Step 2 — Create a free Postgres database on Neon (5 min)

1. Go to https://neon.tech, sign up (free, no credit card)
2. Create a new project (any name/region)
3. Copy the **connection string** it shows you — looks like
   `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`
4. Keep this tab open, you'll need this string again in Step 4

---

## Step 3 — Deploy to Vercel (10 min)

1. Go to https://vercel.com, sign up with your GitHub account
2. Click "Add New" → "Project"
3. Import the GitHub repo you pushed in Step 1
4. Vercel will auto-detect Next.js — **don't click Deploy yet**, first
   go to "Environment Variables" and add these:

| Key | Value |
|---|---|
| `DATABASE_URL` | the Neon connection string from Step 2 |
| `AUTH_SECRET` | any random 32+ character string (or run `openssl rand -base64 32` locally) |
| `NEXTAUTH_URL` | leave blank for now — come back and set this in Step 5 |
| `ADMIN_EMAIL` | `akhilsingla304@gmail.com` |
| `PAYMENT_PROVIDER` | `mock` (real Razorpay needs real keys — skip for today) |
| `NOTIFICATION_PROVIDER` | `mock` |

5. Click **Deploy**

---

## Step 4 — Watch the build

Vercel will show you a live build log. Three things happen in order:
`prisma generate` → `prisma migrate deploy` → `next build`.

- **If `prisma generate` fails**: paste me the exact error. This should
  NOT happen here — Vercel has real internet access, unlike my sandbox.
- **If `prisma migrate deploy` fails**: usually means `DATABASE_URL` is
  wrong — double check you copied the Neon string exactly, including
  `?sslmode=require` at the end.
- **If `next build` fails with a TypeScript error**: paste me the exact
  error and file/line. I'll fix it right away.

**This is the single most important moment** — whatever error shows up
here is real, and I can fix it fast once I see it.

---

## Step 5 — Fix the URL and redeploy

Once it deploys, Vercel gives you a URL like `salon-platform-xyz.vercel.app`.

1. Go to Project Settings → Environment Variables
2. Set `NEXTAUTH_URL` to `https://salon-platform-xyz.vercel.app` (your real URL)
3. Redeploy (Vercel → Deployments → click the three dots on the latest → Redeploy)

---

## Step 6 — Seed the admin account

You need to run the seed script ONCE against your live Neon database.
Easiest way, from your own machine (not Vercel):

```bash
# in your local salon-platform folder
echo 'DATABASE_URL="paste-your-neon-string-here"' > .env
npm install
npx prisma generate
npm run seed
```

This prints a one-time admin password — **save it**, you'll log in with
`akhilsingla304@gmail.com` + that password.

---

## Step 7 — Test the live site

Open your Vercel URL and go through:
1. `/signup` — create a customer account
2. `/signup` again (different email) — create an OWNER account
3. Log in as owner → `/owner/salons/new` → submit a salon
4. Log in as admin (`akhilsingla304@gmail.com`) → `/admin/salon-applications` → approve it
5. Log in as owner again → `/dashboard/services?salonId=<id>` add a
   service, `/dashboard/hours?salonId=<id>` set hours (find the salon's ID
   via Neon's SQL editor — `SELECT id, name FROM "Salon";`)
6. Log in as customer → `/search` → should see the salon → book it

---

## What will NOT work today, and that's fine

- **AI Assistant** (`/dashboard/ai-assistant`) — needs Ollama running
  somewhere reachable from the internet. Not realistic for today; the page
  will show a "couldn't reach the AI assistant" error, which is the
  correct, honest failure mode, not a fake response.
- **Real Razorpay payments** — needs real Razorpay keys. Cash/UPI recording
  by the owner still works fully.
- **Real WhatsApp/SMS** — mock provider logs to server console instead of
  actually sending. This is by design (spec explicitly forbids faking it).

If you're demoing live, describe these as "provider abstractions ready for
real credentials" rather than pretending they fully work — more honest,
and sounds more credible to anyone technical reviewing it.

---

## If you get stuck

Paste me the **exact error message** at whatever step it happens. I can
fix real bugs in seconds once I can see them — that's the entire value of
you actually running this, versus me guessing in a sandbox with no network.
