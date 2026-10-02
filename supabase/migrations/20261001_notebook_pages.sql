-- =========================
-- notebook pages
-- =========================
-- One row per Notebook page. `blocks` holds each writing block as Tiptap
-- (ProseMirror) JSON keyed by block key, e.g. {"onMyMind": {"type":"doc",...}}.
-- Personal pages are one per day, enforced by the partial unique index below.
-- Client ids are generated in the browser (crypto.randomUUID) so a page keeps
-- one identity across devices and offline replays.

create table if not exists public.notebook_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  section text not null check (section in ('personal', 'professional', 'learning', 'ventures')),
  title text not null default '' check (char_length(title) <= 160),
  page_date date,
  source_url text,
  blocks jsonb not null default '{}'::jsonb check (jsonb_typeof(blocks) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notebook_pages_personal_has_date
    check ((section = 'personal') = (page_date is not null))
);

create index if not exists notebook_pages_user_id_idx
  on public.notebook_pages(user_id);

create unique index if not exists notebook_pages_one_personal_page_per_day
  on public.notebook_pages(user_id, page_date)
  where section = 'personal';

drop trigger if exists set_notebook_pages_updated_at on public.notebook_pages;
create trigger set_notebook_pages_updated_at
before update on public.notebook_pages
for each row execute function public.set_updated_at();

alter table public.notebook_pages enable row level security;

drop policy if exists "notebook_pages_own_all" on public.notebook_pages;
create policy "notebook_pages_own_all"
on public.notebook_pages for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
