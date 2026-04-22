-- Align existing pipeline configuration with the 5-article morning run target.
alter table public.pipeline_config
  alter column headlines_to_fetch set default 5;

update public.pipeline_config
set headlines_to_fetch = 5,
    updated_at = now();
