# I AM NOBODY

Production Next.js site, Shopify storefront, private Image Studio, and autonomous daily artwork pipeline for I AM NOBODY.

## Image automation

The daily studio:

- plans ten original concepts from the embedded book context and recent Studio history;
- generates controlled clean artwork with GPT Image 2;
- reapplies the checksum-verified canonical background and helmet;
- runs strict automated visual review with GPT-5.6 Luna;
- sends only passing images to the private human-review queue;
- supports manual planning and manual generation at any hour;
- runs automatically from 10:00 Europe/Rome with retry opportunities.

See:

```text
docs/PRODUCTION_AUTOMATION_CHECKLIST.md
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

Never commit `.env.local`, OpenAI keys, Supabase service-role keys, SMTP passwords, Shopify tokens, or the private book PDF.
