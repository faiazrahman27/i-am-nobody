# I AM NOBODY

Production Next.js site, Shopify storefront, private Image Studio, and autonomous daily artwork pipeline for I AM NOBODY.

## Image automation

The daily Studio:

- plans ten original concepts from the embedded book context and recent Studio history;
- creates character-specific clothing and restrained integrated object directions;
- generates controlled clean artwork with GPT Image 2;
- reapplies the checksum-verified canonical background and helmet;
- runs strict automated visual review with GPT-5.6 Luna;
- sends only passing images to the private human-review queue;
- supports manual planning and manual generation at any hour;
- becomes eligible at 08:00 Europe/Rome;
- uses Supabase Cron to call the production worker every ten minutes until queued work is completed.

Vercel hosts the website and API routes. Supabase handles the repeated schedule. `vercel.json` intentionally contains no Vercel Cron configuration.

See:

```text
docs/PRODUCTION_AUTOMATION_CHECKLIST.md
docs/SUPABASE_CRON_SETUP.md
docs/EMBEDDED_BOOK_CONTEXT_SETUP.md
```

## Local development

```bash
npm install
npm run dev
```

## Production checks

```bash
npm run validate:brand
npm run lint
npx tsc --noEmit
npm run build
```

Never commit `.env.local`, OpenAI keys, Supabase service-role keys, CRON secrets, SMTP passwords, Shopify tokens, or the private book PDF.
