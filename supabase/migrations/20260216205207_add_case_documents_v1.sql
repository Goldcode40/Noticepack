create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  document_type_id uuid not null references public.document_types(id),
  status text not null default 'draft' check (status in ('draft','generated','final')),
  answers jsonb not null default '{}'::jsonb,
  rendered_text text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_case_documents_case_id on public.case_documents(case_id);
create index if not exists idx_case_documents_user_id on public.case_documents(user_id);
create index if not exists idx_case_documents_doc_type on public.case_documents(document_type_id);

create trigger set_case_documents_updated_at
before update on public.case_documents
for each row execute function public.set_updated_at();

alter table public.case_documents enable row level security;

create policy "case_documents_select_own"
on public.case_documents for select
using (auth.uid() = user_id);

create policy "case_documents_insert_own"
on public.case_documents for insert
with check (auth.uid() = user_id);

create policy "case_documents_update_own"
on public.case_documents for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "case_documents_delete_own"
on public.case_documents for delete
using (auth.uid() = user_id);