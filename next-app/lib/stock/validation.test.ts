import { describe, expect, it } from "vitest";
import {
  signedMovementQuantity,
  stockMovementInputSchema,
  parseStockQuantity,
} from "./validation";

describe("stock movement validation", () => {
  it("keeps inbound movements positive and outbound movements negative", () => {
    expect(signedMovementQuantity("purchase", 4)).toBe(4);
    expect(signedMovementQuantity("return", 1.5)).toBe(1.5);
    expect(signedMovementQuantity("adjustment_out", 2)).toBe(-2);
    expect(signedMovementQuantity("loss", 0.25)).toBe(-0.25);
  });

  it("parses Brazilian decimal quantities", () => {
    expect(parseStockQuantity("2,500")).toBe(2.5);
    expect(parseStockQuantity("10")).toBe(10);
    expect(Number.isNaN(parseStockQuantity("abc"))).toBe(true);
  });

  it("rejects zero and negative quantities", () => {
    const base = {
      productId: "11111111-1111-4111-8111-111111111111",
      movementType: "purchase" as const,
      reason: null,
    };
    expect(
      stockMovementInputSchema.safeParse({ ...base, quantity: 1 }).success
    ).toBe(true);
    expect(
      stockMovementInputSchema.safeParse({ ...base, quantity: 0 }).success
    ).toBe(false);
    expect(
      stockMovementInputSchema.safeParse({ ...base, quantity: -1 }).success
    ).toBe(false);
  });
});
