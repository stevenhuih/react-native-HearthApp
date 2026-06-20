-- seed.sql — canonical ingredients (representative sample).
--
-- ~47 items across all 9 categories. To reach the full ~211, append rows to
-- the matching category block below — the shape and CHECK-allowed values are
-- identical for every row.
--
-- Columns (from section 02; id is auto-identity, search_keywords is populated
-- by the UPDATE at the bottom):
--   name, category, default_unit, default_quantity, shopping_unit,
--   shopping_qty_per_unit, default_shelf_life_days, track_quantity, aliases
--
-- Units follow section 02's pantry-vs-shopping model: pantry tracks in
-- ml/g/count/bunch; shopping_unit is the human purchase unit. Spices use
-- track_quantity=false (existence only). Idempotent via ON CONFLICT (name).

-- ───────────────────────────────────────────────── fresh_produce
insert into public.ingredients
  (name, category, default_unit, default_quantity, shopping_unit, shopping_qty_per_unit, default_shelf_life_days, track_quantity, aliases) values
  ('spinach',     'fresh_produce', 'g',     200, 'bag',   200, 4,  true, array['baby spinach']),
  ('garlic',      'fresh_produce', 'count', 10,  'pack',  10,  30, true, array['garlic cloves']),
  ('ginger',      'fresh_produce', 'g',     100, 'pack',  100, 30, true, '{}'),
  ('onion',       'fresh_produce', 'count', 3,   'bag',   3,   30, true, array['onions']),
  ('tomato',      'fresh_produce', 'count', 4,   'pack',  4,   7,  true, array['tomatoes']),
  ('bok choy',    'fresh_produce', 'bunch', 1,   'bunch', 1,   5,  true, array['pak choi']),
  ('carrot',      'fresh_produce', 'count', 4,   'pack',  4,   21, true, array['carrots'])
on conflict (name) do nothing;

-- ───────────────────────────────────────────────── meat_seafood
insert into public.ingredients
  (name, category, default_unit, default_quantity, shopping_unit, shopping_qty_per_unit, default_shelf_life_days, track_quantity, aliases) values
  ('chicken breast', 'meat_seafood', 'g',     500, 'pack', 500, 2,  true, '{}'),
  ('chicken thighs', 'meat_seafood', 'g',     500, 'pack', 500, 2,  true, '{}'),
  ('ground beef',    'meat_seafood', 'g',     500, 'pack', 500, 2,  true, array['minced beef']),
  ('eggs',           'meat_seafood', 'count', 12,  'tray', 12,  21, true, array['egg']),
  ('salmon',         'meat_seafood', 'g',     300, 'pack', 300, 2,  true, array['salmon fillet']),
  ('prawn',          'meat_seafood', 'g',     300, 'pack', 300, 2,  true, array['prawns','shrimp']),
  ('firm tofu',      'meat_seafood', 'g',     300, 'pack', 300, 7,  true, array['tofu'])
on conflict (name) do nothing;

-- ───────────────────────────────────────────────── dairy
insert into public.ingredients
  (name, category, default_unit, default_quantity, shopping_unit, shopping_qty_per_unit, default_shelf_life_days, track_quantity, aliases) values
  ('milk',          'dairy', 'ml', 1000, 'bottle', 1000, 7,  true, '{}'),
  ('butter',        'dairy', 'g',  250,  'pack',   250,  30, true, '{}'),
  ('greek yoghurt', 'dairy', 'g',  400,  'pack',   400,  14, true, array['greek yogurt']),
  ('cheddar',       'dairy', 'g',  250,  'pack',   250,  21, true, array['cheddar cheese']),
  ('parmesan',      'dairy', 'g',  100,  'pack',   100,  60, true, array['parmesan cheese'])
on conflict (name) do nothing;

-- ───────────────────────────────────────────────── sauces
insert into public.ingredients
  (name, category, default_unit, default_quantity, shopping_unit, shopping_qty_per_unit, default_shelf_life_days, track_quantity, aliases) values
  ('soy sauce',      'sauces', 'ml', 500, 'bottle', 500, 540, true, array['light soy','soya sauce']),
  ('dark soy sauce', 'sauces', 'ml', 500, 'bottle', 500, 540, true, array['dark soy']),
  ('oyster sauce',   'sauces', 'ml', 300, 'bottle', 300, 360, true, '{}'),
  ('fish sauce',     'sauces', 'ml', 200, 'bottle', 200, 540, true, '{}'),
  ('sesame oil',     'sauces', 'ml', 150, 'bottle', 150, 360, true, '{}'),
  ('gochujang',      'sauces', 'g',  200, 'jar',    200, 360, true, array['korean chilli paste']),
  ('sriracha',       'sauces', 'ml', 250, 'bottle', 250, 540, true, array['sriracha sauce'])
on conflict (name) do nothing;

-- ───────────────────────────────────────────────── dry_staples
insert into public.ingredients
  (name, category, default_unit, default_quantity, shopping_unit, shopping_qty_per_unit, default_shelf_life_days, track_quantity, aliases) values
  ('jasmine rice',  'dry_staples', 'g',     1000, 'bag',  1000, 540, true, array['rice']),
  ('spaghetti',     'dry_staples', 'g',     500,  'pack', 500,  730, true, array['pasta']),
  ('udon noodles',  'dry_staples', 'g',     500,  'pack', 500,  180, true, array['udon']),
  ('plain flour',   'dry_staples', 'g',     1000, 'bag',  1000, 365, true, array['flour','all purpose flour']),
  ('bread',         'dry_staples', 'count', 1,    'pack', 1,    5,   true, array['loaf'])
on conflict (name) do nothing;

-- ───────────────────────────────────────────────── canned
insert into public.ingredients
  (name, category, default_unit, default_quantity, shopping_unit, shopping_qty_per_unit, default_shelf_life_days, track_quantity, aliases) values
  ('canned tuna',     'canned', 'g',  185, 'can', 185, 1095, true, array['tuna']),
  ('canned tomatoes', 'canned', 'g',  400, 'can', 400, 1095, true, array['chopped tomatoes']),
  ('coconut milk',    'canned', 'ml', 400, 'can', 400, 730,  true, '{}'),
  ('canned chickpeas','canned', 'g',  400, 'can', 400, 1095, true, array['chickpeas','garbanzo beans']),
  ('chicken stock',   'canned', 'ml', 500, 'can', 500, 540,  true, array['chicken broth'])
on conflict (name) do nothing;

-- ───────────────────────────────────────────────── spices  (track_quantity = false)
insert into public.ingredients
  (name, category, default_unit, default_quantity, shopping_unit, shopping_qty_per_unit, default_shelf_life_days, track_quantity, aliases) values
  ('salt',         'spices', 'g', null, 'jar', null, null, false, '{}'),
  ('black pepper', 'spices', 'g', null, 'jar', null, null, false, array['pepper']),
  ('paprika',      'spices', 'g', null, 'jar', null, null, false, '{}'),
  ('cumin',        'spices', 'g', null, 'jar', null, null, false, array['ground cumin']),
  ('garlic powder','spices', 'g', null, 'jar', null, null, false, '{}')
on conflict (name) do nothing;

-- ───────────────────────────────────────────────── oils
insert into public.ingredients
  (name, category, default_unit, default_quantity, shopping_unit, shopping_qty_per_unit, default_shelf_life_days, track_quantity, aliases) values
  ('olive oil',     'oils', 'ml', 500,  'bottle', 500,  540, true, '{}'),
  ('vegetable oil', 'oils', 'ml', 1000, 'bottle', 1000, 540, true, '{}'),
  ('coconut oil',   'oils', 'ml', 500,  'jar',    500,  540, true, '{}')
on conflict (name) do nothing;

-- ───────────────────────────────────────────────── frozen
insert into public.ingredients
  (name, category, default_unit, default_quantity, shopping_unit, shopping_qty_per_unit, default_shelf_life_days, track_quantity, aliases) values
  ('frozen peas',      'frozen', 'g',     500, 'bag', 500, 365, true, array['peas']),
  ('frozen prawns',    'frozen', 'g',     400, 'bag', 400, 365, true, array['frozen shrimp']),
  ('frozen dumplings', 'frozen', 'count', 20,  'bag', 20,  180, true, array['gyoza','potstickers'])
on conflict (name) do nothing;

-- Populate full-text search index from name + aliases for every row.
-- Re-runnable; keeps search_keywords in sync after appends.
update public.ingredients
set search_keywords = to_tsvector('simple', name || ' ' || coalesce(array_to_string(aliases, ' '), ''));


-- ════════════════════════════════════════════════════════════════════════
-- pantry_archetypes — the 6 onboarding cooking styles (architecture §07).
--
-- ingredient_seeds is built by looking ingredients up BY NAME, so it stays
-- correct regardless of the serial ids the ingredients table assigned. Each
-- seed = {ingredient_id, quantity, unit, shelf_life_days} from the ingredient's
-- defaults. Idempotent via NOT EXISTS on name. Names must exist in the seed
-- above; extend the arrays as you grow the ingredient catalog.
-- ════════════════════════════════════════════════════════════════════════
insert into public.pantry_archetypes (name, emoji, ingredient_seeds)
select
  v.name,
  v.emoji,
  (
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'ingredient_id',   i.id,
        'quantity',        i.default_quantity,
        'unit',            i.default_unit,
        'shelf_life_days', i.default_shelf_life_days
      )),
      '[]'::jsonb
    )
    from public.ingredients i
    where i.name = any (v.items)
  ) as ingredient_seeds
from (values
  ('Asian Fusion', '🥢', array[
    'soy sauce','dark soy sauce','oyster sauce','fish sauce','sesame oil','gochujang',
    'sriracha','jasmine rice','udon noodles','garlic','ginger','eggs','firm tofu',
    'bok choy','carrot','vegetable oil']),
  ('Italian', '🍝', array[
    'spaghetti','canned tomatoes','olive oil','garlic','onion','parmesan','butter',
    'plain flour','black pepper','salt','tomato']),
  ('Mediterranean', '🫒', array[
    'olive oil','canned chickpeas','garlic','onion','tomato','cumin','paprika',
    'greek yoghurt','salt','black pepper','spinach']),
  ('Healthy / Clean', '🥗', array[
    'spinach','eggs','greek yoghurt','olive oil','chicken breast','carrot',
    'frozen peas','jasmine rice','salt','black pepper']),
  ('Mexican', '🌮', array[
    'canned tomatoes','canned chickpeas','onion','garlic','cumin','paprika',
    'ground beef','tomato','vegetable oil','salt']),
  ('BBQ / Comfort', '🍖', array[
    'chicken thighs','ground beef','bread','butter','cheddar','vegetable oil',
    'paprika','black pepper','salt','onion','garlic'])
) as v(name, emoji, items)
where not exists (
  select 1 from public.pantry_archetypes pa where pa.name = v.name
);


-- ════════════════════════════════════════════════════════════════════════
-- Allergen tags (0011). Vocabulary matches users.dietary_profile.allergens.
-- Used by the panic-button function for server-side allergen validation.
-- ════════════════════════════════════════════════════════════════════════
update public.ingredients set allergens = '{eggs}'        where name = 'eggs';
update public.ingredients set allergens = '{fish}'        where name = any(array['salmon','canned tuna','fish sauce']);
update public.ingredients set allergens = '{shellfish}'   where name = any(array['prawn','frozen prawns','oyster sauce']);
update public.ingredients set allergens = '{soy}'         where name = 'firm tofu';
update public.ingredients set allergens = '{soy,gluten}'  where name = any(array['soy sauce','dark soy sauce','gochujang']);
update public.ingredients set allergens = '{dairy}'       where name = any(array['milk','butter','greek yoghurt','cheddar','parmesan']);
update public.ingredients set allergens = '{gluten}'      where name = any(array['spaghetti','udon noodles','plain flour','bread']);
update public.ingredients set allergens = '{gluten,soy}'  where name = 'frozen dumplings';
update public.ingredients set allergens = '{sesame}'      where name = 'sesame oil';
