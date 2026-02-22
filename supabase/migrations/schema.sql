-- O$P$ — Complete Database Schema
-- Run this in Supabase SQL Editor for a fresh setup.
--
-- Consolidates all migrations:
--   001 — Core tables, RLS, triggers
--   002 — Group types + expense confirmation
--   003 — Pending invites
--   004 — User lookup by email (for smart invites)
--   005 — Group delete policy

-- ══════════════════════════════════════════════════════════
-- TABLES
-- ══════════════════════════════════════════════════════════

-- Extends Supabase auth.users with app-specific profile data
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz default now()
);

create table public.groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  currency     text not null default 'SGD',
  created_by   uuid not null references public.profiles(id),
  invite_code  text unique not null default encode(gen_random_bytes(6), 'hex'),
  is_settled   boolean default false,
  type         text not null default 'ongoing' check (type in ('ongoing', 'trip', 'event')),
  category     text,
  start_date   date,
  end_date     date,
  created_at   timestamptz default now()
);

create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id) on delete cascade,
  paid_by       uuid not null references public.profiles(id),
  title         text not null,
  total_amount  numeric(12,2) not null check (total_amount > 0),
  currency      text not null default 'SGD',
  split_mode    text not null check (split_mode in (
                  'equal', 'exact', 'percentage', 'shares', 'line_item'
                )),
  receipt_url   text,
  notes         text,
  expense_date  date not null default current_date,
  confirmed_at  timestamptz,
  confirmed_by  uuid references public.profiles(id),
  created_at    timestamptz default now(),
  created_by    uuid not null references public.profiles(id)
);

create table public.expense_splits (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references public.expenses(id) on delete cascade,
  user_id     uuid not null references public.profiles(id),
  owed_amount numeric(12,2) not null,
  unique (expense_id, user_id)
);

create table public.line_items (
  id         uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  name       text not null,
  amount     numeric(12,2) not null check (amount > 0),
  quantity   int not null default 1,
  sort_order int not null default 0
);

create table public.line_item_assignments (
  line_item_id uuid not null references public.line_items(id) on delete cascade,
  user_id      uuid not null references public.profiles(id),
  share_count  int not null default 1,
  primary key (line_item_id, user_id)
);

create table public.settlements (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  paid_by    uuid not null references public.profiles(id),
  paid_to    uuid not null references public.profiles(id),
  amount     numeric(12,2) not null check (amount > 0),
  settled_at timestamptz default now(),
  note       text
);

create table public.pending_invites (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  group_id   uuid not null references public.groups(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

-- ══════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════

create index idx_group_members_user    on public.group_members(user_id);
create index idx_expenses_group        on public.expenses(group_id);
create index idx_expenses_date         on public.expenses(expense_date desc);
create index idx_expense_splits_expense on public.expense_splits(expense_id);
create index idx_expense_splits_user   on public.expense_splits(user_id);
create index idx_line_items_expense    on public.line_items(expense_id);
create index idx_settlements_group     on public.settlements(group_id);
create index idx_pending_invites_email on public.pending_invites(email);

-- ══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.line_items enable row level security;
alter table public.line_item_assignments enable row level security;
alter table public.settlements enable row level security;
alter table public.pending_invites enable row level security;

-- Helper: check if current user is a member of a group
create or replace function public.is_group_member(gid uuid)
returns boolean as $$
  select exists(
    select 1 from public.group_members
    where group_id = gid and user_id = (select auth.uid())
  );
$$ language sql security definer stable
set search_path = '';

-- ── Profiles ────────────────────────────────────────────

create policy "Users can view any profile"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (id = (select auth.uid()));

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (id = (select auth.uid()));

-- ── Groups ──────────────────────────────────────────────

create policy "Anyone can view group by invite code"
  on public.groups for select
  using (true);

create policy "Authenticated users can create groups"
  on public.groups for insert
  with check ((select auth.uid()) = created_by);

create policy "Admins can update their groups"
  on public.groups for update
  using (
    id in (
      select group_id from public.group_members
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );

create policy "Admins can delete their groups"
  on public.groups for delete
  using (
    id in (
      select group_id from public.group_members
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );

-- ── Group Members ───────────────────────────────────────

create policy "Members can view group members"
  on public.group_members for select
  using (public.is_group_member(group_id));

create policy "Users can join groups"
  on public.group_members for insert
  with check (user_id = (select auth.uid()));

create policy "Admins can remove members"
  on public.group_members for delete
  using (
    user_id = (select auth.uid())
    or group_id in (
      select group_id from public.group_members
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );

-- ── Expenses ────────────────────────────────────────────

create policy "Members can view group expenses"
  on public.expenses for select
  using (public.is_group_member(group_id));

create policy "Members can create expenses"
  on public.expenses for insert
  with check (public.is_group_member(group_id) and created_by = (select auth.uid()));

create policy "Creator or admin can update expenses"
  on public.expenses for update
  using (
    created_by = (select auth.uid())
    or group_id in (
      select group_id from public.group_members
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );

create policy "Creator or admin can delete expenses"
  on public.expenses for delete
  using (
    created_by = (select auth.uid())
    or group_id in (
      select group_id from public.group_members
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );

-- ── Expense Splits ──────────────────────────────────────

create policy "Members can view splits"
  on public.expense_splits for select
  using (
    expense_id in (
      select id from public.expenses where public.is_group_member(group_id)
    )
  );

create policy "Members can create splits"
  on public.expense_splits for insert
  with check (
    expense_id in (
      select id from public.expenses where public.is_group_member(group_id)
    )
  );

create policy "Members can delete splits"
  on public.expense_splits for delete
  using (
    expense_id in (
      select id from public.expenses
      where created_by = (select auth.uid()) or public.is_group_member(group_id)
    )
  );

-- ── Line Items ──────────────────────────────────────────

create policy "Members can view line items"
  on public.line_items for select
  using (
    expense_id in (
      select id from public.expenses where public.is_group_member(group_id)
    )
  );

create policy "Members can create line items"
  on public.line_items for insert
  with check (
    expense_id in (
      select id from public.expenses where public.is_group_member(group_id)
    )
  );

create policy "Members can delete line items"
  on public.line_items for delete
  using (
    expense_id in (
      select id from public.expenses
      where created_by = (select auth.uid()) or public.is_group_member(group_id)
    )
  );

-- ── Line Item Assignments ───────────────────────────────

create policy "Members can view assignments"
  on public.line_item_assignments for select
  using (
    line_item_id in (
      select li.id from public.line_items li
      join public.expenses e on e.id = li.expense_id
      where public.is_group_member(e.group_id)
    )
  );

create policy "Members can create assignments"
  on public.line_item_assignments for insert
  with check (
    line_item_id in (
      select li.id from public.line_items li
      join public.expenses e on e.id = li.expense_id
      where public.is_group_member(e.group_id)
    )
  );

-- ── Settlements ─────────────────────────────────────────

create policy "Members can view settlements"
  on public.settlements for select
  using (public.is_group_member(group_id));

create policy "Members can create settlements"
  on public.settlements for insert
  with check (public.is_group_member(group_id) and paid_by = (select auth.uid()));

-- ── Pending Invites ─────────────────────────────────────
-- Accessed only via service role key from Netlify Functions.
-- No client-side RLS policies needed — block all direct access.

create policy "No direct access to pending invites"
  on public.pending_invites for select
  using (false);

-- ══════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer
set search_path = '';

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Look up a user's ID by email (used by smart invite flow).
-- Security definer allows reading auth.users from the service role.
create or replace function public.get_user_id_by_email(lookup_email text)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select id from auth.users where email = lower(lookup_email) limit 1;
$$;
