-- =========================
-- notebook cards, questions, and ideas
-- =========================
-- Things the learner made from notebook writing. Each row links back to the
-- page it came from (and the block its source text was selected in), but it is
-- its own record: deleting the page keeps the item and clears the link
-- (`on delete set null`). Client ids are generated in the browser so an item
-- keeps one identity across devices and offline replays.

create table if not exists public.notebook_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  page_id uuid references public.notebook_pages(id) on delete set null,
  source_text text check (char_length(source_text) <= 2000),
  source_block text check (char_length(source_block) <= 64),
  prompt text not null check (char_length(prompt) between 1 and 300),
  answer text not null check (char_length(answer) between 1 and 1000),
  -- Review schedule, carried from creation so a later review screen needs no migration.
  ease numeric(4, 2) not null default 2.5 check (ease between 1.3 and 3.0),
  interval_days integer not null default 1 check (interval_days >= 1),
  repetition_count integer not null default 0 check (repetition_count >= 0),
  next_review_at timestamptz not null default now() + interval '1 day',
  last_grade text check (last_grade in ('forgot', 'hard', 'good', 'easy')),
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notebook_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  page_id uuid references public.notebook_pages(id) on delete set null,
  source_text text check (char_length(source_text) <= 2000),
  source_block text check (char_length(source_block) <= 64),
  text text not null check (char_length(text) between 1 and 500),
  answer text check (char_length(answer) <= 2000),
  status text not null default 'unanswered' check (status in ('unanswered', 'answered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notebook_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  page_id uuid references public.notebook_pages(id) on delete set null,
  source_text text check (char_length(source_text) <= 2000),
  source_block text check (char_length(source_block) <= 64),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 2000),
  category text check (char_length(category) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notebook_cards_user_id_idx on public.notebook_cards(user_id);
create index if not exists notebook_cards_page_id_idx on public.notebook_cards(page_id);
create index if not exists notebook_cards_next_review_idx on public.notebook_cards(user_id, next_review_at);
create index if not exists notebook_questions_user_id_idx on public.notebook_questions(user_id);
create index if not exists notebook_questions_page_id_idx on public.notebook_questions(page_id);
create index if not exists notebook_ideas_user_id_idx on public.notebook_ideas(user_id);
create index if not exists notebook_ideas_page_id_idx on public.notebook_ideas(page_id);

drop trigger if exists set_notebook_cards_updated_at on public.notebook_cards;
create trigger set_notebook_cards_updated_at
before update on public.notebook_cards
for each row execute function public.set_updated_at();

drop trigger if exists set_notebook_questions_updated_at on public.notebook_questions;
create trigger set_notebook_questions_updated_at
before update on public.notebook_questions
for each row execute function public.set_updated_at();

drop trigger if exists set_notebook_ideas_updated_at on public.notebook_ideas;
create trigger set_notebook_ideas_updated_at
before update on public.notebook_ideas
for each row execute function public.set_updated_at();

alter table public.notebook_cards enable row level security;
alter table public.notebook_questions enable row level security;
alter table public.notebook_ideas enable row level security;

-- A row may only point at a page its owner owns, so the page link cannot be
-- used to probe someone else's page ids.
drop policy if exists "notebook_cards_own_all" on public.notebook_cards;
create policy "notebook_cards_own_all"
on public.notebook_cards for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (page_id is null or exists (
    select 1 from public.notebook_pages p where p.id = page_id and p.user_id = auth.uid()
  ))
);

drop policy if exists "notebook_questions_own_all" on public.notebook_questions;
create policy "notebook_questions_own_all"
on public.notebook_questions for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (page_id is null or exists (
    select 1 from public.notebook_pages p where p.id = page_id and p.user_id = auth.uid()
  ))
);

drop policy if exists "notebook_ideas_own_all" on public.notebook_ideas;
create policy "notebook_ideas_own_all"
on public.notebook_ideas for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (page_id is null or exists (
    select 1 from public.notebook_pages p where p.id = page_id and p.user_id = auth.uid()
  ))
);
