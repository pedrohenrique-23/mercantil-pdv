import { and, asc, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  cashMovements,
  cashRegisters,
  customerPayments,
  customers,
  financialTransactions,
  products,
  saleItems,
  sales,
  stockMovements,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { calculateExpectedCash } from "./domain";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listProducts(search = "") {
  const db = await getDb();
  if (!db) return [];
  const term = search.trim();
  const where = term
    ? and(
        eq(products.companyId, 1),
        or(like(products.name, `%${term}%`), like(products.barcode, `%${term}%`)),
      )
    : eq(products.companyId, 1);
  return db.select().from(products).where(where).orderBy(asc(products.name));
}

export async function listCustomers(search = "") {
  const db = await getDb();
  if (!db) return [];
  const term = search.trim();
  const where = term
    ? and(eq(customers.companyId, 1), like(customers.name, `%${term}%`))
    : eq(customers.companyId, 1);
  return db.select().from(customers).where(where).orderBy(asc(customers.name));
}

export async function getOpenCashRegister() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(cashRegisters)
    .where(and(eq(cashRegisters.companyId, 1), eq(cashRegisters.status, "open")))
    .orderBy(desc(cashRegisters.openedAt))
    .limit(1);
  return result[0];
}

export async function getCashSummary(registerId: number) {
  const db = await getDb();
  if (!db) return { cashSalesCents: 0, entriesCents: 0, exitsCents: 0, customerPaymentsCents: 0, expectedCents: 0 };
  const rows = await db
    .select({ type: cashMovements.type, total: sql<number>`COALESCE(SUM(${cashMovements.amountCents}), 0)` })
    .from(cashMovements)
    .where(eq(cashMovements.cashRegisterId, registerId))
    .groupBy(cashMovements.type);
  const byType = Object.fromEntries(rows.map((row) => [row.type, Number(row.total ?? 0)]));
  const register = await db.select().from(cashRegisters).where(eq(cashRegisters.id, registerId)).limit(1);
  const opening = register[0]?.openingCents ?? 0;
  const cashSalesCents = byType.sale_cash ?? 0;
  const entriesCents = byType.entry ?? 0;
  const exitsCents = (byType.exit ?? 0) + (byType.withdrawal ?? 0);
  const customerPaymentsCents = byType.customer_payment ?? 0;
  return {
    cashSalesCents,
    entriesCents,
    exitsCents,
    customerPaymentsCents,
    expectedCents: calculateExpectedCash(opening, cashSalesCents, entriesCents, customerPaymentsCents, exitsCents),
  };
}

export async function getDashboardData() {
  const db = await getDb();
  if (!db) return { todaySalesCents: 0, monthSalesCents: 0, lowStockCount: 0, openDebtCents: 0, salesByDay: [] };
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [today, month, lowStock, debt, salesByDay] = await Promise.all([
    db.select({ total: sql<number>`COALESCE(SUM(${sales.totalCents}), 0)` }).from(sales).where(and(eq(sales.companyId, 1), eq(sales.status, "completed"), gte(sales.createdAt, dayStart))),
    db.select({ total: sql<number>`COALESCE(SUM(${sales.totalCents}), 0)` }).from(sales).where(and(eq(sales.companyId, 1), eq(sales.status, "completed"), gte(sales.createdAt, monthStart))),
    db.select({ total: sql<number>`COUNT(*)` }).from(products).where(and(eq(products.companyId, 1), eq(products.active, true), sql`${products.stockQuantity} <= ${products.minimumStock}`)),
    db.select({ total: sql<number>`COALESCE(SUM(${customers.debtCents}), 0)` }).from(customers).where(eq(customers.companyId, 1)),
    db.select({ date: sql<string>`DATE_FORMAT(${sales.createdAt}, '%d/%m')`, total: sql<number>`COALESCE(SUM(${sales.totalCents}), 0)` }).from(sales).where(and(eq(sales.companyId, 1), eq(sales.status, "completed"), gte(sales.createdAt, new Date(now.getTime() - 6 * 86400000)))).groupBy(sql`DATE(${sales.createdAt})`).orderBy(sql`DATE(${sales.createdAt})`),
  ]);
  return {
    todaySalesCents: Number(today[0]?.total ?? 0),
    monthSalesCents: Number(month[0]?.total ?? 0),
    lowStockCount: Number(lowStock[0]?.total ?? 0),
    openDebtCents: Number(debt[0]?.total ?? 0),
    salesByDay: salesByDay.map((row) => ({ date: row.date, totalCents: Number(row.total ?? 0) })),
  };
}

export async function getDailySales(from: Date, to: Date) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ date: sql<string>`DATE_FORMAT(${sales.createdAt}, '%Y-%m-%d')`, totalCents: sql<number>`COALESCE(SUM(${sales.totalCents}), 0)`, count: sql<number>`COUNT(*)` })
    .from(sales)
    .where(and(eq(sales.companyId, 1), eq(sales.status, "completed"), gte(sales.createdAt, from), lte(sales.createdAt, to)))
    .groupBy(sql`DATE(${sales.createdAt})`)
    .orderBy(sql`DATE(${sales.createdAt})`);
}

export { cashMovements, cashRegisters, customerPayments, customers, financialTransactions, products, saleItems, sales, stockMovements, users };
