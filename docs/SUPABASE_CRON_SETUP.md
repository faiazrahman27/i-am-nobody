# I AM NOBODY — Supabase Cron Setup

This project uses Vercel to host the Next.js application and Supabase Cron to call the private daily artwork worker every ten minutes.

The production worker endpoint is:

```text
https://www.iamnobody.live/api/automation/daily-artworks
```

The endpoint is protected by the same server-only `CRON_SECRET` already configured in Vercel. The secret must never be committed to GitHub, pasted into a source file, or exposed through a `NEXT_PUBLIC_...` variable.

## Files involved

```text
vercel.json
lib/supabase/migrations/013_automation_schedule_8am_high_quality.sql
lib/supabase/migrations/014_supabase_cron_scheduler.sql
```

`vercel.json` intentionally contains no Vercel Cron configuration. Supabase is the only repeated scheduler.

## 1. Confirm the Vercel Production secret

Open the Vercel project for `www.iamnobody.live`.

Go to:

```text
Settings → Environment Variables
```

Confirm that Production contains:

```text
CRON_SECRET=<a real random value containing at least 32 characters>
```

Copy that value temporarily. You will store the same value in Supabase Vault. Do not create a different second secret.

## 2. Deploy the updated application first

Push the updated project and wait until the Vercel Production deployment is Ready:

```powershell
git status
git add .
git commit -m "Move artwork scheduling to Supabase Cron"
git push
```

The production worker endpoint must be available before Supabase starts calling it.

## 3. Run migration 013

Open:

```text
Supabase Dashboard → SQL Editor → New query
```

Paste and run the complete contents of:

```text
lib/supabase/migrations/013_automation_schedule_8am_high_quality.sql
```

This fixes the production automation to:

```text
Timezone: Europe/Rome
Start hour: 08:00
Daily count: 10
Image quality: high
```

Running migration 013 again is acceptable because it replaces the previous production guard and reapplies the intended configuration.

## 4. Run migration 014

Create another SQL Editor query. Paste and run the complete contents of:

```text
lib/supabase/migrations/014_supabase_cron_scheduler.sql
```

This migration:

- enables Supabase Vault, `pg_cron`, and `pg_net`;
- creates the protected `nobody_private` schema;
- creates the scheduler configuration function;
- creates the immediate worker test function;
- does not contain or expose the real `CRON_SECRET`.

## 5. Store two values in Supabase Vault

Open the project’s Vault page in the Supabase Dashboard. Use the Dashboard search and search for **Vault** if it is not visible in the sidebar.

Create the following two secrets exactly.

### Secret 1

```text
Name: iamnobody_worker_url
Secret value: https://www.iamnobody.live/api/automation/daily-artworks
Description: I AM NOBODY production daily artwork worker URL
```

### Secret 2

```text
Name: iamnobody_cron_secret
Secret value: paste the exact same CRON_SECRET already configured in Vercel
Description: I AM NOBODY scheduled worker bearer secret
```

Important:

- The names must match exactly, including lowercase letters.
- Do not include quotation marks around either value.
- Do not add a trailing space.
- Do not use the Supabase service-role key here.
- Do not create `NEXT_PUBLIC_CRON_SECRET`.

## 6. Configure the scheduler once

Return to the SQL Editor and run:

```sql
select nobody_private.configure_nobody_supabase_cron();
```

A successful result contains:

```json
{
  "configured": true,
  "scheduler": "supabase-cron",
  "job_name": "iamnobody-daily-artwork-worker",
  "schedule": "*/10 * * * *",
  "worker_url": "https://www.iamnobody.live/api/automation/daily-artworks"
}
```

Running the same configuration function again is safe. It removes the existing job with this exact name and recreates one current job, so duplicate scheduled workers are not left behind.

## 7. Verify that exactly one job exists

Run:

```sql
select
  jobid,
  jobname,
  schedule,
  active,
  username,
  command
from cron.job
where jobname = 'iamnobody-daily-artwork-worker';
```

Expected values:

```text
jobname: iamnobody-daily-artwork-worker
schedule: */10 * * * *
active: true
```

There must be exactly one row.

## 8. Trigger the worker immediately

After the Vercel deployment is Ready and the two Vault secrets are saved, run:

```sql
select nobody_private.trigger_nobody_supabase_worker();
```

The result is a numeric `request_id`. Save that number.

`pg_net` sends the HTTP request asynchronously. Wait for the request to finish, then inspect it with:

```sql
select
  id,
  status_code,
  timed_out,
  error_msg,
  content,
  created
from net._http_response
where id = YOUR_REQUEST_ID;
```

Replace `YOUR_REQUEST_ID` with the number returned by the test function.

A normal successful response has:

```text
status_code: 200
error_msg: null
timed_out: false
```

The response content may report one of these valid states:

- today’s plan was created;
- one or more artworks were processed;
- no queued item was available;
- another worker already held the queue lease;
- the request arrived before the 08:00 Rome start;
- daily automation is paused.

## 9. Inspect Supabase Cron history

Run:

```sql
select
  jobid,
  runid,
  status,
  return_message,
  start_time,
  end_time
from cron.job_run_details
where jobid = (
  select jobid
  from cron.job
  where jobname = 'iamnobody-daily-artwork-worker'
  limit 1
)
order by start_time desc
limit 30;
```

This history confirms whether Supabase Cron successfully queued each scheduled HTTP request.

To inspect recent HTTP responses from the worker itself, run:

```sql
select
  id,
  status_code,
  timed_out,
  error_msg,
  created
from net._http_response
order by created desc
limit 30;
```

The Studio remains the authoritative place for artwork planning, generation, retries, automated visual review, and human review status.

## 10. Verify the Studio

Open:

```text
https://www.iamnobody.live/studio/automation
```

Confirm:

```text
Daily schedule: 08:00
Timezone: Europe/Rome
Daily generation: Active
Image quality: high
```

After 08:00 Rome time:

- if today has no batch, the next Supabase Cron wave creates the plan;
- remaining queued items are picked up by later ten-minute waves;
- completed items are not generated again;
- retryable failures return to the queue;
- manual recovery buttons remain available.

If setup is completed after 08:00, the immediate test function or the next ten-minute scheduled wave starts or continues today’s collection. There is no need to wait until the next day.

## What to delete

Delete no source file, migration, image asset, database table, bucket, or environment variable.

The only scheduling configuration removed is the `crons` section from `vercel.json`. The updated full `vercel.json` already does this. After the new Production deployment, Vercel no longer manages the artwork schedule.

Do not manually recreate a Vercel Cron job.

## Do not delete

Do not delete:

```text
lib/supabase/migrations/001_image_studio_foundation.sql
...
lib/supabase/migrations/014_supabase_cron_scheduler.sql
public/book-cover.png
public/nobody-canonical-helmet.png
public/nobody-canonical-background.png
public/nobody-subject-matte.png
CRON_SECRET from Vercel
```

Do not add the real `CRON_SECRET` to any project file.
