import { describe, expect, it } from "vitest";
import { calculateDifference, calculateExpectedCash } from "./types";

describe("cash register calculations", () => {
  it("calculates expected cash from opening and movements", () => {
    expect(
      calculateExpectedCash(10000, [
        { amount_cents: 2500 },
        { amount_cents: -700 },
      ])
    ).toBe(11800);
  });

  it("calculates shortages and surpluses from the counted amount", () => {
    expect(calculateDifference(11800, 11800)).toBe(0);
    expect(calculateDifference(11500, 11800)).toBe(-300);
    expect(calculateDifference(12000, 11800)).toBe(200);
  });
});
