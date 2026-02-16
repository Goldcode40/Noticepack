create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  document_type_id uuid not null references public.document_types(id),
  status text not null default 'draft',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists case_documents_case_doc_unique
  on public.case_documents(case_id, document_type_id);

create index if not exists case_documents_user_id_idx
  on public.case_documents(user_id);

alter table public.case_documents enable row level security;

-- RLS: user owns the row
drop policy if exists "case_documents_select_own" on public.case_documents;
create policy "case_documents_select_own"
on public.case_documents for select
using (auth.uid() = user_id);

drop policy if exists "case_documents_insert_own" on public.case_documents;
create policy "case_documents_insert_own"
on public.case_documents for insert
with check (auth.uid() = user_id);

drop policy if exists "case_documents_update_own" on public.case_documents;
create policy "case_documents_update_own"
on public.case_documents for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "case_documents_delete_own" on public.case_documents;
create policy "case_documents_delete_own"
on public.case_documents for delete
using (auth.uid() = user_id);

-- NOTE: updated_at trigger is created in the next migration (after helper function exists)