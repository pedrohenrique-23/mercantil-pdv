import type { Tables } from "@/types/database";

export type CashRegister = Tables<"cash_registers">;
export type CashMovement = Tables<"cash_movements">;
export type CashData = {
  register: CashRegister | null;
  movements: CashMovement[];
  error?: string;
};
export type CashActionResult<T> =
  | { ok: true; data: T; message: string }
  | { ok: false; error: string };

export const cashMovementLabels: Record<CashMovement["movement_type"], string> =
  {
    opening: "Abertura",
    sale: "Venda",
    cash_in: "Entrada manual",
    cash_out: "Saída manual",
    closing_adjustment: "Ajuste de fechamento",
  };

export function calculateExpectedCash(
  openingCents: number,
  movements: Pick<CashMovement, "amount_cents">[]
) {
  return (
    openingCents +
    movements.reduce((total, movement) => total + movement.amount_cents, 0)
  );
}

export function calculateDifference(
  countedCents: number,
  expectedCents: number
) {
  return countedCents - expectedCents;
}
