-- Add headlines_date to pipeline_config
-- Values: 'today', 'yesterday', or custom range 'MMDDYYYY-MMDDYYYY'
alter table pipeline_config add column if not exists headlines_date text not null default 'today';
