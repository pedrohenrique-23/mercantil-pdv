import { describe, expect, it } from "vitest";
import {
  categoryInputSchema,
  optionalText,
  parseMoneyToCents,
  parseQuantity,
  productInputSchema,
} from "./validation";

describe("catalog validation", () => {
  it("converts Brazilian money input to integer cents", () => {
    expect(parseMoneyToCents("12,50")).toBe(1250);
    expect(parseMoneyToCents("0.99")).toBe(99);
    expect(Number.isNaN(parseMoneyToCents("abc"))).toBe(true);
  });

  it("parses decimal stock quantities and normalizes optional text", () => {
    expect(parseQuantity("2,500")).toBe(2.5);
    expect(parseQuantity("0")).toBe(0);
    expect(Number.isNaN(parseQuantity(""))).toBe(false);
    expect(optionalText("  ABC-123 ")).toBe("ABC-123");
    expect(optionalText("   ")).toBeNull();
  });

  it("accepts valid catalog inputs and rejects unsafe values", () => {
    expect(categoryInputSchema.safeParse({ name: "Bebidas" }).success).toBe(
      true
    );
    expect(categoryInputSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(
      productInputSchema.safeParse({
        name: "Arroz",
        categoryId: null,
        barcode: null,
        sku: "ARR-001",
        unit: "kg",
        costCents: 1200,
        saleCents: 1800,
        stockQuantity: 10,
        minStockQuantity: 2,
      }).success
    ).toBe(true);
    expect(
      productInputSchema.safeParse({
        name: "Produto inválido",
        categoryId: null,
        barcode: null,
        sku: null,
        unit: "unit",
        costCents: -1,
        saleCents: 100,
        stockQuantity: 0,
        minStockQuantity: 0,
      }).success
    ).toBe(false);
  });
});
