-- Extend workflow_runs status to include 'cancelled'
alter table workflow_runs drop constraint if exists workflow_runs_status_check;
alter table workflow_runs add constraint workflow_runs_status_check
  check (status in ('running', 'completed', 'failed', 'cancelled'));

-- Add cancel_requested_at for observability
alter table workflow_runs add column if not exists cancel_requested_at timestamptz;

-- Pipeline config table (single-row pattern)
create table if not exists pipeline_config (
  id uuid primary key default gen_random_uuid(),
  headlines_to_fetch integer not null default 6,
  publish_status text not null default 'draft' check (publish_status in ('draft', 'publish')),
  target_sites text[] not null default '{}',
  writer_model text not null default 'claude-sonnet-4-20250514',
  image_model text not null default 'gpt-image-1',
  updated_at timestamptz default now()
);

-- Seed default config row if empty
insert into pipeline_config (headlines_to_fetch, publish_status, target_sites, writer_model, image_model)
select 6, 'draft', '{}', 'claude-sonnet-4-20250514', 'gpt-image-1'
where not exists (select 1 from pipeline_config);
