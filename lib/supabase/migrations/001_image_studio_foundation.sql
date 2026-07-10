-- I AM NOBODY Image Studio
-- Foundation: admin authorization, artwork workflow tables, storage buckets,
-- row-level security, and canonical brand/archetype seed data.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.studio_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'reviewer'
    check (role in ('owner', 'editor', 'reviewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists studio_admins_email_lower_unique
  on public.studio_admins (lower(email));

create or replace function public.is_studio_admin(
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    check_user_id is not null
    and exists (
      select 1
      from public.studio_admins
      where user_id = check_user_id
        and is_active = true
    );
$$;

revoke all on function public.is_studio_admin(uuid) from public;
grant execute on function public.is_studio_admin(uuid)
  to authenticated, service_role;

create table if not exists public.brand_references (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  label text not null,
  kind text not null
    check (
      kind in (
        'canonical_cover',
        'clean_master',
        'mask_reference',
        'composition_guide'
      )
    ),
  version text not null,
  storage_bucket text,
  storage_path text,
  public_path text,
  sha256 text,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  aspect_ratio numeric(12, 8) generated always as (
    round(width::numeric / nullif(height, 0), 8)
  ) stored,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    public_path is not null
    or (
      storage_bucket is not null
      and storage_path is not null
    )
  )
);

create table if not exists public.archetypes (
  slug text primary key,
  code text not null unique,
  title_it text not null,
  title_en text not null,
  description_it text not null,
  description_en text not null,
  clothing_prompt text not null,
  permitted_props jsonb not null default '[]'::jsonb,
  forbidden_details jsonb not null default '[]'::jsonb,
  default_prop text,
  active boolean not null default true,
  display_order integer not null check (display_order > 0),
  prompt_version text not null default '1.0.0',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (jsonb_typeof(permitted_props) = 'array'),
  check (jsonb_typeof(forbidden_details) = 'array')
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  archetype_slug text not null
    references public.archetypes(slug),
  reference_id uuid not null
    references public.brand_references(id),
  collection_name text not null
    default 'I AM NOBODY — Archetypes',
  description text,
  clothing_notes text,
  mood_notes text,
  background_variant text not null
    default 'canonical-taupe'
    check (
      background_variant in (
        'canonical-taupe',
        'warm-beige',
        'soft-umber',
        'deep-warm-brown'
      )
    ),
  prop text,
  variation_direction text,
  output_format text not null default 'png'
    check (output_format in ('png', 'webp', 'jpeg')),
  output_width integer not null default 1360
    check (output_width > 0),
  output_height integer not null default 1920
    check (output_height > 0),
  quality text not null default 'medium'
    check (quality in ('low', 'medium', 'high')),
  number_of_variations integer not null default 4
    check (number_of_variations between 1 and 4),
  priority integer not null default 50
    check (priority between 0 and 100),
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'queued',
        'generating',
        'generated',
        'reviewing',
        'completed',
        'partially_failed',
        'failed',
        'cancelled'
      )
    ),
  brand_version text not null,
  prompt_version text not null,
  image_model text,
  image_model_snapshot text,
  compiled_prompt text,
  negative_prompt text,
  retry_count integer not null default 0
    check (retry_count >= 0),
  max_retries integer not null default 2
    check (max_retries between 0 and 5),
  estimated_cost_usd numeric(12, 6) not null default 0
    check (estimated_cost_usd >= 0),
  actual_cost_usd numeric(12, 6) not null default 0
    check (actual_cost_usd >= 0),
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  requested_by uuid not null
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.artwork_variants (
  id uuid primary key default gen_random_uuid(),
  artwork_code text not null unique,
  job_id uuid not null
    references public.generation_jobs(id) on delete cascade,
  variant_index integer not null
    check (variant_index between 1 and 99),
  storage_bucket text not null default 'nobody-private',
  storage_path text not null,
  thumbnail_storage_path text,
  mime_type text not null
    check (
      mime_type in (
        'image/png',
        'image/webp',
        'image/jpeg'
      )
    ),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  sha256 text,
  image_model text not null,
  image_model_snapshot text,
  prompt text not null,
  negative_prompt text not null,
  status text not null default 'candidate'
    check (
      status in (
        'candidate',
        'auto_rejected',
        'ready_for_review',
        'approved_artwork',
        'needs_regeneration',
        'wrong_mask',
        'wrong_composition',
        'too_busy',
        'too_literal',
        'too_generic',
        'approved_for_template',
        'published',
        'archived'
      )
    ),
  estimated_cost_usd numeric(12, 6) not null default 0
    check (estimated_cost_usd >= 0),
  actual_cost_usd numeric(12, 6) not null default 0
    check (actual_cost_usd >= 0),
  human_notes text,
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (job_id, variant_index)
);

create table if not exists public.quality_reviews (
  id uuid primary key default gen_random_uuid(),
  artwork_variant_id uuid not null
    references public.artwork_variants(id) on delete cascade,
  reviewer_model text not null,
  reviewer_model_snapshot text,
  review_version text not null,
  score numeric(5, 2) not null
    check (score between 0 and 100),
  approved_for_review boolean not null default false,
  hard_blockers jsonb not null default '[]'::jsonb,
  category_scores jsonb not null default '{}'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  recommendation text not null
    check (
      recommendation in (
        'auto_reject',
        'regenerate',
        'send_to_human_review',
        'approve_with_notes'
      )
    ),
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (jsonb_typeof(hard_blockers) = 'array'),
  check (jsonb_typeof(category_scores) = 'object'),
  check (jsonb_typeof(issues) = 'array')
);

create table if not exists public.template_renders (
  id uuid primary key default gen_random_uuid(),
  artwork_variant_id uuid not null
    references public.artwork_variants(id) on delete cascade,
  template_type text not null
    check (
      template_type in (
        'clean_artwork',
        'book_cover',
        'social_4x5',
        'social_square',
        'story_9x16',
        'gallery_thumbnail',
        'poster',
        'collectible_card'
      )
    ),
  locale text check (locale in ('it', 'en')),
  template_version text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null
    check (
      mime_type in (
        'image/png',
        'image/webp',
        'image/jpeg',
        'application/pdf'
      )
    ),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'ready',
        'published',
        'archived',
        'failed'
      )
    ),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (
    artwork_variant_id,
    template_type,
    locale,
    template_version
  )
);

create table if not exists public.gallery_entries (
  id uuid primary key default gen_random_uuid(),
  artwork_variant_id uuid not null unique
    references public.artwork_variants(id) on delete restrict,
  primary_render_id uuid
    references public.template_renders(id) on delete set null,
  archetype_slug text not null
    references public.archetypes(slug),
  slug text not null unique,
  collection_name text not null
    default 'I AM NOBODY — Archetypes',
  title_it text not null,
  title_en text not null,
  description_it text,
  description_en text,
  philosophical_line_it text,
  philosophical_line_en text,
  display_order integer not null default 100
    check (display_order >= 0),
  featured boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  visibility text not null default 'private'
    check (visibility in ('private', 'unlisted', 'public')),
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    status <> 'published'
    or published_at is not null
  )
);

create table if not exists public.studio_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid
    references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists generation_jobs_status_created_idx
  on public.generation_jobs (status, created_at desc);

create index if not exists generation_jobs_requested_by_idx
  on public.generation_jobs (requested_by, created_at desc);

create index if not exists artwork_variants_job_status_idx
  on public.artwork_variants (job_id, status);

create index if not exists artwork_variants_status_created_idx
  on public.artwork_variants (status, created_at desc);

create index if not exists quality_reviews_variant_created_idx
  on public.quality_reviews (
    artwork_variant_id,
    created_at desc
  );

create index if not exists template_renders_variant_idx
  on public.template_renders (
    artwork_variant_id,
    template_type
  );

create index if not exists gallery_entries_public_order_idx
  on public.gallery_entries (
    status,
    visibility,
    display_order,
    published_at desc
  );

create index if not exists studio_audit_log_entity_idx
  on public.studio_audit_log (
    entity_type,
    entity_id,
    created_at desc
  );

drop trigger if exists studio_admins_set_updated_at
  on public.studio_admins;

create trigger studio_admins_set_updated_at
before update on public.studio_admins
for each row execute function public.set_updated_at();

drop trigger if exists brand_references_set_updated_at
  on public.brand_references;

create trigger brand_references_set_updated_at
before update on public.brand_references
for each row execute function public.set_updated_at();

drop trigger if exists archetypes_set_updated_at
  on public.archetypes;

create trigger archetypes_set_updated_at
before update on public.archetypes
for each row execute function public.set_updated_at();

drop trigger if exists generation_jobs_set_updated_at
  on public.generation_jobs;

create trigger generation_jobs_set_updated_at
before update on public.generation_jobs
for each row execute function public.set_updated_at();

drop trigger if exists artwork_variants_set_updated_at
  on public.artwork_variants;

create trigger artwork_variants_set_updated_at
before update on public.artwork_variants
for each row execute function public.set_updated_at();

drop trigger if exists template_renders_set_updated_at
  on public.template_renders;

create trigger template_renders_set_updated_at
before update on public.template_renders
for each row execute function public.set_updated_at();

drop trigger if exists gallery_entries_set_updated_at
  on public.gallery_entries;

create trigger gallery_entries_set_updated_at
before update on public.gallery_entries
for each row execute function public.set_updated_at();

insert into public.brand_references (
  id,
  reference_code,
  label,
  kind,
  version,
  public_path,
  sha256,
  width,
  height,
  is_active,
  metadata
)
values (
  '00000000-0000-4000-8000-000000000001',
  'IAMN-COVER-CANONICAL-001',
  'Original I AM NOBODY book cover',
  'canonical_cover',
  '1.0.0',
  '/book-cover.png',
  'ad76f01fa5a6160eaca1706ba7569f06040c1e2921bf50f2ddad450d72dc0f17',
  906,
  1280,
  true,
  jsonb_build_object(
    'generation_canvas',
    '1360x1920',
    'brand_role',
    'highest_visual_authority'
  )
)
on conflict (reference_code) do update set
  label = excluded.label,
  version = excluded.version,
  public_path = excluded.public_path,
  sha256 = excluded.sha256,
  width = excluded.width,
  height = excluded.height,
  is_active = excluded.is_active,
  metadata = excluded.metadata,
  updated_at = timezone('utc', now());

insert into public.archetypes (
  slug,
  code,
  title_it,
  title_en,
  description_it,
  description_en,
  clothing_prompt,
  permitted_props,
  forbidden_details,
  default_prop,
  active,
  display_order,
  prompt_version
)
values
(
  'nobody-classic',
  'NCL',
  'Nobody Classic',
  'Nobody Classic',
  'La presenza canonica di Nobody, vicina alla copertina originale.',
  'The canonical Nobody presence, close to the original cover.',
  'a perfectly tailored black tuxedo, white pleated dress shirt, black bow tie, restrained white pocket square, formal and timeless, close to the original book cover',
  '[]'::jsonb,
  '["coloured suit","showy jewellery","decorative lapel pins","ceremonial costume"]'::jsonb,
  null,
  true,
  1,
  '1.0.0'
),
(
  'worker',
  'WRK',
  'Il Lavoratore',
  'The Worker',
  'Nobody attraverso la dignità sobria del lavoro.',
  'Nobody through the restrained dignity of work.',
  'refined dark workwear: a clean structured work jacket or elegant dark denim layers, realistic materials, minimal seams and hardware, practical but premium',
  '["one clean work glove"]'::jsonb,
  '["construction site","hard hat","heavy tools","high-visibility costume","dirty caricature styling"]'::jsonb,
  null,
  true,
  2,
  '1.0.0'
),
(
  'chef',
  'CHF',
  'Lo Chef',
  'The Chef',
  'Nobody espresso da una divisa culinaria essenziale e precisa.',
  'Nobody expressed through an essential and precise culinary uniform.',
  'a clean, beautifully fitted white chef jacket with minimal buttons and an understated dark apron detail, immaculate, elegant, and contemporary',
  '["one folded white kitchen towel"]'::jsonb,
  '["kitchen","food","knives","pans","flames","ingredients","chef hat caricature"]'::jsonb,
  null,
  true,
  3,
  '1.0.0'
),
(
  'athlete',
  'ATH',
  'L’Atleta',
  'The Athlete',
  'Nobody come disciplina, presenza e controllo.',
  'Nobody as discipline, presence, and control.',
  'a premium minimal technical tracksuit or refined monochrome athletic jacket and trousers, tailored silhouette, restrained performance materials, no visible branding',
  '["one plain ball","one plain racket"]'::jsonb,
  '["stadium","gym","action pose","competition scene","team logos","medals","multiple sports props"]'::jsonb,
  null,
  true,
  4,
  '1.0.0'
),
(
  'businessman',
  'BSN',
  'L’Uomo d’Affari',
  'The Businessman',
  'Nobody dentro il ruolo del potere professionale.',
  'Nobody within the role of professional power.',
  'a refined charcoal or black tailored business suit, crisp white shirt, restrained dark tie or open formal collar, immaculate and authoritative without visible luxury branding',
  '["one closed unbranded laptop"]'::jsonb,
  '["office","boardroom","city skyline","money","briefcase cliché","luxury watch focus"]'::jsonb,
  null,
  true,
  5,
  '1.0.0'
),
(
  'artist',
  'ART',
  'L’Artista',
  'The Artist',
  'Nobody come gesto creativo senza spettacolarizzazione.',
  'Nobody as a creative gesture without spectacle.',
  'a minimal black turtleneck or refined dark creative jacket with one extremely subtle tactile or handcrafted detail, elegant and intellectually restrained',
  '["one small unbranded sketchbook","one single paintbrush"]'::jsonb,
  '["messy studio","paint splashes","easel","palette","bohemian costume","multiple art tools"]'::jsonb,
  null,
  true,
  6,
  '1.0.0'
),
(
  'father',
  'FTH',
  'Il Padre',
  'The Father',
  'Nobody come cura, responsabilità e presenza silenziosa.',
  'Nobody as care, responsibility, and quiet presence.',
  'simple elegant casual clothing: a soft fine-knit sweater or understated jacket over a clean shirt, warm, mature, refined, and emotionally restrained',
  '["one small key","one simple folded note"]'::jsonb,
  '["children","family portrait","domestic room","sentimental posing","father stereotype costume"]'::jsonb,
  null,
  true,
  7,
  '1.0.0'
),
(
  'dancer',
  'DNC',
  'Il Danzatore',
  'The Dancer',
  'Nobody come controllo del corpo prima del movimento.',
  'Nobody as bodily control before movement.',
  'minimal black dancewear or a refined monochrome urban dance outfit, fluid but structured, elegant silhouette, composed and still rather than performing',
  '[]'::jsonb,
  '["dance pose","stage","spotlight show","costume feathers","theatrical makeup","motion blur"]'::jsonb,
  null,
  true,
  8,
  '1.0.0'
),
(
  'builder',
  'BLD',
  'Il Costruttore',
  'The Builder',
  'Nobody come capacità di dare forma senza esibire gli strumenti.',
  'Nobody as the ability to shape without displaying the tools.',
  'minimal refined architectural workwear, a structured neutral utility jacket with clean lines and one subtle construction-related material detail, premium and composed',
  '["one clean work glove","one small plain carpenter pencil"]'::jsonb,
  '["construction site","hard hat","tool belt","power tools","blueprints filling the frame","dust-covered costume"]'::jsonb,
  null,
  true,
  9,
  '1.0.0'
),
(
  'student',
  'STD',
  'Lo Studente',
  'The Student',
  'Nobody come apertura, dubbio e apprendimento.',
  'Nobody as openness, doubt, and learning.',
  'clean refined academic casualwear: an understated knit, shirt, or minimal jacket with a youthful but timeless silhouette, elegant and unbranded',
  '["one closed plain book","one minimal backpack strap"]'::jsonb,
  '["classroom","school uniform caricature","graduation gown","stack of books","visible school logos"]'::jsonb,
  'one closed plain book',
  true,
  10,
  '1.0.0'
),
(
  'traveler',
  'TRV',
  'Il Viaggiatore',
  'The Traveler',
  'Nobody come attraversamento, distanza e ritorno.',
  'Nobody as passage, distance, and return.',
  'an elegant travel-inspired coat or refined layered jacket, practical and timeless, subtle texture, composed and unbranded',
  '["one small plain key","one restrained luggage tag without text"]'::jsonb,
  '["airport","train station","landscape","suitcase pile","maps","passport","tourist styling"]'::jsonb,
  null,
  true,
  11,
  '1.0.0'
),
(
  'creator',
  'CRT',
  'Il Creatore',
  'The Creator',
  'Nobody come origine di qualcosa che prima non esisteva.',
  'Nobody as the origin of something that did not exist before.',
  'a refined contemporary black or deep-neutral outfit combining a clean jacket with a minimal tactile detail, thoughtful, modern, and quietly inventive',
  '["one closed unbranded notebook","one small plain key"]'::jsonb,
  '["technology lab","glowing screens","holograms","maker-space clutter","inventor costume"]'::jsonb,
  null,
  true,
  12,
  '1.0.0'
),
(
  'dreamer',
  'DRM',
  'Il Sognatore',
  'The Dreamer',
  'Nobody come spazio interiore, possibilità e immaginazione.',
  'Nobody as inner space, possibility, and imagination.',
  'softly tailored dark clothing with a subtle flowing layer or fine texture, introspective, elegant, minimal, and grounded in reality',
  '["one simple flower"]'::jsonb,
  '["clouds","stars","galaxy","surreal landscape","sleeping pose","fantasy costume"]'::jsonb,
  null,
  true,
  13,
  '1.0.0'
),
(
  'speaker',
  'SPK',
  'Lo Speaker',
  'The Speaker',
  'Nobody come voce pubblica senza perdere il silenzio interiore.',
  'Nobody as a public voice without losing inner silence.',
  'a refined dark jacket or minimal formal outfit suitable for a thoughtful public speaker, clean lines, calm authority, and no visible branding',
  '["one small plain presentation remote"]'::jsonb,
  '["stage","podium","audience","microphone wall","spotlights","dramatic hand gestures"]'::jsonb,
  null,
  true,
  14,
  '1.0.0'
),
(
  'infinite',
  'INF',
  'L’Infinito',
  'The Infinite',
  'Nobody oltre il ruolo, in una presenza senza tempo.',
  'Nobody beyond the role, in a timeless presence.',
  'a sculptural, timeless, almost statue-like dark garment with clean architectural draping, minimal and human, elegant rather than fantastical',
  '[]'::jsonb,
  '["wings","halo","magic","cosmic effects","fantasy armour","religious costume","non-human anatomy"]'::jsonb,
  null,
  true,
  15,
  '1.0.0'
)
on conflict (slug) do update set
  code = excluded.code,
  title_it = excluded.title_it,
  title_en = excluded.title_en,
  description_it = excluded.description_it,
  description_en = excluded.description_en,
  clothing_prompt = excluded.clothing_prompt,
  permitted_props = excluded.permitted_props,
  forbidden_details = excluded.forbidden_details,
  default_prop = excluded.default_prop,
  active = excluded.active,
  display_order = excluded.display_order,
  prompt_version = excluded.prompt_version,
  updated_at = timezone('utc', now());

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
(
  'nobody-private',
  'nobody-private',
  false,
  52428800,
  array[
    'image/png',
    'image/webp',
    'image/jpeg',
    'application/json'
  ]
),
(
  'nobody-public',
  'nobody-public',
  true,
  52428800,
  array[
    'image/png',
    'image/webp',
    'image/jpeg',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.studio_admins enable row level security;
alter table public.brand_references enable row level security;
alter table public.archetypes enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.artwork_variants enable row level security;
alter table public.quality_reviews enable row level security;
alter table public.template_renders enable row level security;
alter table public.gallery_entries enable row level security;
alter table public.studio_audit_log enable row level security;

drop policy if exists studio_admins_select_self
  on public.studio_admins;

drop policy if exists studio_admins_admin_all
  on public.studio_admins;

drop policy if exists brand_references_admin_all
  on public.brand_references;

drop policy if exists archetypes_admin_all
  on public.archetypes;

drop policy if exists generation_jobs_admin_all
  on public.generation_jobs;

drop policy if exists artwork_variants_admin_all
  on public.artwork_variants;

drop policy if exists quality_reviews_admin_all
  on public.quality_reviews;

drop policy if exists template_renders_admin_all
  on public.template_renders;

drop policy if exists gallery_entries_public_read
  on public.gallery_entries;

drop policy if exists gallery_entries_admin_all
  on public.gallery_entries;

drop policy if exists studio_audit_log_admin_read
  on public.studio_audit_log;

drop policy if exists studio_audit_log_admin_insert
  on public.studio_audit_log;

create policy studio_admins_select_self
on public.studio_admins
for select
to authenticated
using (
  user_id = auth.uid()
  and is_active = true
);

create policy studio_admins_admin_all
on public.studio_admins
for all
to authenticated
using (public.is_studio_admin())
with check (public.is_studio_admin());

create policy brand_references_admin_all
on public.brand_references
for all
to authenticated
using (public.is_studio_admin())
with check (public.is_studio_admin());

create policy archetypes_admin_all
on public.archetypes
for all
to authenticated
using (public.is_studio_admin())
with check (public.is_studio_admin());

create policy generation_jobs_admin_all
on public.generation_jobs
for all
to authenticated
using (public.is_studio_admin())
with check (public.is_studio_admin());

create policy artwork_variants_admin_all
on public.artwork_variants
for all
to authenticated
using (public.is_studio_admin())
with check (public.is_studio_admin());

create policy quality_reviews_admin_all
on public.quality_reviews
for all
to authenticated
using (public.is_studio_admin())
with check (public.is_studio_admin());

create policy template_renders_admin_all
on public.template_renders
for all
to authenticated
using (public.is_studio_admin())
with check (public.is_studio_admin());

create policy gallery_entries_public_read
on public.gallery_entries
for select
to anon, authenticated
using (
  status = 'published'
  and visibility = 'public'
  and published_at is not null
);

create policy gallery_entries_admin_all
on public.gallery_entries
for all
to authenticated
using (public.is_studio_admin())
with check (public.is_studio_admin());

create policy studio_audit_log_admin_read
on public.studio_audit_log
for select
to authenticated
using (public.is_studio_admin());

create policy studio_audit_log_admin_insert
on public.studio_audit_log
for insert
to authenticated
with check (
  public.is_studio_admin()
  and actor_user_id = auth.uid()
);

revoke all on table public.studio_admins from anon;
revoke all on table public.brand_references from anon;
revoke all on table public.archetypes from anon;
revoke all on table public.generation_jobs from anon;
revoke all on table public.artwork_variants from anon;
revoke all on table public.quality_reviews from anon;
revoke all on table public.template_renders from anon;
revoke all on table public.studio_audit_log from anon;

grant select, insert, update, delete
  on table public.studio_admins
  to authenticated;

grant select, insert, update, delete
  on table public.brand_references
  to authenticated;

grant select, insert, update, delete
  on table public.archetypes
  to authenticated;

grant select, insert, update, delete
  on table public.generation_jobs
  to authenticated;

grant select, insert, update, delete
  on table public.artwork_variants
  to authenticated;

grant select, insert, update, delete
  on table public.quality_reviews
  to authenticated;

grant select, insert, update, delete
  on table public.template_renders
  to authenticated;

grant select, insert, update, delete
  on table public.gallery_entries
  to authenticated;

grant select
  on table public.gallery_entries
  to anon;

grant select, insert
  on table public.studio_audit_log
  to authenticated;

grant usage, select
  on sequence public.studio_audit_log_id_seq
  to authenticated;

drop policy if exists nobody_private_admin_select
  on storage.objects;

drop policy if exists nobody_private_admin_insert
  on storage.objects;

drop policy if exists nobody_private_admin_update
  on storage.objects;

drop policy if exists nobody_private_admin_delete
  on storage.objects;

drop policy if exists nobody_public_read
  on storage.objects;

drop policy if exists nobody_public_admin_insert
  on storage.objects;

drop policy if exists nobody_public_admin_update
  on storage.objects;

drop policy if exists nobody_public_admin_delete
  on storage.objects;

create policy nobody_private_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'nobody-private'
  and public.is_studio_admin()
);

create policy nobody_private_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'nobody-private'
  and public.is_studio_admin()
);

create policy nobody_private_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'nobody-private'
  and public.is_studio_admin()
)
with check (
  bucket_id = 'nobody-private'
  and public.is_studio_admin()
);

create policy nobody_private_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'nobody-private'
  and public.is_studio_admin()
);

create policy nobody_public_read
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'nobody-public'
);

create policy nobody_public_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'nobody-public'
  and public.is_studio_admin()
);

create policy nobody_public_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'nobody-public'
  and public.is_studio_admin()
)
with check (
  bucket_id = 'nobody-public'
  and public.is_studio_admin()
);

create policy nobody_public_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'nobody-public'
  and public.is_studio_admin()
);

commit;