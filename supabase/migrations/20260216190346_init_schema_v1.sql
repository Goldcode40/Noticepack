-- NoticePack DB Schema v1
-- Core entities: profiles, properties, tenants, cases, timeline events, attachments, document types, states,
-- coverage matrix (state x doc type), generated documents

-- Enable extensions
create extension if not exists "pgcrypto";

-- 1) Profiles (ties to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  plan text not null default 'free' check (plan in ('free','starter','pro')),
  created_at timestamptz not null default now()
);

-- 2) Properties
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  address1 text,
  address2 text,
  city text,
  state text,
  postal_code text,
  created_at timestamptz not null default now()
);

create index if not exists idx_properties_user_id on public.properties(user_id);

-- 3) Tenants
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  lease_start date,
  lease_end date,
  created_at timestamptz not null default now()
);

create index if not exists idx_tenants_user_id on public.tenants(user_id);
create index if not exists idx_tenants_property_id on public.tenants(property_id);

-- 4) Cases
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  status text not null default 'active' check (status in ('active','closed')),
  title text,
  state_code text, -- e.g., 'NH'
  created_at timestamptz not null default now()
);

create index if not exists idx_cases_user_id on public.cases(user_id);
create index if not exists idx_cases_property_id on public.cases(property_id);
create index if not exists idx_cases_tenant_id on public.cases(tenant_id);

-- 5) Timeline events
create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  event_type text not null, -- e.g., 'notice_sent','call','payment','inspection'
  event_date timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_timeline_case_id on public.timeline_events(case_id);
create index if not exists idx_timeline_user_id on public.timeline_events(user_id);

-- 6) Attachments (files stored in Supabase Storage; we store metadata here)
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  file_path text not null,      -- storage path
  file_name text not null,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_attachments_case_id on public.attachments(case_id);
create index if not exists idx_attachments_user_id on public.attachments(user_id);

-- 7) Document types (the “library”)
create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,  -- e.g., 'notice_to_enter'
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- 8) States
create table if not exists public.states (
  code text primary key, -- 'NH'
  name text not null
);

-- 9) Coverage matrix: State x DocumentType => status (implemented/guided/unavailable)
create table if not exists public.coverage_matrix (
  state_code text not null references public.states(code) on delete cascade,
  document_type_id uuid not null references public.document_types(id) on delete cascade,
  status text not null check (status in ('implemented','guided','unavailable')),
  notes text,
  primary key (state_code, document_type_id)
);

-- 10) Generated documents (PDF/content metadata per case)
create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  document_type_id uuid not null references public.document_types(id) on delete restrict,
  state_code text references public.states(code) on delete set null,
  title text,
  content_json jsonb,      -- wizard payload
  pdf_path text,           -- storage path to generated PDF
  created_at timestamptz not null default now()
);

create index if not exists idx_generated_docs_case_id on public.generated_documents(case_id);
create index if not exists idx_generated_docs_user_id on public.generated_documents(user_id);

-- RLS ON
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.tenants enable row level security;
alter table public.cases enable row level security;
alter table public.timeline_events enable row level security;
alter table public.attachments enable row level security;
alter table public.document_types enable row level security;
alter table public.states enable row level security;
alter table public.coverage_matrix enable row level security;
alter table public.generated_documents enable row level security;

-- RLS Policies (simple owner-based)
-- Profiles: user can read/write own profile
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

-- Helper macro: auth.uid() = user_id
create policy "properties_own" on public.properties
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tenants_own" on public.tenants
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "cases_own" on public.cases
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "timeline_events_own" on public.timeline_events
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "attachments_own" on public.attachments
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "generated_documents_own" on public.generated_documents
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Public read for document library + states + coverage matrix (so UI can show badges before data entry)
create policy "document_types_read" on public.document_types
for select using (true);

create policy "states_read" on public.states
for select using (true);

create policy "coverage_matrix_read" on public.coverage_matrix
for select using (true);

-- Restrict writes on library tables to service role (no client writes)
-- (No insert/update policies created => blocked for anon/auth users)

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
