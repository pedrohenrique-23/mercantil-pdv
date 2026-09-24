-- Mercantil PDV: atomic inventory adjustments.
-- The RPC keeps product balance and stock ledger synchronized.

create or replace function public.adjust_product_stock(
  target_product_id uuid,
  movement_kind public.stock_movement_type,
  quantity_delta numeric,
  movement_reason text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_company_id uuid;
  actor_role public.company_member_role;
  current_product public.products;
  next_quantity numeric(12, 3);
  created_movement public.stock_movements;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select p.company_id, cm.role
    into actor_company_id, actor_role
  from public.products p
  join public.company_members cm
    on cm.company_id = p.company_id
   and cm.user_id = auth.uid()
  where p.id = target_product_id
    and cm.role in ('owner', 'admin')
  limit 1;

  if actor_company_id is null then
    raise exception using errcode = '42501', message = 'Insufficient permission';
  end if;

  if movement_kind not in ('purchase', 'adjustment_in', 'adjustment_out', 'return', 'loss') then
    raise exception using errcode = '22023', message = 'Invalid manual stock movement';
  end if;

  if quantity_delta = 0 then
    raise exception using errcode = '22023', message = 'Quantity cannot be zero';
  end if;

  select * into current_product
  from public.products
  where id = target_product_id
    and company_id = actor_company_id
  for update;

  next_quantity := current_product.stock_quantity + quantity_delta;
  if next_quantity < 0 then
    raise exception using errcode = '22003', message = 'Stock cannot be negative';
  end if;

  update public.products
  set stock_quantity = next_quantity,
      updated_at = now()
  where id = target_product_id
    and company_id = actor_company_id;

  insert into public.stock_movements (
    company_id, product_id, movement_type, quantity_delta,
    quantity_before, quantity_after, reason, created_by
  ) values (
    actor_company_id, target_product_id, movement_kind, quantity_delta,
    current_product.stock_quantity, next_quantity, nullif(trim(movement_reason), ''), auth.uid()
  ) returning * into created_movement;

  return created_movement;
end;
$$;

revoke all on function public.adjust_product_stock(uuid, public.stock_movement_type, numeric, text) from public;
grant execute on function public.adjust_product_stock(uuid, public.stock_movement_type, numeric, text) to authenticated;

comment on function public.adjust_product_stock(uuid, public.stock_movement_type, numeric, text)
is 'Atomically changes a product balance and appends the corresponding stock ledger entry for an owner/admin.';
