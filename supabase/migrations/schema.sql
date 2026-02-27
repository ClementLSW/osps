-- ══════════════════════════════════════════════════════════════════════
-- O$P$ (Owe Money, Pay Money) — Complete Database Schema
-- ══════════════════════════════════════════════════════════════════════
--
-- Expense splitting app for friend groups.
-- Run this in Supabase SQL Editor for a fresh setup.
--
-- Overview:
--   9 tables covering user profiles, groups, expenses with 5 split
--   modes, line-item-level receipt data, debt settlements, and pending
--   email invites. Row Level Security on every table. Two server-side
--   helper functions for profile auto-creation and email-based user
--   lookup.
--
-- Key relationships:
--   auth.users → profiles (1:1, auto-created via trigger)
--   groups → group_members → profiles (many-to-many)
--   groups → expenses → expense_splits (per-person owed amounts)
--   expenses → line_items → line_item_assignments (item-level splits)
--   groups → settlements (direct payments between members)
--   groups → pending_invites (pre-signup invite tracking)
--
-- Multi-currency:
--   Each group has a home currency. Expenses can be logged in a
--   foreign currency — original_currency, original_amount, and
--   exchange_rate store the conversion. total_amount is always in
--   the group's home currency. Splits, balances, and settlements
--   operate exclusively on total_amount.
--


-- ══════════════════════════════════════════════════════════
-- TABLES
-- ══════════════════════════════════════════════════════════

-- User profiles — extends Supabase auth.users with display name and avatar.
-- Auto-populated on signup via the handle_new_user() trigger.
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz default now()
);

-- Groups — a shared context for splitting expenses.
-- Each group has a home currency, an invite code for joining via link,
-- and optional date ranges for trips/events. type determines UX presets;
-- the underlying data model is the same for all types.
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

-- Group membership — links users to groups with a role.
-- Admins can edit/delete the group and remove members.
-- Composite primary key prevents duplicate membership.
create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- Expenses — a single payment made by one member on behalf of the group.
-- total_amount is always in the group's home currency. For foreign currency
-- expenses, original_currency/original_amount store what was actually paid,
-- exchange_rate stores the locked conversion rate, and exchange_rate_at
-- records when that rate was fetched. Domestic expenses leave these NULL.
-- receipt_url points to a Supabase Storage path (receipts/{groupId}/{expenseId}.jpg).
-- split_mode determines how total_amount is divided among members.
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
  original_currency text,
  original_amount   numeric,
  exchange_rate     numeric(18,10),
  exchange_rate_at  timestamptz,
  confirmed_at  timestamptz,
  confirmed_by  uuid references public.profiles(id),
  created_at    timestamptz default now(),
  created_by    uuid not null references public.profiles(id)
);

-- Expense splits — how much each member owes for a given expense.
-- Computed client-side based on split_mode, then stored as flat amounts
-- in the group's home currency. Used by the reconciliation algorithm
-- to calculate net balances and simplified debt transactions.
create table public.expense_splits (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references public.expenses(id) on delete cascade,
  user_id     uuid not null references public.profiles(id),
  owed_amount numeric(12,2) not null,
  unique (expense_id, user_id)
);

-- Line items — individual items on a receipt (e.g. "Nasi Goreng", "Bintang").
-- Populated by OCR receipt scanning or manual entry. Persisted regardless
-- of split_mode for transparency — even if the expense is split equally,
-- the itemised breakdown is kept for reference.
create table public.line_items (
  id         uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  name       text not null,
  amount     numeric(12,2) not null check (amount > 0),
  quantity   int not null default 1,
  sort_order int not null default 0
);

-- Line item assignments — which members share each line item.
-- Used in line_item split mode to compute per-person costs.
-- share_count allows unequal splits per item (e.g. "I had 2 of those").
create table public.line_item_assignments (
  line_item_id uuid not null references public.line_items(id) on delete cascade,
  user_id      uuid not null references public.profiles(id),
  share_count  int not null default 1,
  primary key (line_item_id, user_id)
);

-- Settlements — records a real-world payment between two members.
-- "Alice paid Bob $50 to settle up." Subtracted from net balances
-- by the reconciliation algorithm.
create table public.settlements (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  paid_by    uuid not null references public.profiles(id),
  paid_to    uuid not null references public.profiles(id),
  amount     numeric(12,2) not null check (amount > 0),
  settled_at timestamptz default now(),
  note       text
);

-- Pending invites — tracks email invitations for users who haven't signed up yet.
-- When an existing user is invited, they're added to group_members directly.
-- When a new user is invited, a row is created here and Supabase sends them
-- a signup email. On first login, auth-claim-invites.mjs reads this table
-- and auto-joins them to the invited groups.
-- Accessed only via service role key from Netlify Functions — blocked for clients.
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
-- Foreign key columns used in JOINs and WHERE clauses.
-- Speeds up group listing, expense loading, and balance computation.

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
-- Every table has RLS enabled. Policies follow the principle of least
-- privilege: users can only see and modify data in groups they belong to.
-- All auth.uid() calls are wrapped in (select auth.uid()) so Postgres
-- evaluates it once per query rather than once per row.

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.line_items enable row level security;
alter table public.line_item_assignments enable row level security;
alter table public.settlements enable row level security;
alter table public.pending_invites enable row level security;

-- Helper: returns true if the current user is a member of the given group.
-- Used by most RLS policies to gate access. Security definer so it can
-- read group_members regardless of the caller's RLS context.
create or replace function public.is_group_member(gid uuid)
returns boolean as $$
  select exists(
    select 1 from public.group_members
    where group_id = gid and user_id = (select auth.uid())
  );
$$ language sql security definer stable
set search_path = '';

-- ── Profiles ────────────────────────────────────────────
-- Public read (display names shown across groups), self-only write.

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
-- Public read (needed for invite link join flow — user must see group
-- name before joining). Only the creator can insert. Admins can
-- update and delete.

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
-- Members can see who else is in the group. Users can add themselves
-- (join via invite link). Admins can remove anyone; members can
-- remove themselves (leave group).

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
-- Group members can view and create. Only the creator or a group
-- admin can update or delete.

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
-- Access gated through parent expense's group membership.

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

create policy "Creator or admin can delete splits"
  on public.expense_splits for delete
  using (
    expense_id in (
      select id from public.expenses
      where created_by = (select auth.uid())
      or group_id in (
        select group_id from public.group_members
        where user_id = (select auth.uid()) and role = 'admin'
      )
    )
  );

-- ── Line Items ──────────────────────────────────────────
-- Access gated through parent expense's group membership.

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

create policy "Creator or admin can delete line items"
  on public.line_items for delete
  using (
    expense_id in (
      select id from public.expenses
      where created_by = (select auth.uid())
      or group_id in (
        select group_id from public.group_members
        where user_id = (select auth.uid()) and role = 'admin'
      )
    )
  );

-- ── Line Item Assignments ───────────────────────────────
-- Access gated through parent line item → expense → group membership.

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
-- Group members can view all settlements. Only the payer can
-- record a settlement (paid_by must match current user).

create policy "Members can view settlements"
  on public.settlements for select
  using (public.is_group_member(group_id));

create policy "Members can create settlements"
  on public.settlements for insert
  with check (public.is_group_member(group_id) and paid_by = (select auth.uid()));

-- ── Pending Invites ─────────────────────────────────────
-- Server-only table. Netlify Functions use the service role key to
-- read/write. All client-side access is blocked.

create policy "No direct access to pending invites"
  on public.pending_invites for select
  using (false);


-- ══════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ══════════════════════════════════════════════════════════

-- Auto-create a profile row when a new user signs up via Supabase Auth.
-- Pulls display_name from Google OAuth metadata (full_name) or falls
-- back to the email username. Runs as security definer to write to
-- the profiles table regardless of RLS.
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

-- Auto-add the group creator as an admin member when a group is created.
-- Eliminates the race condition of separate insert-group + insert-member
-- queries from the client. Works for any code path that creates a group.
create or replace function public.handle_new_group()
returns trigger as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$ language plpgsql security definer
set search_path = '';

create or replace trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- Look up a user's auth.users ID by email address.
-- Used by the smart invite flow (auth-invite.mjs) to check if an
-- invited email belongs to an existing user. Security definer allows
-- reading auth.users which is otherwise inaccessible to client queries.
create or replace function public.get_user_id_by_email(lookup_email text)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select id from auth.users where email = lower(lookup_email) limit 1;
$$;
