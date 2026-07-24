# I AM NOBODY — Manual testing mode

This configuration pauses all scheduled artwork generation and keeps manual testing available one artwork at a time.

## What the pause does

- Sets `daily_artwork_automation.is_enabled` to `false`.
- Unschedules the Supabase Cron job named `iamnobody-daily-artwork-worker`.
- Keeps existing plans, queued items, artworks, reviews, and history.
- Keeps image generation enabled for manual owner/editor actions.
- Generates exactly one queued test artwork per manual click.
- Does not automatically retry a failed manual test.
- Keeps the application monthly reservation guard at USD 30.

A request that was already running when the pause is applied may still finish. No new scheduled request will start afterward.

## Immediate setup

1. Open Supabase Dashboard.
2. Open SQL Editor.
3. Run the complete file:

   `lib/supabase/migrations/015_pause_automation_for_manual_testing.sql`

4. Confirm the result:

```sql
select
  is_enabled,
  metadata
from public.daily_artwork_automation
where singleton = true;
```

Expected:

- `is_enabled = false`
- `metadata.manual_testing_mode = true`
- `metadata.scheduler_state = paused`

5. Confirm the worker cron is absent:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'iamnobody-daily-artwork-worker';
```

Expected: zero rows.

6. Confirm the USD 30 application guard:

```sql
select
  max_reserved_cost_usd_per_month,
  max_concurrent_jobs,
  max_images_per_job
from public.image_generation_policy
where singleton = true;
```

Expected:

- `max_reserved_cost_usd_per_month = 30.00`
- `max_concurrent_jobs = 1`
- `max_images_per_job = 1`

## Manual testing workflow

1. Open `/studio/automation`.
2. If no plan exists, click **Prepare today’s collection now**.
3. Click **Generate one test artwork now** once.
4. Wait for it to finish.
5. Review the artwork and exact automated review message.
6. Generate another only after you decide the previous result is worth continuing.
7. Failed manual tests are not automatically requeued. Use **Retry failed artworks** only when you deliberately want another attempt.

## Re-enabling automatic generation later

After migration 015 is installed, the Studio button **Enable daily automation**:

- asks for confirmation,
- validates the existing Vault worker URL and cron secret,
- recreates the Supabase Cron job,
- sets daily automation back to active.

You can also enable it directly in Supabase SQL Editor:

```sql
select public.resume_nobody_daily_automation();
```

To pause it again:

```sql
select public.pause_nobody_daily_automation();
```

## Files to delete

Delete nothing from the source project. Keep all migrations and all canonical visual assets.
