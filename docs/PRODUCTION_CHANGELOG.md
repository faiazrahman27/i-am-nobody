# Production automation hardening — 24 July 2026

## Manual operation

- Manual planning now bypasses the clock safely.
- Manual generation now bypasses the automatic schedule safely.
- Added deliberate recovery for failed daily items.
- Added automatic Studio refresh while work remains.
- Corrected progress counters to use actual queue-item states.

## Automatic operation

- Extracted one reusable queue worker for cron and manual actions.
- Added Rome-time retry coverage through 14:00 across CET and CEST.
- Prevented a worker from starting a generation wave without enough function time remaining.
- Preserved retry attempts when work is already running or temporarily rate-limited.
- Rejected, failed, and stale attempts can now create a fresh image instead of becoming permanent idempotent results.

## Image quality

- Exact checksum validation and deterministic application of the canonical cover assets remain active.
- Raised the minimum automated review score to 88.
- Added mandatory category floors for mask, anonymity, background, composition, editorial quality, restraint, archetype clarity, and template space.
- Every mandatory checklist rule must be returned and passed.
- Added strict checks for lighting direction, contact shadows, helmet/collar integration, anatomy, hands, fingers, clothing geometry, artificial grain, blur, and pseudo-text.
- Images that fail automated review are not counted as Ready for review.

## Creative planning

- Planner version `3.1.0`.
- Three planning attempts instead of two.
- Text-bearing props, screens, documents, labels, badges, insignia, logos, pseudo-text, incompatible poses, and literal scenes are rejected before image generation.
