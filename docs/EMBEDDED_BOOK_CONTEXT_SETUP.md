# I AM NOBODY — Embedded Book Context Setup

This production version does not upload the book PDF to OpenAI and does not use OpenAI Files, Vector Stores, or File Search.

The editorial knowledge used by the daily planner is embedded in:

```text
lib/nobody/bookCreativeContext.ts
```

The planner sends that server-side context to the OpenAI Responses API whenever it creates the daily collection. The PDF itself is not required in GitHub, Vercel, or the deployed application.

## OpenAI API key permissions

Keep the existing restricted production key with only:

```text
Responses: Write
Images: Request
Everything else: None
```

Do not enable Files or Vector Stores. No additional OpenAI key or resource is required.

## Required Vercel variables

```text
OPENAI_API_KEY
OPENAI_IMAGE_MODEL=gpt-image-2-2026-04-21
OPENAI_REVIEW_MODEL=gpt-5.6-luna
OPENAI_PLANNER_MODEL=gpt-5.6-luna
CRON_SECRET
```

No `OPENAI_BOOK_VECTOR_STORE_ID` variable is used.

## Deployment and testing

Follow `docs/PRODUCTION_AUTOMATION_CHECKLIST.md`.

Manual planning and manual generation both work at any hour. The automatic worker remains scheduled for 10:00 Europe/Rome with retry opportunities through 14:00.

The first successful new planning run records planner version `3.1.0` in the automation configuration and new planning records.
