-- Adds recycled-material percentage support to material mappings.
-- Safe to run multiple times.

alter table public.plant_mix_carbon_factors
  add column if not exists recycled_materials_pct numeric(5,2);

-- Keep values realistic: 0 to 100 when provided.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plant_mix_carbon_factors_recycled_materials_pct_check'
      and conrelid = 'public.plant_mix_carbon_factors'::regclass
  ) then
    alter table public.plant_mix_carbon_factors
      add constraint plant_mix_carbon_factors_recycled_materials_pct_check
      check (
        recycled_materials_pct is null
        or (recycled_materials_pct >= 0 and recycled_materials_pct <= 100)
      );
  end if;
end $$;

comment on column public.plant_mix_carbon_factors.recycled_materials_pct
  is 'Percent of recycled materials used in the mix (0-100).';

-- Existing UPDATE policy already allows authenticated users to modify rows.
-- This optional no-op update confirms rows are writable after migration.
-- update public.plant_mix_carbon_factors set recycled_materials_pct = recycled_materials_pct where false;
