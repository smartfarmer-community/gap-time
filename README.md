# GAP-TIME — SmartFarmer Workforce Tracker

GPS-verified employee time sheet and log sheet web app for SmartFarmer Community, Kumasi, Ghana.

## Quick Start

```bash
npm install
cp .env.example .env   # fill in your Supabase keys
npm run dev            # http://localhost:3000
```

## Deploy to Vercel (free)

```bash
npm install -g vercel
vercel
# Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as env vars when prompted
```

## First-time Supabase Setup

1. Go to https://supabase.com → your project (cnpqvohazrnyaipgpipf)
2. SQL Editor → paste entire contents of `supabase/migrations/001_gap_time_schema.sql` → Run
3. Authentication → Providers → Email → **turn off "Confirm email"**
4. Authentication → Users → Add User → create your Admin account (auto-confirm)
5. SQL Editor → run:
   ```sql
   UPDATE public.user_roles SET role = 'admin'
   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-admin@email.com');
   ```
6. Sign in at the app — you land on the HR/Admin panel
7. From User Management, create all employee and manager accounts

## Default Hub (pre-seeded)

| Hub | Lat | Lng | Radius |
|-----|-----|-----|--------|
| Kumasi Administrative Studio | 6.71282 | -1.59829 | 150m |
| Main Processing Plant (Ejisu) | 6.74230 | -1.53120 | 200m |
| Accra Liaison Office | 5.60370 | -0.18700 | 100m |

## Roles

- **Employee** — clock in/out, daily log, corrections
- **Manager** — verify/flag logs, approve corrections
- **HR/Admin** — user management, hub management, CSV export, all logs
