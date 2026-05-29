alter table public.custom_scenarios
  add column if not exists feedback_mode text not null default 'standard';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'custom_scenarios_feedback_mode_check'
  ) then
    alter table public.custom_scenarios
      add constraint custom_scenarios_feedback_mode_check
      check (feedback_mode in ('light', 'standard', 'strict'));
  end if;
end $$;
