import type { Tables } from "@/types/database";

export type StockMovement = Tables<"stock_movements">;
export type StockProduct = Pick<
  Tables<"products">,
  | "id"
  | "name"
  | "barcode"
  | "sku"
  | "unit"
  | "stock_quantity"
  | "min_stock_quantity"
  | "is_active"
>;

export type StockData = {
  products: StockProduct[];
  movements: StockMovement[];
  error?: string;
};

export type StockActionResult<T> =
  | { ok: true; data: T; message: string }
  | { ok: false; error: string };

export const movementOptions = [
  { value: "purchase", label: "Entrada de compra", sign: 1 },
  { value: "adjustment_in", label: "Ajuste positivo", sign: 1 },
  { value: "adjustment_out", label: "Ajuste negativo", sign: -1 },
  { value: "return", label: "Devolução", sign: 1 },
  { value: "loss", label: "Perda ou avaria", sign: -1 },
] as const;

export type ManualMovement = (typeof movementOptions)[number]["value"];
