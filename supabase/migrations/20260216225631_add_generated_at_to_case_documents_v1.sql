alter table public.case_documents
add column if not exists generated_at timestamptz;

-- Optional: constrain status values a bit (safe incremental)
-- (If you don’t want constraints yet, leave this commented.)
-- do $$
-- begin
--   if not exists (
--     select 1 from pg_constraint where conname = 'case_documents_status_check'
--   ) then
--     alter table public.case_documents
--     add constraint case_documents_status_check
--     check (status in ('draft','generated'));
--   end if;
-- end $$;