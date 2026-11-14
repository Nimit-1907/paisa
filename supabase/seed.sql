-- Paisa: local demo data.
--
-- Runs after the migrations on every `supabase db reset`. Creates one signed-up
-- user you can log in as:
--
--     demo@example.com / password123
--
-- and roughly three months of plausible Indian spending, anchored to the day
-- the seed runs so the current month is always partially filled.
--
-- Amounts are paise. ₹1 = 100.

-- --------------------------------------------------------------- the user --

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'demo@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Demo User"}'::jsonb,
  now() - interval '4 months',
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

-- GoTrue refuses to sign in a user with no matching identity row.
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  jsonb_build_object(
    'sub', '11111111-1111-4111-8111-111111111111',
    'email', 'demo@example.com',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now() - interval '4 months',
  now()
)
on conflict do nothing;

-- The signup trigger has already created the profile, a Cash account and the
-- default categories.

-- ------------------------------------------------------------- the money --

do $$
declare
  c_user constant uuid := '11111111-1111-4111-8111-111111111111';
  c_tz constant text := 'Asia/Kolkata';

  v_today date := (now() at time zone c_tz)::date;
  v_cash uuid;
  v_bank uuid;
  v_card uuid;
  v_wallet uuid;

  v_month_start date;
  v_day date;
  v_amount bigint;
  v_account uuid;
  v_category uuid;
  v_month_offset integer;
  v_entry record;
  v_rule uuid;
begin
  -- Deterministic jitter: the same reset twice produces the same numbers.
  perform setseed(0.4242);

  update public.profiles
  set display_name = 'Demo User',
      timezone = c_tz
  where id = c_user;

  -- Accounts ---------------------------------------------------------------
  update public.accounts
  set initial_balance = 480000,  -- ₹4,800 in the wallet on day one
      icon = 'Wallet',
      color = '#0F766E',
      sort_order = 0
  where user_id = c_user and name = 'Cash'
  returning id into v_cash;

  insert into public.accounts (
    user_id, name, type, icon, color, initial_balance, sort_order
  )
  values (c_user, 'HDFC Savings', 'bank', 'Landmark', '#2563EB', 14250000, 1)
  returning id into v_bank;

  insert into public.accounts (
    user_id, name, type, icon, color, initial_balance, include_in_total, sort_order
  )
  values (c_user, 'ICICI Credit Card', 'card', 'CreditCard', '#DB2777', 0, true, 2)
  returning id into v_card;

  insert into public.accounts (
    user_id, name, type, icon, color, initial_balance, sort_order
  )
  values (c_user, 'Paytm Wallet', 'wallet', 'Smartphone', '#7C3AED', 125000, 3)
  returning id into v_wallet;

  -- Three months of records ------------------------------------------------
  -- v_month_offset 2 = two months ago … 0 = this month (partial).
  for v_month_offset in reverse 2 .. 0 loop
    v_month_start := date_trunc('month', v_today - make_interval(months => v_month_offset))::date;

    for v_entry in
      select *
      from (
        values
          -- day, kind,      category,        note,                              min paise, max paise, account
          ( 1, 'income',  'Salary',        'Salary credited',                   8500000, 8500000, 'bank'),
          ( 3, 'expense', 'Rent',          'Rent — landlord UPI',               2200000, 2200000, 'bank'),
          ( 3, 'expense', 'Bills',         'Jio postpaid',                        79900,   79900, 'card'),
          ( 4, 'expense', 'Groceries',     'BigBasket monthly stock-up',         320000,  480000, 'card'),
          ( 5, 'expense', 'Bills',         'Electricity bill',                   145000,  260000, 'bank'),
          ( 6, 'expense', 'Food',          'Swiggy — biryani',                    32000,   52000, 'card'),
          ( 7, 'expense', 'Transport',     'Auto to office',                       6000,   12000, 'cash'),
          ( 8, 'expense', 'Fuel',          'Petrol — Indian Oil',                 150000,  250000, 'card'),
          ( 9, 'expense', 'Food',          'Chai and vada pav',                    4000,    9000, 'cash'),
          (10, 'expense', 'Entertainment', 'Netflix',                              64900,   64900, 'card'),
          (11, 'expense', 'Groceries',     'DMart run',                           95000,  180000, 'card'),
          (12, 'expense', 'Health',        'Apollo Pharmacy',                     38000,   92000, 'wallet'),
          (13, 'expense', 'Food',          'Zomato — team lunch',                 45000,   78000, 'card'),
          (14, 'expense', 'Transport',     'Metro card recharge',                 50000,   50000, 'wallet'),
          (16, 'expense', 'Shopping',      'Amazon — household',                  120000,  340000, 'card'),
          (17, 'expense', 'Food',          'Dinner at Barbeque Nation',           180000,  260000, 'card'),
          (18, 'expense', 'Transport',     'Ola to airport',                       45000,   85000, 'wallet'),
          (19, 'expense', 'Bills',         'Broadband — ACT Fibernet',             99900,   99900, 'bank'),
          (20, 'expense', 'Groceries',     'Vegetables — local market',            28000,   62000, 'cash'),
          (21, 'expense', 'Entertainment', 'PVR — movie night',                    52000,   90000, 'card'),
          (22, 'expense', 'Food',          'Office canteen top-up',                20000,   35000, 'wallet'),
          (23, 'expense', 'Fuel',          'Petrol — HP',                         120000,  220000, 'card'),
          (24, 'expense', 'Health',        'Gym membership',                      120000,  120000, 'bank'),
          (25, 'expense', 'Shopping',      'Myntra — kurta',                       80000,  260000, 'card'),
          (26, 'expense', 'Food',          'Weekend brunch',                       60000,  120000, 'card'),
          (27, 'expense', 'Others',        'Haircut',                              25000,   40000, 'cash'),
          (28, 'expense', 'Education',     'Udemy course',                         44900,   89900, 'card')
      ) as t (
        day_of_month, kind, category_name, note, min_paise, max_paise, account_name
      )
    loop
      v_day := v_month_start + (v_entry.day_of_month - 1);

      -- The current month only runs up to today.
      continue when v_day > v_today;

      v_amount := v_entry.min_paise
        + floor(random() * (v_entry.max_paise - v_entry.min_paise + 1))::bigint;
      -- Round to the nearest rupee; nobody pays ₹431.47 for an auto.
      v_amount := greatest(100, (v_amount / 100) * 100);

      select a.id into v_account
      from public.accounts a
      where a.user_id = c_user
        and a.name = case v_entry.account_name
          when 'cash' then 'Cash'
          when 'bank' then 'HDFC Savings'
          when 'card' then 'ICICI Credit Card'
          else 'Paytm Wallet'
        end;

      select c.id into v_category
      from public.categories c
      where c.user_id = c_user
        and c.kind = v_entry.kind::public.category_kind
        and c.name = v_entry.category_name;

      insert into public.transactions (
        user_id, type, amount, account_id, category_id, note, occurred_at
      )
      values (
        c_user,
        v_entry.kind::public.transaction_type,
        v_amount,
        v_account,
        v_category,
        v_entry.note,
        ((v_day + make_interval(
            hours => 9 + floor(random() * 12)::integer,
            mins => floor(random() * 60)::integer
          ))::timestamp at time zone c_tz)
      );
    end loop;

    -- An ATM withdrawal and a wallet top-up every month.
    v_day := v_month_start + 6;
    if v_day <= v_today then
      insert into public.transactions (
        user_id, type, amount, account_id, to_account_id, note, occurred_at
      )
      values (
        c_user, 'transfer', 500000, v_bank, v_cash, 'ATM withdrawal',
        ((v_day + time '18:20')::timestamp at time zone c_tz)
      );
    end if;

    v_day := v_month_start + 14;
    if v_day <= v_today then
      insert into public.transactions (
        user_id, type, amount, account_id, to_account_id, note, occurred_at
      )
      values (
        c_user, 'transfer', 200000, v_bank, v_wallet, 'Paytm top-up',
        ((v_day + time '10:05')::timestamp at time zone c_tz)
      );
    end if;

    v_day := v_month_start + 22;
    if v_day <= v_today then
      insert into public.transactions (
        user_id, type, amount, account_id, to_account_id, note, occurred_at
      )
      values (
        c_user, 'transfer', 150000, v_bank, v_wallet, 'Paytm top-up',
        ((v_day + time '21:40')::timestamp at time zone c_tz)
      );
    end if;

    -- Last month's card bill, paid from the bank on the 5th. Computed from the
    -- rows already inserted, so the card settles to roughly what is still
    -- outstanding this month rather than drifting further into the red.
    v_day := v_month_start + 4;
    if v_month_offset < 2 and v_day <= v_today then
      select coalesce(sum(t.amount), 0)
        into v_amount
      from public.transactions t
      where t.user_id = c_user
        and t.type = 'expense'
        and t.account_id = v_card
        and t.occurred_at >= ((v_month_start - interval '1 month')::timestamp at time zone c_tz)
        and t.occurred_at < (v_month_start::timestamp at time zone c_tz);

      if v_amount > 0 then
        insert into public.transactions (
          user_id, type, amount, account_id, to_account_id, note, occurred_at
        )
        values (
          c_user, 'transfer', v_amount, v_bank, v_card,
          'Credit card bill payment',
          ((v_day + time '11:15')::timestamp at time zone c_tz)
        );
      end if;
    end if;

    -- Freelance work in the two older months.
    v_day := v_month_start + 19;
    if v_month_offset > 0 and v_day <= v_today then
      select c.id into v_category
      from public.categories c
      where c.user_id = c_user and c.kind = 'income' and c.name = 'Freelance';

      insert into public.transactions (
        user_id, type, amount, account_id, category_id, note, occurred_at
      )
      values (
        c_user, 'income', 1500000 + (v_month_offset * 250000), v_bank, v_category,
        'Freelance — landing page build',
        ((v_day + time '20:10')::timestamp at time zone c_tz)
      );
    end if;

    -- Quarterly savings interest, in the oldest month.
    v_day := v_month_start + 27;
    if v_month_offset = 2 and v_day <= v_today then
      select c.id into v_category
      from public.categories c
      where c.user_id = c_user and c.kind = 'income' and c.name = 'Interest';

      insert into public.transactions (
        user_id, type, amount, account_id, category_id, note, occurred_at
      )
      values (
        c_user, 'income', 128400, v_bank, v_category, 'Savings interest',
        ((v_day + time '06:30')::timestamp at time zone c_tz)
      );
    end if;
  end loop;

  -- Budgets for this month and last ----------------------------------------
  for v_month_offset in 0 .. 1 loop
    v_month_start := date_trunc('month', v_today - make_interval(months => v_month_offset))::date;

    insert into public.budgets (user_id, category_id, month, amount)
    select
      c_user,
      c.id,
      v_month_start,
      b.amount
    from (
      values
        ('Food',           900000),
        ('Groceries',      700000),
        ('Transport',      300000),
        ('Fuel',           450000),
        ('Shopping',       600000),
        ('Bills',          400000),
        ('Entertainment',  250000),
        ('Health',         300000)
    ) as b (category_name, amount)
    join public.categories c
      on c.user_id = c_user
     and c.kind = 'expense'
     and c.name = b.category_name
    on conflict (user_id, category_id, month) do nothing;
  end loop;

  -- Recurring rules ---------------------------------------------------------
  select c.id into v_category
  from public.categories c
  where c.user_id = c_user and c.kind = 'expense' and c.name = 'Rent';

  insert into public.recurring_rules (
    user_id, type, amount, account_id, category_id, note,
    frequency, interval_count, start_date, next_run_on
  )
  values (
    c_user, 'expense', 2200000, v_bank, v_category, 'Rent — landlord UPI',
    'monthly', 1,
    -- Anchored on the 3rd, three months back, so the schedule lines up with
    -- next_run_on below.
    ((date_trunc('month', v_today) - interval '3 months')::date + 2),
    -- Already paid for this month by the records above, so it is due next month.
    (date_trunc('month', v_today + interval '1 month')::date + 2)
  );

  select c.id into v_category
  from public.categories c
  where c.user_id = c_user and c.kind = 'expense' and c.name = 'Entertainment';

  insert into public.recurring_rules (
    user_id, type, amount, account_id, category_id, note,
    frequency, interval_count, start_date, next_run_on
  )
  values (
    c_user, 'expense', 64900, v_card, v_category, 'Netflix',
    'monthly', 1,
    ((date_trunc('month', v_today) - interval '3 months')::date + 9),
    (date_trunc('month', v_today + interval '1 month')::date + 9)
  );

  select c.id into v_category
  from public.categories c
  where c.user_id = c_user and c.kind = 'expense' and c.name = 'Bills';

  insert into public.recurring_rules (
    user_id, type, amount, account_id, category_id, note,
    frequency, interval_count, start_date, next_run_on
  )
  values (
    c_user, 'expense', 79900, v_card, v_category, 'Jio postpaid',
    'monthly', 1,
    ((date_trunc('month', v_today) - interval '3 months')::date + 2),
    (date_trunc('month', v_today + interval '1 month')::date + 2)
  );

  -- One rule with a history, so the detail page and the Upcoming strip have
  -- something to show on a fresh reset: a weekly top-up that has run five
  -- times and is due again in two days.
  select c.id into v_category
  from public.categories c
  where c.user_id = c_user and c.kind = 'expense' and c.name = 'Transport';

  insert into public.recurring_rules (
    user_id, type, amount, account_id, category_id, note,
    frequency, interval_count, start_date, next_run_on, last_run_on
  )
  values (
    c_user, 'expense', 25000, v_wallet, v_category, 'Metro card top-up',
    'weekly', 1, v_today - 33, v_today + 2, v_today - 5
  )
  returning id into v_rule;

  -- The occurrences it has already created, on the days the schedule says:
  -- 33, 26, 19, 12 and 5 days ago.
  insert into public.transactions (
    user_id, type, amount, account_id, category_id, note,
    occurred_at, recurring_rule_id
  )
  select
    c_user, 'expense', 25000, v_wallet, v_category, 'Metro card top-up',
    ((v_today - offset_days + time '12:00')::timestamp at time zone c_tz),
    v_rule
  from unnest(array[33, 26, 19, 12, 5]) as offset_days;

  raise notice 'Seeded demo@example.com with % transactions',
    (select count(*) from public.transactions where user_id = c_user);
end;
$$;
