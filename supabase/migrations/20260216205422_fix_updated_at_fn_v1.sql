create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_case_documents_updated_at on public.case_documents;

create trigger set_case_documents_updated_at
before update on public.case_documents
for each row execute function public.set_updated_at();