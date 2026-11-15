-- Paisa: sixteen soft tints, in place of eight.
--
-- Eight was not enough to name a real set of categories: once groceries,
-- food, bills, fuel, transport, health, shopping and rent have one each,
-- the ninth category has to share, and two rows that share a tint stop
-- being told apart by colour at all.
--
-- The eight that were here keep their keys and their meaning, so nothing
-- stored has to move. Their hex values shift a little, which is exactly
-- what storing a key rather than a colour was for.
--
-- The new eight are coral, amber, sand, sage, teal, ice, plum and slate.
-- Every one of the sixteen still takes plain ink at 10:1 or better in both
-- themes, so the rule that a tile is never the loudest thing on a screen
-- survives the expansion. See src/lib/tokens.ts, whose test asserts it.

alter domain public.tint drop constraint tint_check;

alter domain public.tint add constraint tint_check
  check (value in (
    'rose', 'coral', 'peach', 'amber',
    'butter', 'sand', 'sage', 'mint',
    'teal', 'ice', 'sky', 'peri',
    'lilac', 'plum', 'slate', 'neutral'
  ));

comment on domain public.tint is
  'One of the sixteen soft tints. See src/lib/tokens.ts.';
