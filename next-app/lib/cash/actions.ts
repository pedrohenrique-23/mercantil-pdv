"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { CashActionResult, CashMovement, CashRegister } from "./types";

const cents = (value: FormDataEntryValue | null) => {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) : NaN;
};
const note = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() || null : null;

export async function openCashRegister(
  formData: FormData
): Promise<CashActionResult<CashRegister>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  const opening = cents(formData.get("opening"));
  if (!Number.isFinite(opening) || opening < 0)
    return { ok: false, error: "Informe um saldo inicial válido." };
  const { data, error } = await supabase.rpc("open_cash_register", {
    opening_amount_cents: opening,
    opening_notes: note(formData.get("notes")),
  });
  if (error)
    return {
      ok: false,
      error:
        error.code === "55000"
          ? "Já existe um caixa aberto para esta empresa."
          : error.message || "Não foi possível abrir o caixa.",
    };
  revalidatePath("/dashboard");
  return { ok: true, data, message: "Caixa aberto com sucesso." };
}

export async function recordCashMovement(
  formData: FormData
): Promise<CashActionResult<CashMovement>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  const registerId = String(formData.get("registerId") ?? "");
  const type = String(formData.get("type") ?? "");
  const amount = cents(formData.get("amount"));
  const parsed = z
    .object({
      registerId: z.string().uuid(),
      type: z.enum(["cash_in", "cash_out"]),
      amount: z.number().positive(),
    })
    .safeParse({ registerId, type, amount });
  if (!parsed.success)
    return { ok: false, error: "Informe um tipo e valor válidos." };
  const { data, error } = await supabase.rpc("record_cash_movement", {
    target_register_id: parsed.data.registerId,
    movement_kind: parsed.data.type,
    amount_cents: parsed.data.amount,
    movement_description: note(formData.get("description")),
  });
  if (error)
    return {
      ok: false,
      error: error.message || "Não foi possível registrar o movimento.",
    };
  revalidatePath("/dashboard");
  return { ok: true, data, message: "Movimento registrado." };
}

export async function closeCashRegister(
  formData: FormData
): Promise<CashActionResult<CashRegister>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  const registerId = String(formData.get("registerId") ?? "");
  const counted = cents(formData.get("counted"));
  const parsed = z
    .object({ registerId: z.string().uuid(), counted: z.number().min(0) })
    .safeParse({ registerId, counted });
  if (!parsed.success)
    return { ok: false, error: "Informe um valor contado válido." };
  const { data, error } = await supabase.rpc("close_cash_register", {
    target_register_id: parsed.data.registerId,
    counted_amount_cents: parsed.data.counted,
    closing_notes: note(formData.get("notes")),
  });
  if (error)
    return {
      ok: false,
      error: error.message || "Não foi possível fechar o caixa.",
    };
  revalidatePath("/dashboard");
  return { ok: true, data, message: "Caixa fechado com sucesso." };
}
