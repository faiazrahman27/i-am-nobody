# I AM NOBODY — Embedded Book Context Setup

This production version does not upload the book PDF to OpenAI and does not use OpenAI Files, Vector Stores, or File Search.

The complete editorial knowledge used by the daily planner is embedded in:

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

## Deployment

1. Replace the project files with this version.
2. Run `npm install`.
3. Run `npm run validate:brand`.
4. Run `npm run lint`.
5. Run `npx tsc --noEmit`.
6. Commit and push the changed files to GitHub.
7. Vercel runs the production configuration validator and the Next.js build using the environment variables already stored in the project.
8. Wait for the Vercel production deployment to finish.
9. Open `/studio/automation` and run **Retry AI planning**.
10. After ten concepts are planned, run **Retry pending generation** once to test one artwork.

The first successful planning run records planner version `3.0.0` in the automation configuration and new planning records.
