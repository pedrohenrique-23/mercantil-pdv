create extension if not exists "pgcrypto";

create type public.profile_role as enum ('admin', 'operator');
create type public.company_member_role as enum ('owner', 'admin', 'operator');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role public.profile_role not null default 'operator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.company_member_role not null default 'operator',
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index company_members_user_id_idx on public.company_members(user_id);
create index companies_created_by_idx on public.companies(created_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger companies_set_updated_at
before update on public.companies
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;

create policy "Users can view their own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Members can view their companies"
on public.companies for select
to authenticated
using (
  exists (
    select 1 from public.company_members
    where company_members.company_id = companies.id
      and company_members.user_id = auth.uid()
  )
);

create policy "Users can view their memberships"
on public.company_members for select
to authenticated
using (user_id = auth.uid());

comment on table public.profiles is 'Application profile linked one-to-one with auth.users.';
comment on table public.companies is 'Tenant root for the Mercantil PDV.';
comment on table public.company_members is 'Authorization boundary between Supabase users and companies.';
