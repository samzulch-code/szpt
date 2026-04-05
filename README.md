# SZPT — Peak Blueprint OS

Your personal cutting dashboard. Built with Next.js + Supabase + Vercel.

---

## 🚀 Deploy in 4 steps

### Step 1 — Set up Supabase database

1. Go to **supabase.com** → New project
2. Name it `szpt`, pick a password, choose a region close to you (Sydney)
3. Once created, go to **SQL Editor** (left sidebar)
4. Open `supabase-schema.sql` from this project and paste the entire contents
5. Click **Run** — this creates all your tables
6. Go to **Settings → API** and copy:
   - `Project URL` (looks like `https://xxxx.supabase.co`)
   - `anon public` key

### Step 2 — Set up your code on GitHub

1. Go to **github.com** → New repository → name it `szpt` → Create
2. Open Terminal and run:

```bash
cd ~/Downloads/szpt   # or wherever you saved this folder
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/szpt.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

### Step 3 — Deploy to Vercel

1. Go to **vercel.com** → Add New Project
2. Import your `szpt` GitHub repository
3. Before clicking Deploy, add these **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click **Deploy** — takes about 60 seconds
5. Vercel gives you a URL like `szpt-jamie.vercel.app`

### Step 4 — Custom domain (optional, ~$15/yr)

1. Buy a domain at **namecheap.com** (e.g. `szpt.app` or `peakblueprint.app`)
2. In Vercel → your project → Settings → Domains → Add domain
3. Follow Vercel's DNS instructions (copy 2 records to Namecheap)
4. Done — usually live within 5 minutes

---

## 💻 Running locally

```bash
cd szpt
cp .env.local.example .env.local
# Edit .env.local with your Supabase keys
npm install
npm run dev
# Open http://localhost:3000
```

---

## 📦 Importing your existing data

1. Open your Google Sheets coaching log
2. Select columns: **Date, Calories, Protein, Steps, Weight** (in that order)
3. Copy (Cmd+C)
4. In the app, go to **Import CSV**
5. Paste and click Preview → Import

Accepts DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD date formats.
Tabs or commas as separators both work.
Existing entries for the same date are updated (not duplicated).

---

## 📱 Pages

| Page | Route |
|------|-------|
| Login / Signup | `/` |
| Dashboard | `/dashboard` |
| Analytics | `/analytics` |
| Current Plan | `/plan` |
| Adherence | `/adherence` |
| My Profile | `/profile` |
| Log Data | `/log` |
| Import CSV | `/import` |
| Progress Photos | `/photos` |
| Hevy Training | `/training` |

---

## 🔑 Tech stack

- **Next.js 14** (App Router)
- **Supabase** (Postgres database + Auth + Storage)
- **Vercel** (Hosting + Edge Functions)
- **Chart.js + react-chartjs-2** (Charts)
- **TypeScript** throughout

---

## 🔒 Security

- All data protected by Supabase Row Level Security
- Users can only access their own data
- Hevy API key stored encrypted in database
- No data stored in browser (no localStorage)
- HTTPS enforced by Vercel

---

## Adding client support later

When you're ready to add coaching clients:
1. The database schema already supports multiple users
2. Add a `role` column to profiles (`coach` / `client`)
3. Add a `coach_id` column to profiles for client linking
4. Build a coach dashboard that queries clients by `coach_id`

The data structure is already designed for this.
