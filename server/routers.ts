import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  cashMovements,
  cashRegisters,
  customerPayments,
  customers,
  financialTransactions,
  getCashSummary,
  getDailySales,
  getDashboardData,
  getDb,
  getOpenCashRegister,
  listCustomers,
  listProducts,
  products,
  saleItems,
  sales,
  stockMovements,
} from "./db";
import { calculateChange, validateFiadoCustomer } from "./domain";

const cents = z.number().int().min(0);
const productInput = z.object({
  name: z.string().trim().min(2).max(180),
  barcode: z.string().trim().max(32).optional().or(z.literal("")),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  costCents: cents.default(0),
  saleCents: cents,
  stockQuantity: z.number().int().min(0).default(0),
  minimumStock: z.number().int().min(0).default(0),
});
const saleItemInput = z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive() });

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  dashboard: protectedProcedure.query(() => getDashboardData()),

  products: router({
    list: protectedProcedure.input(z.object({ search: z.string().default("") }).optional()).query(({ input }) => listProducts(input?.search ?? "")),
    create: protectedProcedure.input(productInput).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      const created = await db.insert(products).values({ ...input, barcode: input.barcode || null, category: input.category || null }).$returningId();
      const productId = created[0]?.id;
      if (productId && input.stockQuantity > 0) {
        await db.insert(stockMovements).values({ companyId: 1, productId, type: "entry", quantity: input.stockQuantity, reason: "Estoque inicial" });
      }
      return { id: productId };
    }),
    update: protectedProcedure.input(productInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      const { id, ...values } = input;
      const current = await db.select().from(products).where(and(eq(products.id, id), eq(products.companyId, 1))).limit(1);
      if (!current[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
      await db.update(products).set({ ...values, barcode: values.barcode || null, category: values.category || null }).where(eq(products.id, id));
      const delta = input.stockQuantity - current[0].stockQuantity;
      if (delta !== 0) await db.insert(stockMovements).values({ companyId: 1, productId: id, type: "adjustment", quantity: Math.abs(delta), reason: "Edição do cadastro" });
      return { success: true };
    }),
    deactivate: protectedProcedure.input(z.object({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      await db.update(products).set({ active: input.active }).where(and(eq(products.id, input.id), eq(products.companyId, 1)));
      return { success: true };
    }),
    adjustStock: protectedProcedure.input(z.object({ productId: z.number().int().positive(), quantity: z.number().int(), reason: z.string().trim().min(2).max(180) })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      const product = await db.select().from(products).where(and(eq(products.id, input.productId), eq(products.companyId, 1))).limit(1);
      if (!product[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
      const nextStock = product[0].stockQuantity + input.quantity;
      if (nextStock < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "O estoque não pode ficar negativo" });
      await db.update(products).set({ stockQuantity: nextStock }).where(eq(products.id, input.productId));
      await db.insert(stockMovements).values({ companyId: 1, productId: input.productId, type: input.quantity >= 0 ? "entry" : "exit", quantity: Math.abs(input.quantity), reason: input.reason, userId: ctx.user.id });
      return { success: true };
    }),
  }),

  customers: router({
    list: protectedProcedure.input(z.object({ search: z.string().default("") }).optional()).query(({ input }) => listCustomers(input?.search ?? "")),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), phone: z.string().trim().max(30).optional(), notes: z.string().trim().max(500).optional() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      const created = await db.insert(customers).values({ ...input, phone: input.phone || null, notes: input.notes || null }).$returningId();
      return { id: created[0]?.id };
    }),
    payDebt: protectedProcedure.input(z.object({ customerId: z.number().int().positive(), amountCents: cents })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      const customer = await db.select().from(customers).where(and(eq(customers.id, input.customerId), eq(customers.companyId, 1))).limit(1);
      if (!customer[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
      if (input.amountCents <= 0 || input.amountCents > customer[0].debtCents) throw new TRPCError({ code: "BAD_REQUEST", message: "Valor de pagamento inválido" });
      const register = await getOpenCashRegister();
      await db.update(customers).set({ debtCents: customer[0].debtCents - input.amountCents }).where(eq(customers.id, input.customerId));
      await db.insert(customerPayments).values({ companyId: 1, customerId: input.customerId, amountCents: input.amountCents });
      await db.insert(financialTransactions).values({ companyId: 1, type: "income", category: "Recebimento de fiado", amountCents: input.amountCents, description: customer[0].name });
      if (register) await db.insert(cashMovements).values({ cashRegisterId: register.id, type: "customer_payment", amountCents: input.amountCents, description: `Pagamento de ${customer[0].name}`, userId: ctx.user.id });
      return { success: true };
    }),
  }),

  cash: router({
    state: protectedProcedure.query(async () => {
      const register = await getOpenCashRegister();
      return register ? { register, summary: await getCashSummary(register.id) } : { register: null, summary: null };
    }),
    open: protectedProcedure.input(z.object({ openingCents: cents })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      if (await getOpenCashRegister()) throw new TRPCError({ code: "CONFLICT", message: "Já existe um caixa aberto" });
      const created = await db.insert(cashRegisters).values({ companyId: 1, userId: ctx.user.id, openingCents: input.openingCents }).$returningId();
      return { id: created[0]?.id };
    }),
    close: protectedProcedure.input(z.object({ closingCents: cents })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      const register = await getOpenCashRegister();
      if (!register) throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum caixa aberto" });
      const summary = await getCashSummary(register.id);
      const differenceCents = input.closingCents - summary.expectedCents;
      await db.update(cashRegisters).set({ closingCents: input.closingCents, expectedCents: summary.expectedCents, differenceCents, status: "closed", closedAt: new Date() }).where(eq(cashRegisters.id, register.id));
      return { expectedCents: summary.expectedCents, differenceCents };
    }),
    movement: protectedProcedure.input(z.object({ type: z.enum(["entry", "exit", "withdrawal"]), amountCents: cents, description: z.string().trim().min(2).max(180) })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      const register = await getOpenCashRegister();
      if (!register) throw new TRPCError({ code: "BAD_REQUEST", message: "Abra o caixa antes de lançar uma movimentação" });
      await db.insert(cashMovements).values({ cashRegisterId: register.id, type: input.type, amountCents: input.amountCents, description: input.description, userId: ctx.user.id });
      await db.insert(financialTransactions).values({ companyId: 1, type: input.type === "entry" ? "income" : "expense", category: input.type === "entry" ? "Entrada de caixa" : "Saída de caixa", amountCents: input.amountCents, description: input.description });
      return { success: true };
    }),
  }),

  sales: router({
    complete: protectedProcedure.input(z.object({ items: z.array(saleItemInput).min(1), paymentMethod: z.enum(["cash", "pix", "debit", "credit", "credit_account"]), receivedCents: cents.default(0), customerId: z.number().int().positive().optional() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível" });
      const register = await getOpenCashRegister();
      if (!register) throw new TRPCError({ code: "BAD_REQUEST", message: "Abra o caixa antes de registrar uma venda" });
      try {
        validateFiadoCustomer(input.paymentMethod, input.customerId);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Selecione o cliente do fiado" });
      }
      const ids = input.items.map((item) => item.productId);
      const found = await db.select().from(products).where(and(eq(products.companyId, 1), eq(products.active, true), sql`${products.id} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`));
      const byId = new Map(found.map((product) => [product.id, product]));
      let totalCents = 0;
      const lineItems = input.items.map((item) => {
        const product = byId.get(item.productId);
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Um produto da venda não está disponível" });
        if (product.stockQuantity < item.quantity) throw new TRPCError({ code: "BAD_REQUEST", message: `Estoque insuficiente para ${product.name}` });
        const subtotalCents = product.saleCents * item.quantity;
        totalCents += subtotalCents;
        return { product, quantity: item.quantity, subtotalCents };
      });
      let changeCents = 0;
      if (input.paymentMethod === "cash") {
        try {
          changeCents = calculateChange(totalCents, input.receivedCents);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "O valor recebido é menor que o total" });
        }
      }
      const sale = await db.transaction(async (tx) => {
        const created = await tx.insert(sales).values({ companyId: 1, userId: ctx.user.id, cashRegisterId: register.id, customerId: input.customerId, totalCents, paymentMethod: input.paymentMethod, receivedCents: input.receivedCents, changeCents }).$returningId();
        const saleId = created[0]?.id;
        if (!saleId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível registrar a venda" });
        for (const line of lineItems) {
          await tx.insert(saleItems).values({ saleId, productId: line.product.id, quantity: line.quantity, unitPriceCents: line.product.saleCents, subtotalCents: line.subtotalCents });
          await tx.update(products).set({ stockQuantity: sql`${products.stockQuantity} - ${line.quantity}` }).where(eq(products.id, line.product.id));
          await tx.insert(stockMovements).values({ companyId: 1, productId: line.product.id, type: "sale", quantity: line.quantity, reason: `Venda #${saleId}`, userId: ctx.user.id });
        }
        if (input.paymentMethod === "cash") await tx.insert(cashMovements).values({ cashRegisterId: register.id, type: "sale_cash", amountCents: totalCents, description: `Venda #${saleId}`, userId: ctx.user.id });
        if (input.paymentMethod === "credit_account" && input.customerId) {
          await tx.update(customers).set({ debtCents: sql`${customers.debtCents} + ${totalCents}` }).where(eq(customers.id, input.customerId));
        }
        await tx.insert(financialTransactions).values({ companyId: 1, type: "income", category: input.paymentMethod === "credit_account" ? "Venda fiada" : "Venda", amountCents: totalCents, description: `Venda #${saleId}` });
        return saleId;
      });
      return { saleId: sale, totalCents, changeCents };
    }),
  }),

  reports: router({
    daily: protectedProcedure.input(z.object({ from: z.string(), to: z.string() })).query(({ input }) => {
      const from = new Date(`${input.from}T00:00:00`);
      const to = new Date(`${input.to}T23:59:59.999`);
      return getDailySales(from, to);
    }),
  }),
});

export type AppRouter = typeof appRouter;
