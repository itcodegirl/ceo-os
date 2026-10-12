-- =========================
-- reminders
-- =========================
-- Reminders and notebook to-dos, synced from the browser's local copy
-- (remindersRepository.js). Ids are text because reminders created before
-- sync existed may carry a non-UUID fallback id; new ones are UUIDs.
-- A notebook to-do records the page it came from (source_id), the page title
-- at the time, and an in-app link back to it. There is no foreign key to
-- notebook_pages: the to-do outlives its page, and the link text is kept.

create table if not exists public.reminders (
  id text primary key check (char_length(id) between 1 and 64),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  is_done boolean not null default false,
  completed_at timestamptz,
  snoozed_until timestamptz,
  source_type text check (source_type in ('notebook-page')),
  source_id text check (char_length(source_id) <= 64),
  source_title text check (char_length(source_title) <= 160),
  source_href text check (source_href like '/notebook?%' and char_length(source_href) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reminders_user_id_idx on public.reminders(user_id);
create index if not exists reminders_source_idx on public.reminders(user_id, source_id)
  where source_id is not null;

drop trigger if exists set_reminders_updated_at on public.reminders;
create trigger set_reminders_updated_at
before update on public.reminders
for each row execute function public.set_updated_at();

alter table public.reminders enable row level security;

drop policy if exists "reminders_own_all" on public.reminders;
create policy "reminders_own_all"
on public.reminders for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
