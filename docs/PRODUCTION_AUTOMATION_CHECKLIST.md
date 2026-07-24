# I AM NOBODY — Production Image Automation Checklist

This release keeps the book knowledge embedded in `lib/nobody/bookCreativeContext.ts`. The book PDF is not required in GitHub, Vercel, Supabase Storage, or OpenAI File Search.

## What this release fixes

- Manual planning works at any hour.
- Manual generation works at any hour and is no longer blocked by the 10:00 Rome schedule.
- Automatic generation starts at 10:00 Europe/Rome and has retry invocations through 14:00 in both summer and winter time.
- The Studio page refreshes itself while work remains queued or generating.
- Rejected or incomplete image attempts no longer become permanent idempotent results. A fresh image can be generated.
- Only images that pass the strict automated visual gate count as Ready for review.
- The canonical background and helmet remain checksum-verified and are applied deterministically after model generation.
- The planner and prompt reject text-bearing objects, screens, badges, labels, logos, letters, numbers, and pseudo-text.
- The visual review checks lighting direction, contact shadows, helmet integration, anatomy, hands, clothing geometry, text artifacts, and every existing brand rule.

## Replace the files

1. Make a backup commit in the existing repository:

   ```powershell
   git status
   git add .
   git commit -m "Backup before production automation hardening"
   ```

2. Extract the supplied complete project ZIP to a temporary folder.
3. Open the extracted project folder and copy everything inside it.
4. Paste it over the existing local project folder.
5. Choose **Replace the files in the destination**.
6. Do not delete the existing `.git`, `.env.local`, or `.vercel` folders.
7. Do not put the book PDF in the repository.

## OpenAI API Platform

Use the existing key in the **I AM NOBODY Production** API project.

Keep it as **Restricted** with:

```text
Responses: Write
Images: Request
Everything else: None
```

No Files permission, Vector Stores permission, Assistant, File Search resource, or extra key is required.

## Vercel environment variables

In the Vercel project connected to `www.iamnobody.live`, confirm these Production variables already exist:

```text
NEXT_PUBLIC_SITE_URL=https://www.iamnobody.live
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=sk-proj-...
OPENAI_IMAGE_MODEL=gpt-image-2-2026-04-21
OPENAI_REVIEW_MODEL=gpt-5.6-luna
OPENAI_PLANNER_MODEL=gpt-5.6-luna
CRON_SECRET=at least 32 random characters
```

Do not add `NEXT_PUBLIC_OPENAI_API_KEY`. Do not add `OPENAI_BOOK_VECTOR_STORE_ID`.

## Supabase

No new SQL migration is required for this release. Do not rerun the existing migrations.

## Local checks

From the project root:

```powershell
npm install
npm run validate:brand
npm run lint
npx tsc --noEmit
npm run build
```

The build requires the same environment values used by Vercel. If local production variables are unavailable, run the checks after confirming `.env.local` contains the required server-only values.

## Deploy

```powershell
git status
git add .
git commit -m "Harden image automation and enable manual generation"
git push
```

Wait for the Vercel deployment to show **Ready**.

## Manual test at any time

1. Open `https://www.iamnobody.live/studio/automation`.
2. If today has no collection, press **Prepare today's collection now** once.
3. Wait until **Planned** shows `10`.
4. Press **Generate next artwork now** once.
5. Keep the page open while the button says **Generating and checking artwork…**.
6. The page also refreshes automatically every 15 seconds while work remains.
7. A successful image changes **Ready for review** to `1` and **Queued / generating** to `9`.
8. Scroll to the completed card and press **Review artwork →**.
9. If an image fails the automated gate, it is queued for a fresh attempt. After three unsuccessful attempts it appears under **Needs retry**, where **Retry failed artworks** resets it deliberately.

## Automatic operation

Leave **Daily generation: Active**.

Vercel invokes the route at several UTC hours. The server checks Europe/Rome time and only works during the intended 10:00–14:00 local window. This covers daylight-saving changes without requiring manual schedule edits.

The worker processes up to three queue items concurrently per invocation. It continues existing work and never creates a second collection for the same Rome calendar date.

## Quality boundary

The system makes the background and helmet deterministic and applies strict automated rejection and retry rules. Generative clothing, anatomy, shadows, and materials can still occasionally fail. Such results are blocked from the Ready for review count rather than being accepted. Final publication still requires human approval.
