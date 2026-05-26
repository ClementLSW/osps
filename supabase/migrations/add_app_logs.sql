create table public.app_logs (
  id         uuid primary key default gen_random_uuid(),
  event      text not null,
  level      text not null default 'error' check (level in ('info', 'warn', 'error')),
  user_id    uuid references public.profiles(id) on delete set null,
  payload    jsonb,
  created_at timestamptz default now()
);

alter table public.app_logs enable row level security;

-- Users can write their own logs (client-side events)
create policy "Users can insert own logs"
  on public.app_logs for insert
  with check (user_id = (select auth.uid()) or user_id is null);

-- No client reads — query via Dashboard SQL editor only
create policy "No client reads"
  on public.app_logs for select
  using (false);

create index idx_app_logs_event   on public.app_logs(event);
create index idx_app_logs_created on public.app_logs(created_at desc);
