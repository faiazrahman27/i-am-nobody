# Production automation hardening — 24 July 2026

## Supabase scheduling

- Removed Vercel Cron from `vercel.json` so Vercel Hobby can deploy without repeated-cron validation failure.
- Added migration `014_supabase_cron_scheduler.sql`.
- Added Supabase Cron and `pg_net` worker scheduling every ten minutes.
- Added Vault storage for the production worker URL and shared `CRON_SECRET`.
- Added idempotent scheduler configuration that replaces an existing job rather than creating duplicates.
- Added an immediate scheduler test function.
- Kept Vercel as the Next.js host and protected worker runtime.
- Kept Europe/Rome date and 08:00 eligibility checks inside the application for daylight-saving-safe behaviour.

## Manual operation

- Manual planning safely bypasses the clock.
- Manual generation safely bypasses the automatic schedule.
- Deliberate recovery remains available for failed daily items.
- The Studio refreshes while work remains queued or generating.
- Progress counters use actual queue-item states.

## Automatic operation

- One reusable queue worker serves Supabase Cron and manual Studio actions.
- Remaining items continue on later ten-minute scheduler waves.
- A worker does not start a generation wave without enough function time remaining.
- Retry attempts are preserved when work is already running or temporarily rate-limited.
- Rejected, failed, and stale attempts can create a fresh image instead of becoming permanent idempotent results.

## Image quality

- The original cover body is not supplied as a ghosted composition reference.
- The generation model receives a neutral approved body-space guide.
- The canonical background and helmet remain checksum-verified and deterministic.
- Scanlines, horizontal banding, transparency, ghosting, double exposure, and pasted overlay artifacts are prohibited and technically screened.
- Only images passing the strict automated review gate count as Ready for review.

## Creative planning

- Planner version `3.1.0` remains active.
- Clothing directions must use concrete role-specific garments and construction details.
- Restrained integrated objects are allowed only when they make the character legible.
- Bags and similar carry items are acceptable when relevant.
- Signs, placards, readable documents, logos, pseudo-text, unrelated objects, and literal scenes remain prohibited.
