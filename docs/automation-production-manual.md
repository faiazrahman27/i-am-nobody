# I AM NOBODY — automation production manual

## What was changed

1. **Daily planner strengthened**
   - It now pushes for far more diverse characters each day.
   - It rejects briefs that are too visually similar.
   - It requires clearer garments, materials, colours/textures, and role-defining cues.
   - It explicitly supports examples like a student with a backpack, a physician in scrubs, a municipal caretaker, or a seasonal gift-bearer when philosophically justified.

2. **Generation prompt strengthened**
   - It now tells the image model not to flatten characters into the same neutral look.
   - It forces more distinct silhouettes and better role readability.
   - It reinforces clean helmet integration and rejects halo / rim behaviour.

3. **Helmet halo reduction in the edit mask**
   - The editable mask now protects the helmet zone and a small safety ring around it.
   - This reduces pasted-mask looks, halo edges, and failed neck / collar integration.

4. **Automation worker made more reliable**
   - Parallel generation was reduced from 5 to 2 concurrent items.
   - This lowers API overload / timeout risk and should reduce retries.
   - Failure messages are now more explicit.

## Manual work required

### 1) Replace the project files
Replace the changed files with the updated versions from this delivery:
- `lib/nobody/dailyPlanner.ts`
- `lib/nobody/promptBuilder.ts`
- `lib/nobody/imagePipeline.ts`
- `lib/nobody/automationWorker.ts`
- `docs/automation-production-manual.md`

### 2) Install dependencies
If your local environment is not already up to date:

```bash
pnpm install
```

### 3) Run a type / lint / build check locally
Run:

```bash
pnpm lint
pnpm build
```

If your project uses a different script layout, run the equivalent commands used in your repo.

### 4) Redeploy the application
Push the updated code to your deployment branch and redeploy on Vercel.

### 5) Clear today’s bad batch if you do not want to keep it
If today’s batch already contains poor results, do one of these:

- easiest: use the Studio controls to retry failed items and then generate a fresh wave after deploy
- or manually reset today’s batch/items in Supabase if you want a fully clean rerun

### 6) Test after deploy
After deploy:
1. open `/studio/automation`
2. use **Run manual generation wave now**
3. let 1–2 items process first
4. verify:
   - characters are more different
   - no obvious helmet halo
   - no weird cutoffs / generic duplicate styling
   - exact failure messages show on problem cards

### 7) Best operating note
Because concurrency is intentionally reduced for stability, the full set of 10 may take longer to finish, but it should fail less often and produce cleaner outputs.

## Files you can delete
No source file must be deleted for this patch.

You may delete old temporary delivery artifacts outside the project root if you no longer need them, for example any older zip or text delivery bundles that were only used to transfer files.
