# Social Automation SaaS (Postflow)

A modern multi-tenant SaaS platform for scheduling, automating, and analyzing social media posts across 19+ networks — similar to Postiz, Buffer, Hootsuite, Later, and Metricool.

## Architecture

This is a **monorepo** with three applications:

| App | Path | Port | Purpose |
|-----|------|------|---------|
| **Backend API** | `backend/` | 8000 | Laravel 13 REST API, queues, scheduler |
| **User SPA** | `frontend/` | 5173 | Landing page, auth, user dashboard |
| **Admin SPA** | `admin/` | 5174 | Platform admin console |

```
┌─────────────┐     ┌─────────────┐
│  frontend   │     │    admin    │
│  React SPA  │     │  React SPA  │
└──────┬──────┘     └──────┬──────┘
       │  /api proxy       │
       └─────────┬─────────┘
                 ▼
         ┌───────────────┐
         │ Laravel API   │
         │ Sanctum auth  │
         └───────┬───────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
 PostgreSQL   Redis      S3 storage
 (or MySQL)   (queues)
```

### Tech stack

- **Backend:** Laravel 13, Sanctum, PostgreSQL (MySQL compatible)
- **Frontend:** React 19, Vite 8, Tailwind CSS 4, Recharts
- **Queue:** Laravel Queue + Redis (database driver works for local dev)
- **Scheduler:** Laravel Task Scheduler (cron)
- **Payments:** Stripe / Paddle (scaffolded)
- **Storage:** Local disk or S3-compatible
- **AI:** OpenAI API (with local fallback)

## Prerequisites

- PHP 8.3+
- Composer 2.x
- Node.js 20+ and npm
- PostgreSQL 14+ **or** MySQL 8+ **or** SQLite (local dev only)
- Redis (recommended for production queues)

## Quick start (local)

### 1. Backend

```bash
cd backend
cp .env.example .env
php artisan key:generate

# SQLite (fastest local setup — already configured in .env.example)
touch database/database.sqlite   # Windows: type nul > database\database.sqlite
php artisan migrate --seed

# Or PostgreSQL — edit .env:
# DB_CONNECTION=pgsql
# DB_HOST=127.0.0.1
# DB_PORT=5432
# DB_DATABASE=social_automation
# DB_USERNAME=postgres
# DB_PASSWORD=secret

php artisan serve
```

### 2. Queue worker (required for scheduled publishing)

In a second terminal:

```bash
cd backend
php artisan queue:work --tries=3
```

### 3. Scheduler (required for due posts, automations, token refresh)

In a third terminal:

```bash
cd backend
php artisan schedule:work
```

> In production, use a single cron entry instead: `* * * * * php /path/to/artisan schedule:run`

### 4. User frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

### 5. Admin panel

```bash
cd admin
npm install
npm run dev
```

Open **http://localhost:5174**

## Demo accounts

After `php artisan migrate --seed`:

| Role | Email | Password |
|------|-------|----------|
| Demo user | `demo@social-automation.test` | `password` |
| Team editor | `editor@social-automation.test` | `password` |
| Platform admin | `admin@social-automation.test` | `password` |

The demo workspace includes connected social accounts (demo mode), sample posts, analytics, and an automation.

## Supported social platforms

Facebook Pages/Groups, Instagram, TikTok, YouTube/Shorts, X/Twitter, LinkedIn Profiles/Pages, Pinterest, Reddit, Threads, Bluesky, Mastodon, Google Business Profile, Telegram, Discord, WhatsApp Business, Snapchat.

Platform integrations live in `backend/app/Services/Social/Platforms/`. Without OAuth credentials configured, the app runs in **demo mode** — accounts connect instantly with simulated tokens so you can test the full UI.

## Key features

- Multi-tenant workspaces with roles (Owner, Admin, Manager, Editor, Viewer)
- Subscription plans with usage limits and trials
- Post composer with per-platform variants
- Scheduling, calendar, queue-based publishing, retry logic
- RSS / automation engine
- AI caption, hashtag, and content tools
- Media library with folders
- Analytics snapshots and dashboards
- Team invites, approval workflow, activity log
- Developer API keys and webhooks
- Separate admin console for users, plans, workspaces, jobs

## API overview

All endpoints are under `/api`. Authenticated requests require:

```
Authorization: Bearer {token}
X-Workspace: {workspace-slug-or-id}
```

Public endpoints: `POST /api/register`, `POST /api/login`, `GET /api/plans`

Workspace-scoped examples: `GET /api/dashboard`, `GET /api/posts`, `POST /api/posts`, `GET /api/calendar`

Admin endpoints (requires `is_admin`): `GET /api/admin/dashboard`, `GET /api/admin/users`, etc.

## Environment variables

See `backend/.env.example` for the full list. Important settings:

| Variable | Description |
|----------|-------------|
| `APP_URL` | Backend URL (e.g. `http://127.0.0.1:8000`) |
| `FRONTEND_URL` | User SPA URL for notification links |
| `DB_*` | Database connection |
| `QUEUE_CONNECTION` | `redis` in production, `database` for local |
| `REDIS_*` | Redis connection for queues/cache |
| `AWS_*` | S3-compatible media storage |
| `OPENAI_API_KEY` | AI content generation |
| `STRIPE_*` / `PADDLE_*` | Billing |
| `FACEBOOK_*`, `TWITTER_*`, etc. | OAuth credentials per platform |

## Production deployment

### Backend

1. Set `APP_ENV=production`, `APP_DEBUG=false`, generate `APP_KEY`
2. Configure PostgreSQL (recommended) or MySQL
3. Set `QUEUE_CONNECTION=redis` and run a queue worker via Supervisor
4. Add cron: `* * * * * cd /var/www/backend && php artisan schedule:run >> /dev/null 2>&1`
5. Run migrations: `php artisan migrate --force`
6. Seed plans/platforms once: `php artisan db:seed --class=PlanSeeder && php artisan db:seed --class=SocialPlatformSeeder`
7. Configure S3 for media: `FILESYSTEM_DISK=s3`
8. Set up Stripe/Paddle webhooks pointing to your billing endpoints

### Frontends

Build static assets and serve via Nginx/Caddy:

```bash
cd frontend && npm ci && npm run build
cd admin && npm ci && npm run build
```

Example Nginx locations:

- `app.yourdomain.com` → `frontend/dist`
- `admin.yourdomain.com` → `admin/dist`
- `api.yourdomain.com` → Laravel `public/`

Configure `SANCTUM_STATEFUL_DOMAINS` and CORS for your production domains.

### Supervisor (queue worker)

```ini
[program:social-queue]
command=php /var/www/backend/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
user=www-data
```

## Scheduled tasks

Registered in `backend/routes/console.php`:

| Command | Schedule | Purpose |
|---------|----------|---------|
| `posts:publish-due` | Every minute | Publish scheduled posts |
| `posts:retry-failed` | Every 5 min | Retry failed posts |
| `automations:run` | Every 5 min | Run RSS/automation rules |
| `social:refresh-tokens` | Hourly | Refresh OAuth tokens |
| `analytics:capture` | Daily 02:00 | Snapshot analytics |

## Testing

```bash
cd backend
php artisan test
```

Tests use an in-memory SQLite database (see `phpunit.xml`).

## Project structure

```
├── backend/          Laravel API, jobs, platform services
│   ├── app/Services/Social/Platforms/   Per-network publishers
│   ├── app/Jobs/                        Queue jobs
│   ├── app/Console/Commands/            Scheduler commands
│   └── routes/api.php                   All API routes
├── frontend/         User-facing React SPA
│   └── src/pages/    Landing, dashboard, composer, etc.
└── admin/            Admin React SPA
    └── src/pages/    Users, plans, workspaces, jobs
```

## License

MIT
