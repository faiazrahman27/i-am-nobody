# I AM NOBODY — Production Image Automation Checklist

This release keeps the book knowledge embedded in `lib/nobody/bookCreativeContext.ts`. The book PDF is not required in GitHub, Vercel, Supabase Storage, OpenAI Files, or a vector store.

## Production architecture

```text
Vercel Hobby
- Hosts the Next.js website and Studio
- Hosts the protected artwork worker API route
- Does not schedule repeated cron jobs

Supabase
- Database and private storage
- Supabase Cron scheduler
- pg_net authenticated HTTP worker calls
- Vault-encrypted worker URL and CRON_SECRET

OpenAI API
- Daily concept planning
- Image generation
- Automated visual review
```

## Automation behaviour

- The production date and schedule are evaluated in `Europe/Rome`.
- Today’s collection becomes eligible at 08:00 Rome time.
- The system creates exactly ten planned items for each Rome calendar date.
- Supabase Cron calls the protected production worker every ten minutes.
- Calls before 08:00 safely do nothing.
- Calls after 08:00 prepare today’s plan when missing and process queued work.
- Completed items are skipped.
- Retryable failures are queued again according to the existing retry policy.
- Manual planning, generation waves, and deliberate failed-item recovery remain available.
- Nothing is approved or published without a human decision.

## Image-generation boundary

- The book context drives the role, life situation, philosophical tension, clothing, mood, posture, and restrained object direction.
- Characters must not read as a generic person in a generic hoodie, jacket, or suit.
- A bag, backpack, satchel, tote, glove, apron detail, pouch, folder, folded cloth, or one similarly restrained unbranded object may be worn, carried, attached, or held when it makes the character legible.
- No sign, placard, board, readable document, floating symbol, decorative object, logo, pseudo-text, screen, badge, label, or unrelated background object is allowed.
- The canonical background and helmet remain checksum-verified and are applied by the production pipeline.
- Scanlines, banding, ghosting, transparency, double exposure, pasted overlays, and technically corrupted images are rejected.

## Replace the files

1. Make a backup commit:

   ```powershell
   git status
   git add .
   git commit -m "Backup before Supabase Cron migration"
   ```

2. Extract the supplied complete project ZIP to a temporary folder.
3. Copy everything inside the extracted project folder.
4. Paste it over the existing repository folder.
5. Choose **Replace the files in the destination**.
6. Do not delete `.git`, `.env.local`, or `.vercel` from the existing repository.
7. Do not put the private book PDF or any secret in GitHub.

## Vercel environment variables

Confirm these Production variables exist:

```text
NEXT_PUBLIC_SITE_URL=https://www.iamnobody.live
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=sk-proj-...
OPENAI_IMAGE_MODEL=gpt-image-2-2026-04-21
OPENAI_REVIEW_MODEL=gpt-5.6-luna
OPENAI_PLANNER_MODEL=gpt-5.6-luna
CRON_SECRET=the existing real random value of at least 32 characters
```

Do not add:

```text
NEXT_PUBLIC_OPENAI_API_KEY
NEXT_PUBLIC_CRON_SECRET
OPENAI_BOOK_VECTOR_STORE_ID
```

## Required Supabase SQL work

Run in this order:

```text
1. lib/supabase/migrations/013_automation_schedule_8am_high_quality.sql
2. lib/supabase/migrations/014_supabase_cron_scheduler.sql
3. Create `iamnobody_worker_url` and `iamnobody_cron_secret` in Supabase Vault
4. Run `select nobody_private.configure_nobody_supabase_cron();`
```

Follow the exact one-time configuration and verification instructions in:

```text
docs/SUPABASE_CRON_SETUP.md
```

## Local checks

From the project root:

```powershell
npm install
npm run validate:brand
npm run lint
npx tsc --noEmit
npm run build
```

The production build validates all required environment variables.

## Deploy

```powershell
git status
git add .
git commit -m "Move daily artwork scheduling to Supabase Cron"
git push
```

Wait for the Vercel Production deployment to show **Ready** before configuring or testing the Supabase scheduler.

## Manual test

1. Complete `docs/SUPABASE_CRON_SETUP.md`.
2. Trigger one immediate worker request from Supabase SQL.
3. Open `https://www.iamnobody.live/studio/automation`.
4. Confirm the page shows 08:00 Rome, Active, and high quality.
5. If today has no plan and it is already after 08:00, the worker creates it.
6. Wait for later ten-minute waves or use **Run manual generation wave now**.
7. Failed items that exhaust automatic attempts can be deliberately reset using **Retry failed artworks**.

## Quality boundary

The system makes the canonical background and helmet deterministic, strengthens character-specific planning, and blocks technically corrupted outputs. Generative anatomy, clothing, hands, objects, lighting, and material construction can still occasionally fail. Those attempts must be rejected and retried rather than presented as production-ready work. Final approval and publication remain human decisions.
