-- Content OS lifecycle fields
-- Adds the columns the publishing workflow needs beyond title/platform/status:
--   * content_type  — what kind of asset this is (Post, Article, Newsletter, …)
--   * purpose       — why the piece exists / which priority it supports
--   * scheduled_for — target publish date (used to answer "what's next")
--   * notes         — repurposing ideas, source material, follow-ups
-- All additive and nullable/defaulted, so existing rows keep working.

alter table public.content_items
  add column if not exists content_type text not null default 'Post',
  add column if not exists purpose text not null default '',
  add column if not exists scheduled_for date,
  add column if not exists notes text not null default '';

create index if not exists content_items_scheduled_for_idx
  on public.content_items(scheduled_for);
