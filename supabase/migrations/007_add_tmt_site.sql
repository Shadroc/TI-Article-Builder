-- Add The Markets Today (tmt) WordPress site
insert into public.sites (name, slug, wp_base_url, active, category_map)
values (
  'The Markets Today',
  'tmt',
  'https://themarketstoday.com',
  true,
  '{"Finance":{"id":7,"color":"#00AB76"},"Technology":{"id":6,"color":"#067BC2"},"Energy":{"id":5,"color":"#dc6a3f"},"Business":{"id":2,"color":"#4a90d9"},"Health":{"id":4,"color":"#663300"},"Culture":{"id":1,"color":"#C2C6A2"},"Food & Health":{"id":4,"color":"#663300"}}'::jsonb
);
