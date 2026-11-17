-- Paisa: investments, a ledger of its own.
--
-- What went in and what came out, per investment and per goal. Nothing
-- here touches accounts, transactions, categories or budgets: an
-- investment is not spending, and the module was asked to stay separate.
-- There is no valuation either. No prices, no NAV, no interest maths: the
-- maturity figures of an FD or RD are what the user typed from the receipt.
--
-- Three tables:
--
--   investment_goals    Retirement, House... with an optional target.
--   investments         one holding: kind, goal, platform, folio, and
--                       either a schedule (SIP, RD...) or a maturity
--                       (FD, RD), or neither (a lump sum, stocks, gold).
--   investment_entries  each movement: invest (money in) or redeem (out).
--
-- A schedule posts its instalments itself, the same way recurring rules
-- post records, and it borrows their date arithmetic
-- (recurrence_occurrence / recurrence_after) so "monthly on the 31st"
-- means the same thing in both places.

-- ----------------------------------------------------------------- types ---

create type public.investment_kind as enum (
  'sip', 'mutual_fund', 'rd', 'fd', 'stock',
  'ppf', 'epf', 'nps', 'gold', 'crypto', 'other'
);

create type public.investment_entry_type as enum ('invest', 'redeem');

-- ----------------------------------------------------------------- goals ---

create table public.investment_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  tint public.tint not null default 'neutral',
  -- Optional. With one, a goal shows progress towards it; without, its
  -- share of everything invested.
  target_amount bigint check (target_amount is null or target_amount > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index investment_goals_user_name_key
  on public.investment_goals (user_id, lower(btrim(name)));

create index investment_goals_user_idx on public.investment_goals (user_id);

-- ----------------------------------------------------------- investments ---

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.investment_kind not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- Deleting a goal leaves its investments under "No goal".
  goal_id uuid references public.investment_goals (id) on delete set null,
  platform text check (platform is null or char_length(platform) <= 60),
  folio text check (folio is null or char_length(folio) <= 60),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_on date,

  -- Maturity, FD and RD only. Typed by the user, never calculated.
  interest_rate numeric(5, 2)
    check (interest_rate is null or (interest_rate >= 0 and interest_rate <= 100)),
  tenure_months integer
    check (tenure_months is null or tenure_months between 1 and 600),
  maturity_date date,
  maturity_amount bigint
    check (maturity_amount is null or maturity_amount > 0),

  -- Schedule, SIP / RD / PPF / EPF / NPS. All null when there is none.
  sched_amount bigint check (sched_amount is null or sched_amount > 0),
  frequency public.recurrence_frequency,
  interval_count integer
    check (interval_count is null or interval_count between 1 and 12),
  anchor_day smallint check (anchor_day is null or anchor_day between 1 and 31),
  start_date date,
  end_date date,
  installments_total integer
    check (installments_total is null or installments_total between 1 and 600),
  next_run_on date,
  last_run_on date,
  paused boolean not null default false,
  skipped_dates date[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A schedule is all of its parts or none of them.
  constraint investments_schedule_complete check (
    (sched_amount is null and frequency is null and interval_count is null
      and start_date is null and next_run_on is null)
    or
    (sched_amount is not null and frequency is not null
      and interval_count is not null and start_date is not null
      and next_run_on is not null)
  ),
  -- Only instalment-shaped kinds repeat, and SIPs and RDs always do.
  constraint investments_schedule_kind check (
    case
      when kind in ('sip', 'rd') then sched_amount is not null
      when kind in ('ppf', 'epf', 'nps') then true
      else sched_amount is null
    end
  ),
  -- Monthly or yearly; quarterly is monthly every 3.
  constraint investments_schedule_frequency check (
    frequency is null or frequency in ('monthly', 'yearly')
  ),
  constraint investments_end_after_start check (
    end_date is null or start_date is null or end_date >= start_date
  ),
  -- Maturity belongs to deposits, and a deposit has a maturity date.
  constraint investments_maturity_kind check (
    case
      when kind in ('fd', 'rd') then maturity_date is not null
      else maturity_date is null and maturity_amount is null
        and interest_rate is null and tenure_months is null
    end
  ),
  constraint investments_closed_on check (
    (status = 'open' and closed_on is null)
    or (status = 'closed' and closed_on is not null)
  )
);

create index investments_user_idx on public.investments (user_id, status);
create index investments_goal_idx on public.investments (goal_id);
create index investments_due_idx
  on public.investments (user_id, next_run_on)
  where sched_amount is not null and status = 'open' and not paused;

comment on table public.investments is
  'One holding in the investments ledger. Separate from accounts and transactions by design.';

-- ------------------------------------------------------------- entries -----

create table public.investment_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  investment_id uuid not null
    references public.investments (id) on delete cascade,
  type public.investment_entry_type not null,
  amount bigint not null check (amount > 0),
  -- For reference only: totals are always by amount.
  units numeric(20, 6) check (units is null or units > 0),
  price bigint check (price is null or price > 0),
  occurred_on date not null,
  note text check (note is null or char_length(note) <= 500),
  -- Posted by the schedule rather than typed. The index below keeps one
  -- per instalment date, which is what makes catch-up safe to repeat.
  scheduled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index investment_entries_investment_idx
  on public.investment_entries (investment_id, occurred_on desc);
create index investment_entries_user_idx
  on public.investment_entries (user_id, occurred_on);

create unique index investment_entries_scheduled_day_key
  on public.investment_entries (investment_id, occurred_on)
  where scheduled;

-- -------------------------------------------------------------- triggers ---

create trigger investment_goals_set_updated_at
  before update on public.investment_goals
  for each row execute function public.set_updated_at();

create trigger investments_set_updated_at
  before update on public.investments
  for each row execute function public.set_updated_at();

create trigger investment_entries_set_updated_at
  before update on public.investment_entries
  for each row execute function public.set_updated_at();

-- The anchor follows the start day unless set alongside it.
create trigger investments_set_anchor
  before insert or update of start_date, anchor_day
  on public.investments
  for each row
  when (new.start_date is not null)
  execute function public.set_recurrence_anchor();

-- A goal and an investment can only point at the owner's own rows. RLS
-- stops reading someone else's goal, but not naming its id.
create or replace function public.check_investment_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.goal_id is not null and not exists (
    select 1 from public.investment_goals g
    where g.id = new.goal_id and g.user_id = new.user_id
  ) then
    raise exception 'goal % does not belong to user %', new.goal_id, new.user_id
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger investments_check_refs
  before insert or update of user_id, goal_id
  on public.investments
  for each row execute function public.check_investment_refs();

create or replace function public.check_investment_entry_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.investments i
    where i.id = new.investment_id and i.user_id = new.user_id
  ) then
    raise exception 'investment % does not belong to user %',
      new.investment_id, new.user_id
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger investment_entries_check_refs
  before insert or update of user_id, investment_id
  on public.investment_entries
  for each row execute function public.check_investment_entry_refs();

-- ------------------------------------------------------------------- RLS ---

alter table public.investment_goals enable row level security;
alter table public.investments enable row level security;
alter table public.investment_entries enable row level security;

create policy "investment_goals_select_own"
  on public.investment_goals for select to authenticated
  using (user_id = (select auth.uid()));
create policy "investment_goals_insert_own"
  on public.investment_goals for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "investment_goals_update_own"
  on public.investment_goals for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "investment_goals_delete_own"
  on public.investment_goals for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "investments_select_own"
  on public.investments for select to authenticated
  using (user_id = (select auth.uid()));
create policy "investments_insert_own"
  on public.investments for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "investments_update_own"
  on public.investments for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "investments_delete_own"
  on public.investments for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "investment_entries_select_own"
  on public.investment_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "investment_entries_insert_own"
  on public.investment_entries for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "investment_entries_update_own"
  on public.investment_entries for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "investment_entries_delete_own"
  on public.investment_entries for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- totals ---

-- Never stored, like account balances: worked out from the entries.
create view public.investment_summary
with (security_invoker = true)
as
select
  i.id as investment_id,
  i.user_id,
  coalesce(sum(e.amount) filter (where e.type = 'invest'), 0)::bigint
    as invested,
  coalesce(sum(e.amount) filter (where e.type = 'redeem'), 0)::bigint
    as redeemed,
  (coalesce(sum(e.amount) filter (where e.type = 'invest'), 0)
    - coalesce(sum(e.amount) filter (where e.type = 'redeem'), 0))::bigint
    as net,
  count(e.id)::integer as entry_count,
  max(e.occurred_on) as last_entry_on
from public.investments i
left join public.investment_entries e on e.investment_id = i.id
group by i.id, i.user_id;

comment on view public.investment_summary is
  'Per investment: invested, redeemed, net (invested minus redeemed), entry count.';

grant select on table public.investment_summary to authenticated;
revoke all on table public.investment_summary from anon;

-- ------------------------------------------------------------ the engine ---

-- Posts every instalment an open, unpaused schedule owes up to today.
-- Returns how many it posted. Safe to call repeatedly: the cursor moves
-- past what it wrote, and the unique index refuses a second copy of any
-- instalment that a racing call already wrote.
create or replace function public.process_due_investments()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  c_max_per_investment constant integer := 500;
  v_user uuid := (select auth.uid());
  v_today date;
  v_inv record;
  v_cursor date;
  v_last date;
  v_steps integer;
  v_id uuid;
  v_created integer := 0;
begin
  if v_user is null then
    raise exception 'process_due_investments() needs an authenticated user'
      using errcode = '42501';
  end if;

  v_today := (now() at time zone public.user_timezone())::date;

  for v_inv in
    select i.*
    from public.investments i
    where i.user_id = v_user
      and i.status = 'open'
      and not i.paused
      and i.sched_amount is not null
      and i.next_run_on <= v_today
      and (i.end_date is null or i.next_run_on <= i.end_date)
    order by i.next_run_on, i.id
    for update
  loop
    v_cursor := public.recurrence_after(
      v_inv.start_date, v_inv.frequency, v_inv.interval_count,
      v_inv.anchor_day, v_inv.next_run_on
    );
    v_last := null;
    v_steps := 0;

    while v_cursor <= v_today
      and (v_inv.end_date is null or v_cursor <= v_inv.end_date)
      and v_steps < c_max_per_investment
    loop
      if not (v_cursor = any (v_inv.skipped_dates)) then
        v_id := null;

        insert into public.investment_entries (
          user_id, investment_id, type, amount, occurred_on, scheduled
        )
        values (
          v_user, v_inv.id, 'invest', v_inv.sched_amount, v_cursor, true
        )
        on conflict do nothing
        returning id into v_id;

        if v_id is not null then
          v_created := v_created + 1;
          v_last := v_cursor;
        end if;
      end if;

      v_steps := v_steps + 1;
      v_cursor := public.recurrence_after(
        v_inv.start_date, v_inv.frequency, v_inv.interval_count,
        v_inv.anchor_day, v_cursor + 1
      );
    end loop;

    update public.investments i
    set
      next_run_on = v_cursor,
      last_run_on = coalesce(v_last, i.last_run_on)
    where i.id = v_inv.id;
  end loop;

  return v_created;
end;
$$;

comment on function public.process_due_investments() is
  'Posts the instalments every open, unpaused investment schedule of the caller owes up to today. Returns how many.';

-- ------------------------------------------------------------------ skip ---

-- Skips the next instalment: remembered, so catch-up passes over it, and
-- the cursor moves to the one after. Returns the new next date.
create or replace function public.skip_investment_installment(
  p_investment_id uuid
)
returns date
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_inv public.investments;
  v_cursor date;
  v_next date;
begin
  if v_user is null then
    raise exception 'skip_investment_installment() needs an authenticated user'
      using errcode = '42501';
  end if;

  select * into v_inv
  from public.investments i
  where i.id = p_investment_id and i.user_id = v_user
  for update;

  if v_inv.id is null then
    raise exception 'no such investment' using errcode = 'P0002';
  end if;

  if v_inv.sched_amount is null then
    raise exception 'this investment has no schedule' using errcode = '22023';
  end if;

  v_cursor := public.recurrence_after(
    v_inv.start_date, v_inv.frequency, v_inv.interval_count,
    v_inv.anchor_day, v_inv.next_run_on
  );

  while v_cursor = any (v_inv.skipped_dates) loop
    v_cursor := public.recurrence_after(
      v_inv.start_date, v_inv.frequency, v_inv.interval_count,
      v_inv.anchor_day, v_cursor + 1
    );
  end loop;

  v_next := public.recurrence_after(
    v_inv.start_date, v_inv.frequency, v_inv.interval_count,
    v_inv.anchor_day, v_cursor + 1
  );

  update public.investments i
  set
    skipped_dates = i.skipped_dates || v_cursor,
    next_run_on = v_next
  where i.id = p_investment_id;

  return v_next;
end;
$$;

comment on function public.skip_investment_installment(uuid) is
  'Skips the next instalment of an investment schedule. Returns the new next date.';

-- ---------------------------------------------------------------- payout ---

-- Records what a deposit paid out and, usually, closes it, in one step so
-- the money and the status cannot disagree.
create or replace function public.record_investment_payout(
  p_investment_id uuid,
  p_amount bigint,
  p_on date,
  p_close boolean default true
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then
    raise exception 'record_investment_payout() needs an authenticated user'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.investments i
    where i.id = p_investment_id and i.user_id = v_user
  ) then
    raise exception 'no such investment' using errcode = 'P0002';
  end if;

  insert into public.investment_entries (
    user_id, investment_id, type, amount, occurred_on, note
  )
  values (v_user, p_investment_id, 'redeem', p_amount, p_on, 'Maturity payout')
  returning id into v_id;

  if p_close then
    update public.investments i
    set status = 'closed', closed_on = p_on
    where i.id = p_investment_id;
  end if;

  return v_id;
end;
$$;

comment on function public.record_investment_payout(uuid, bigint, date, boolean) is
  'Records a redemption for a matured deposit and optionally closes it. Returns the entry id.';

grant execute on function
  public.process_due_investments(),
  public.skip_investment_installment(uuid),
  public.record_investment_payout(uuid, bigint, date, boolean)
to authenticated;

revoke execute on function
  public.process_due_investments(),
  public.skip_investment_installment(uuid),
  public.record_investment_payout(uuid, bigint, date, boolean)
from anon, public;
