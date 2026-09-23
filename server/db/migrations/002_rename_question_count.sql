-- Preserve existing game counts while standardizing the column name.
-- Safe to run again, or after the updated initial schema.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'currentGames'
      and column_name = 'number_of_problems'
  ) then
    alter table public."currentGames"
      rename column number_of_problems to number_of_questions;
  end if;
end $$;
