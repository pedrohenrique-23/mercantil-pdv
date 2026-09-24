-- Mercantil PDV: transactional cash register operations.

create or replace function public.open_cash_register(opening_amount_cents integer, opening_notes text default null)
returns public.cash_registers
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_company_id uuid;
  created_register public.cash_registers;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if opening_amount_cents < 0 then raise exception using errcode = '22003', message = 'Opening amount cannot be negative'; end if;

  select company_id into actor_company_id from public.company_members
  where user_id = auth.uid() order by created_at asc limit 1;
  if actor_company_id is null then raise exception using errcode = '42501', message = 'No active company'; end if;

  if exists (select 1 from public.cash_registers where company_id = actor_company_id and status = 'open') then
    raise exception using errcode = '55000', message = 'An open cash register already exists';
  end if;

  insert into public.cash_registers (company_id, opened_by, status, opening_cents, notes)
  values (actor_company_id, auth.uid(), 'open', opening_amount_cents, nullif(trim(opening_notes), ''))
  returning * into created_register;

  insert into public.cash_movements (company_id, cash_register_id, movement_type, amount_cents, description, created_by)
  values (actor_company_id, created_register.id, 'opening', opening_amount_cents, 'Saldo inicial', auth.uid());

  return created_register;
end;
$$;

create or replace function public.record_cash_movement(
  target_register_id uuid,
  movement_kind public.cash_movement_type,
  amount_cents integer,
  movement_description text default null
)
returns public.cash_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  target_register public.cash_registers;
  created_movement public.cash_movements;
  signed_amount integer;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if movement_kind not in ('cash_in', 'cash_out') then raise exception using errcode = '22023', message = 'Invalid manual cash movement'; end if;
  if amount_cents <= 0 then raise exception using errcode = '22023', message = 'Amount must be positive'; end if;

  select * into target_register from public.cash_registers cr
  where cr.id = target_register_id and cr.status = 'open'
    and public.is_company_member(cr.company_id) for update;
  if target_register.id is null then raise exception using errcode = '55000', message = 'Open cash register not found'; end if;

  signed_amount := case when movement_kind = 'cash_out' then -amount_cents else amount_cents end;
  insert into public.cash_movements (company_id, cash_register_id, movement_type, amount_cents, description, created_by)
  values (target_register.company_id, target_register.id, movement_kind, signed_amount, nullif(trim(movement_description), ''), auth.uid())
  returning * into created_movement;
  return created_movement;
end;
$$;

create or replace function public.close_cash_register(
  target_register_id uuid,
  counted_amount_cents integer,
  closing_notes text default null
)
returns public.cash_registers
language plpgsql
security definer
set search_path = public
as $$
declare
  target_register public.cash_registers;
  calculated_expected integer;
  difference integer;
  closed_register public.cash_registers;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if counted_amount_cents < 0 then raise exception using errcode = '22003', message = 'Counted amount cannot be negative'; end if;

  select * into target_register from public.cash_registers cr
  where cr.id = target_register_id and cr.status = 'open'
    and public.is_company_member(cr.company_id) for update;
  if target_register.id is null then raise exception using errcode = '55000', message = 'Open cash register not found'; end if;

  select coalesce(sum(amount_cents), target_register.opening_cents)::integer into calculated_expected
  from public.cash_movements where cash_register_id = target_register.id;
  difference := counted_amount_cents - calculated_expected;

  update public.cash_registers set status = 'closed', closed_by = auth.uid(), expected_cents = calculated_expected,
    counted_cents = counted_amount_cents, difference_cents = difference, closed_at = now(), notes = coalesce(nullif(trim(closing_notes), ''), notes)
  where id = target_register.id returning * into closed_register;
  return closed_register;
end;
$$;

revoke all on function public.open_cash_register(integer, text) from public;
revoke all on function public.record_cash_movement(uuid, public.cash_movement_type, integer, text) from public;
revoke all on function public.close_cash_register(uuid, integer, text) from public;
grant execute on function public.open_cash_register(integer, text) to authenticated;
grant execute on function public.record_cash_movement(uuid, public.cash_movement_type, integer, text) to authenticated;
grant execute on function public.close_cash_register(uuid, integer, text) to authenticated;
