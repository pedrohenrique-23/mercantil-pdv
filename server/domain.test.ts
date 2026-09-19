import { describe, expect, it } from "vitest";
import { calculateChange, calculateExpectedCash, validateFiadoCustomer } from "./domain";

describe("regras financeiras do mercantil", () => {
  it("calcula o troco corretamente", () => {
    expect(calculateChange(1850, 2000)).toBe(150);
  });

  it("recusa pagamento em dinheiro abaixo do total", () => {
    expect(() => calculateChange(1850, 1800)).toThrow("menor que o total");
  });

  it("calcula o valor esperado no fechamento", () => {
    expect(calculateExpectedCash(10000, 25000, 5000, 2000, 3000)).toBe(39000);
  });

  it("exige cliente para venda fiada", () => {
    expect(() => validateFiadoCustomer("credit_account")).toThrow("cliente do fiado");
    expect(validateFiadoCustomer("credit_account", 12)).toBe(true);
    expect(validateFiadoCustomer("pix")).toBe(true);
  });
});
