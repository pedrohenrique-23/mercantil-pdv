-- Mercantil PDV: business data model and RLS foundation.
-- Monetary values are stored as integer cents. All timestamps are timestamptz.

create type public.product_unit as enum ('unit', 'kg', 'g', 'l', 'ml', 'box', 'pack');
create type public.cash_register_status as enum ('open', 'closed');
create type public.cash_movement_type as enum ('opening', 'sale', 'cash_in', 'cash_out', 'closing_adjustment');
create type public.sale_status as enum ('completed', 'cancelled');
create type public.payment_method as enum ('cash', 'pix', 'debit', 'credit', 'credit_account');
create type public.payment_status as enum ('completed', 'refunded');
create type public.credit_account_status as enum ('open', 'partial', 'paid', 'cancelled');
create type public.stock_movement_type as enum ('opening', 'purchase', 'sale', 'adjustment_in', 'adjustment_out', 'return', 'loss');

create or replace function public.current_profile_role()
returns public.profile_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members
    where company_id = target_company_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_company_role(target_company_id uuid, allowed_roles public.company_member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members
    where company_id = target_company_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

revoke all on function public.current_profile_role() from public;
revoke all on function public.is_company_member(uuid) from public;
revoke all on function public.has_company_role(uuid, public.company_member_role[]) from public;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.has_company_role(uuid, public.company_member_role[]) to authenticated;

-- The old policy allowed a user to submit a different profile role.
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = public.current_profile_role()
);

-- Complete the authorization boundary for tenants and memberships.
create policy "Authenticated users can create their own company"
on public.companies for insert
to authenticated
with check (created_by = auth.uid());

create policy "Company admins can update their company"
on public.companies for update
to authenticated
using (public.has_company_role(id, array['owner', 'admin']::public.company_member_role[]))
with check (public.has_company_role(id, array['owner', 'admin']::public.company_member_role[]));

create policy "Company managers can view memberships"
on public.company_members for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_company_role(company_id, array['owner', 'admin']::public.company_member_role[])
);

create policy "Company managers can add memberships"
on public.company_members for insert
to authenticated
with check (
  public.has_company_role(company_id, array['owner', 'admin']::public.company_member_role[])
);

create policy "Company managers can update memberships"
on public.company_members for update
to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::public.company_member_role[]))
with check (public.has_company_role(company_id, array['owner', 'admin']::public.company_member_role[]));

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) >= 2),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null check (length(trim(name)) >= 2),
  barcode text,
  sku text,
  unit public.product_unit not null default 'unit',
  cost_cents integer not null default 0 check (cost_cents >= 0),
  sale_cents integer not null check (sale_cents >= 0),
  stock_quantity numeric(12, 3) not null default 0 check (stock_quantity >= 0),
  min_stock_quantity numeric(12, 3) not null default 0 check (min_stock_quantity >= 0),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, barcode),
  unique (company_id, sku)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) >= 2),
  phone text,
  document text,
  credit_limit_cents integer not null default 0 check (credit_limit_cents >= 0),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  opened_by uuid not null references auth.users(id),
  closed_by uuid references auth.users(id),
  status public.cash_register_status not null default 'open',
  opening_cents integer not null default 0 check (opening_cents >= 0),
  expected_cents integer,
  counted_cents integer check (counted_cents is null or counted_cents >= 0),
  difference_cents integer,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text,
  check ((status = 'open' and closed_at is null) or (status = 'closed' and closed_at is not null))
);

create unique index one_open_cash_register_per_company
on public.cash_registers(company_id)
where status = 'open';

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  cash_register_id uuid references public.cash_registers(id) on delete restrict,
  operator_id uuid not null references auth.users(id),
  customer_id uuid references public.customers(id) on delete restrict,
  status public.sale_status not null default 'completed',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (discount_cents <= subtotal_cents),
  check ((status = 'completed' and cancelled_at is null) or (status = 'cancelled' and cancelled_at is not null))
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null check (total_cents >= 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  sale_id uuid not null references public.sales(id) on delete cascade,
  method public.payment_method not null,
  status public.payment_status not null default 'completed',
  amount_cents integer not null check (amount_cents > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.credit_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  sale_id uuid not null unique references public.sales(id) on delete restrict,
  original_cents integer not null check (original_cents > 0),
  remaining_cents integer not null check (remaining_cents >= 0 and remaining_cents <= original_cents),
  status public.credit_account_status not null default 'open',
  due_date date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  credit_account_id uuid not null references public.credit_accounts(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  received_by uuid not null references auth.users(id),
  received_at timestamptz not null default now(),
  notes text
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  sale_id uuid references public.sales(id) on delete restrict,
  movement_type public.stock_movement_type not null,
  quantity_delta numeric(12, 3) not null check (quantity_delta <> 0),
  quantity_before numeric(12, 3) not null check (quantity_before >= 0),
  quantity_after numeric(12, 3) not null check (quantity_after >= 0),
  reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  cash_register_id uuid not null references public.cash_registers(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete restrict,
  movement_type public.cash_movement_type not null,
  amount_cents integer not null check (amount_cents > 0),
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index categories_company_idx on public.categories(company_id, is_active);
create index products_company_idx on public.products(company_id, is_active);
create index products_category_idx on public.products(category_id);
create index products_barcode_idx on public.products(company_id, barcode) where barcode is not null;
create index customers_company_idx on public.customers(company_id, is_active);
create index cash_registers_company_idx on public.cash_registers(company_id, opened_at desc);
create index sales_company_created_idx on public.sales(company_id, created_at desc);
create index sales_customer_idx on public.sales(customer_id, created_at desc);
create index sale_items_sale_idx on public.sale_items(sale_id);
create index payments_company_created_idx on public.payments(company_id, created_at desc);
create index credit_accounts_customer_idx on public.credit_accounts(customer_id, status);
create index stock_movements_product_idx on public.stock_movements(product_id, created_at desc);
create index cash_movements_register_idx on public.cash_movements(cash_register_id, created_at desc);

create trigger categories_set_updated_at before update on public.categories for each row execute procedure public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute procedure public.set_updated_at();
create trigger customers_set_updated_at before update on public.customers for each row execute procedure public.set_updated_at();
create trigger credit_accounts_set_updated_at before update on public.credit_accounts for each row execute procedure public.set_updated_at();

create or replace function public.add_company_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.company_members (company_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (company_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

revoke all on function public.add_company_owner() from public;

create trigger companies_add_owner
after insert on public.companies
for each row execute procedure public.add_company_owner();

-- Every business table is tenant-isolated through the SECURITY DEFINER helper.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'categories', 'products', 'customers', 'cash_registers', 'sales',
    'sale_items', 'payments', 'credit_accounts', 'credit_payments',
    'stock_movements', 'cash_movements'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy "Members can view categories" on public.categories for select to authenticated using (public.is_company_member(company_id));
create policy "Managers can create categories" on public.categories for insert to authenticated with check (public.has_company_role(company_id, array['owner', 'admin']::public.company_member_role[]) and created_by = auth.uid());
create policy "Managers can update categories" on public.categories for update to authenticated using (public.has_company_role(company_id, array['owner', 'admin']::public.company_member_role[])) with check (public.has_company_role(company_id, array['owner', 'admin']::public.company_member_role[]));

create policy "Members can view products" on public.products for select to authenticated using (public.is_company_member(company_id));
create policy "Managers can create products" on public.products for insert to authenticated with check (public.has_company_role(company_id, array['owner', 'admin']::public.company_member_role[]) and created_by = auth.uid());
create policy "Managers can update products" on public.products for update to authenticated using (public.has_company_role(company_id, array['owner', 'admin']::public.company_member_role[])) with check (public.has_company_role(company_id, array['owner', 'admin']::public.company_member_role[]));

create policy "Members can view customers" on public.customers for select to authenticated using (public.is_company_member(company_id));
create policy "Members can create customers" on public.customers for insert to authenticated with check (public.is_company_member(company_id) and created_by = auth.uid());
create policy "Members can update customers" on public.customers for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));

create policy "Members can view cash registers" on public.cash_registers for select to authenticated using (public.is_company_member(company_id));
create policy "Members can open cash registers" on public.cash_registers for insert to authenticated with check (public.is_company_member(company_id) and opened_by = auth.uid());
create policy "Members can update cash registers" on public.cash_registers for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));

create policy "Members can view sales" on public.sales for select to authenticated using (public.is_company_member(company_id));
create policy "Members can create sales" on public.sales for insert to authenticated with check (public.is_company_member(company_id) and operator_id = auth.uid());
create policy "Managers can update sales" on public.sales for update to authenticated using (public.has_company_role(company_id, array['owner', 'admin']::public.company_member_role[])) with check (public.has_company_role(company_id, array['owner', 'admin']::public.company_member_role[]));

create policy "Members can view sale items" on public.sale_items for select to authenticated using (exists (select 1 from public.sales where sales.id = sale_items.sale_id and public.is_company_member(sales.company_id)));
create policy "Members can create sale items" on public.sale_items for insert to authenticated with check (exists (select 1 from public.sales where sales.id = sale_items.sale_id and public.is_company_member(sales.company_id)));

create policy "Members can view payments" on public.payments for select to authenticated using (public.is_company_member(company_id));
create policy "Members can create payments" on public.payments for insert to authenticated with check (public.is_company_member(company_id) and created_by = auth.uid());

create policy "Members can view credit accounts" on public.credit_accounts for select to authenticated using (public.is_company_member(company_id));
create policy "Members can create credit accounts" on public.credit_accounts for insert to authenticated with check (public.is_company_member(company_id) and created_by = auth.uid());
create policy "Members can update credit accounts" on public.credit_accounts for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));

create policy "Members can view credit payments" on public.credit_payments for select to authenticated using (public.is_company_member(company_id));
create policy "Members can create credit payments" on public.credit_payments for insert to authenticated with check (public.is_company_member(company_id) and received_by = auth.uid());

create policy "Members can view stock movements" on public.stock_movements for select to authenticated using (public.is_company_member(company_id));
create policy "Managers can create stock movements" on public.stock_movements for insert to authenticated with check (public.has_company_role(company_id, array['owner', 'admin']::public.company_member_role[]) and created_by = auth.uid());

create policy "Members can view cash movements" on public.cash_movements for select to authenticated using (public.is_company_member(company_id));
create policy "Members can create cash movements" on public.cash_movements for insert to authenticated with check (public.is_company_member(company_id) and created_by = auth.uid());

comment on table public.categories is 'Product categories scoped to one Mercantil company.';
comment on table public.products is 'Sellable products; monetary values are integer cents and inventory is decimal quantity.';
comment on table public.customers is 'Customers and optional credit limits scoped to one company.';
comment on table public.cash_registers is 'One open cash register per company, enforced by a partial unique index.';
comment on table public.sales is 'Sale header; creation should be performed transactionally by a trusted server action or RPC.';
comment on table public.stock_movements is 'Immutable inventory ledger; product stock should be changed together with a movement.';
comment on table public.cash_movements is 'Cash ledger tied to a register and optionally a sale.';

-- NOTE: the delete-membership policy in 0001 is intentionally replaced below.
drop policy if exists "Company managers can remove memberships" on public.company_members;
create policy "Company managers can remove memberships"
on public.company_members for delete
to authenticated
using (
  user_id <> auth.uid()
  and public.has_company_role(company_id, array['owner', 'admin']::public.company_member_role[])
);
