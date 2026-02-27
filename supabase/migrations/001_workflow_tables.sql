-- Workflow run tracking
create table if not exists workflow_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  trigger text not null check (trigger in ('cron', 'manual')),
  article_count integer default 0,
  error text,
  started_at timestamptz default now(),
  finished_at timestamptz
);

create index idx_workflow_runs_status on workflow_runs (status);
create index idx_workflow_runs_started_at on workflow_runs (started_at desc);

-- Per-step tracking within a run
create table if not exists workflow_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references workflow_runs(id) on delete cascade,
  article_index integer not null,
  step_name text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'skipped')),
  input_summary text,
  output_summary text,
  error text,
  started_at timestamptz default now(),
  finished_at timestamptz
);

create index idx_workflow_steps_run_id on workflow_steps (run_id);
create index idx_workflow_steps_status on workflow_steps (status);

-- Add wp_post_id and wp_media_id columns to ai_articles if they don't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'ai_articles' and column_name = 'wp_post_id'
  ) then
    alter table ai_articles add column wp_post_id integer;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'ai_articles' and column_name = 'wp_media_id'
  ) then
    alter table ai_articles add column wp_media_id integer;
  end if;
end $$;

-- Add unique constraint on rss_feed.link for idempotent upserts
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rss_feed_link_unique'
  ) then
    alter table rss_feed add constraint rss_feed_link_unique unique (link);
  end if;
end $$;
