import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Tenant root. The MVP starts with company id 1 and keeps the boundary explicit. */
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("companyId").notNull().default(1),
    name: varchar("name", { length: 180 }).notNull(),
    barcode: varchar("barcode", { length: 32 }),
    category: varchar("category", { length: 80 }),
    costCents: int("costCents").notNull().default(0),
    saleCents: int("saleCents").notNull(),
    stockQuantity: int("stockQuantity").notNull().default(0),
    minimumStock: int("minimumStock").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    companyIdx: index("products_company_idx").on(table.companyId),
    barcodeIdx: index("products_barcode_idx").on(table.barcode),
  }),
);

export const customers = mysqlTable(
  "customers",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("companyId").notNull().default(1),
    name: varchar("name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 30 }),
    notes: text("notes"),
    debtCents: int("debtCents").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ companyIdx: index("customers_company_idx").on(table.companyId) }),
);

export const cashRegisters = mysqlTable("cashRegisters", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().default(1),
  userId: int("userId"),
  openingCents: int("openingCents").notNull(),
  closingCents: int("closingCents"),
  expectedCents: int("expectedCents"),
  differenceCents: int("differenceCents"),
  status: mysqlEnum("status", ["open", "closed"]).notNull().default("open"),
  openedAt: timestamp("openedAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
});

export const sales = mysqlTable(
  "sales",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("companyId").notNull().default(1),
    userId: int("userId"),
    cashRegisterId: int("cashRegisterId"),
    customerId: int("customerId"),
    totalCents: int("totalCents").notNull(),
    paymentMethod: mysqlEnum("paymentMethod", ["cash", "pix", "debit", "credit", "credit_account"]).notNull(),
    receivedCents: int("receivedCents").notNull().default(0),
    changeCents: int("changeCents").notNull().default(0),
    status: mysqlEnum("status", ["completed", "cancelled"]).notNull().default("completed"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("sales_company_idx").on(table.companyId),
    createdIdx: index("sales_created_idx").on(table.createdAt),
  }),
);

export const saleItems = mysqlTable("saleItems", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull(),
  productId: int("productId").notNull(),
  quantity: int("quantity").notNull(),
  unitPriceCents: int("unitPriceCents").notNull(),
  subtotalCents: int("subtotalCents").notNull(),
});

export const stockMovements = mysqlTable(
  "stockMovements",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("companyId").notNull().default(1),
    productId: int("productId").notNull(),
    type: mysqlEnum("type", ["entry", "exit", "sale", "adjustment"]).notNull(),
    quantity: int("quantity").notNull(),
    reason: varchar("reason", { length: 180 }),
    userId: int("userId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ companyIdx: index("stock_company_idx").on(table.companyId) }),
);

export const cashMovements = mysqlTable("cashMovements", {
  id: int("id").autoincrement().primaryKey(),
  cashRegisterId: int("cashRegisterId").notNull(),
  type: mysqlEnum("type", ["sale_cash", "entry", "exit", "withdrawal", "customer_payment"]).notNull(),
  amountCents: int("amountCents").notNull(),
  description: varchar("description", { length: 180 }),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const financialTransactions = mysqlTable(
  "financialTransactions",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("companyId").notNull().default(1),
    type: mysqlEnum("type", ["income", "expense"]).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    amountCents: int("amountCents").notNull(),
    description: varchar("description", { length: 180 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ companyIdx: index("finance_company_idx").on(table.companyId) }),
);

export const customerPayments = mysqlTable("customerPayments", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().default(1),
  customerId: int("customerId").notNull(),
  amountCents: int("amountCents").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type CashRegister = typeof cashRegisters.$inferSelect;
export type Sale = typeof sales.$inferSelect;
