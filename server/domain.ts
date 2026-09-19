export function calculateExpectedCash(openingCents: number, cashSalesCents: number, entriesCents: number, customerPaymentsCents: number, exitsCents: number) {
  return openingCents + cashSalesCents + entriesCents + customerPaymentsCents - exitsCents;
}

export function calculateChange(totalCents: number, receivedCents: number) {
  if (receivedCents < totalCents) throw new Error("O valor recebido é menor que o total");
  return receivedCents - totalCents;
}

export function validateFiadoCustomer(paymentMethod: string, customerId?: number) {
  if (paymentMethod === "credit_account" && !customerId) throw new Error("Selecione o cliente do fiado");
  return true;
}
