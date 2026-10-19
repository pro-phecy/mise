alter table public.profiles
  add column if not exists skill_level text not null default 'beginner'
    check (skill_level in ('beginner', 'comfortable', 'advanced')),
  add column if not exists cooking_days_per_week smallint not null default 5
    check (cooking_days_per_week between 1 and 7),
  add column if not exists target_calories integer
    check (target_calories is null or target_calories between 1 and 10000),
  add column if not exists target_protein_grams integer
    check (target_protein_grams is null or target_protein_grams between 1 and 1000),
  add column if not exists target_carbs_grams integer
    check (target_carbs_grams is null or target_carbs_grams between 1 and 1000),
  add column if not exists target_fat_grams integer
    check (target_fat_grams is null or target_fat_grams between 1 and 1000);
