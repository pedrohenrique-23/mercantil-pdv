import type { Tables } from "@/types/database";

export type Category = Tables<"categories">;
export type Product = Tables<"products">;

export type CatalogData = {
  companyId: string | null;
  categories: Category[];
  products: Product[];
  error?: string;
};

export type CatalogActionResult<T> =
  | { ok: true; data: T; message: string }
  | { ok: false; error: string };

export const productUnits = [
  { value: "unit", label: "Unidade" },
  { value: "kg", label: "Quilo" },
  { value: "g", label: "Grama" },
  { value: "l", label: "Litro" },
  { value: "ml", label: "Mililitro" },
  { value: "box", label: "Caixa" },
  { value: "pack", label: "Pacote" },
] as const;

export type ProductUnit = (typeof productUnits)[number]["value"];
