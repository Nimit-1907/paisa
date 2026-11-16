-- Paisa: row level security.
--
-- One rule, applied six times: you may only touch rows that are yours.
-- Policies are written for the `authenticated` role only, anon gets nothing,
-- and the privileged server-side role bypasses RLS by design, which is what
-- migrations and seeds rely on.
--
-- auth.uid() is wrapped in a scalar subquery so the planner evaluates it once
-- per statement (an initPlan) instead of once per row.

-- ------------------------------------------------------------- profiles ----

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles_delete_own"
  on public.profiles for delete to authenticated
  using (id = (select auth.uid()));

-- ------------------------------------------------------------- accounts ----

alter table public.accounts enable row level security;

create policy "accounts_select_own"
  on public.accounts for select to authenticated
  using (user_id = (select auth.uid()));

create policy "accounts_insert_own"
  on public.accounts for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "accounts_update_own"
  on public.accounts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "accounts_delete_own"
  on public.accounts for delete to authenticated
  using (user_id = (select auth.uid()));

-- ----------------------------------------------------------- categories ----

alter table public.categories enable row level security;

create policy "categories_select_own"
  on public.categories for select to authenticated
  using (user_id = (select auth.uid()));

create policy "categories_insert_own"
  on public.categories for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "categories_update_own"
  on public.categories for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "categories_delete_own"
  on public.categories for delete to authenticated
  using (user_id = (select auth.uid()));

-- --------------------------------------------------------- transactions ----

alter table public.transactions enable row level security;

create policy "transactions_select_own"
  on public.transactions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "transactions_insert_own"
  on public.transactions for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "transactions_update_own"
  on public.transactions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "transactions_delete_own"
  on public.transactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- -------------------------------------------------------------- budgets ----

alter table public.budgets enable row level security;

create policy "budgets_select_own"
  on public.budgets for select to authenticated
  using (user_id = (select auth.uid()));

create policy "budgets_insert_own"
  on public.budgets for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "budgets_update_own"
  on public.budgets for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "budgets_delete_own"
  on public.budgets for delete to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------ recurring rules ----

alter table public.recurring_rules enable row level security;

create policy "recurring_rules_select_own"
  on public.recurring_rules for select to authenticated
  using (user_id = (select auth.uid()));

create policy "recurring_rules_insert_own"
  on public.recurring_rules for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "recurring_rules_update_own"
  on public.recurring_rules for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "recurring_rules_delete_own"
  on public.recurring_rules for delete to authenticated
  using (user_id = (select auth.uid()));

-- --------------------------------------------------------------- grants ----
-- Supabase's default privileges already cover tables created here; spelling
-- them out keeps the file honest about who is meant to reach what.

grant select, insert, update, delete on table
  public.profiles,
  public.accounts,
  public.categories,
  public.transactions,
  public.budgets,
  public.recurring_rules
to authenticated;

revoke all on table
  public.profiles,
  public.accounts,
  public.categories,
  public.transactions,
  public.budgets,
  public.recurring_rules
from anon;
