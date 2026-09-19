CREATE TABLE `cashMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cashRegisterId` int NOT NULL,
	`type` enum('sale_cash','entry','exit','withdrawal','customer_payment') NOT NULL,
	`amountCents` int NOT NULL,
	`description` varchar(180),
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cashMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cashRegisters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL DEFAULT 1,
	`userId` int,
	`openingCents` int NOT NULL,
	`closingCents` int,
	`expectedCents` int,
	`differenceCents` int,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`openedAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	CONSTRAINT `cashRegisters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customerPayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL DEFAULT 1,
	`customerId` int NOT NULL,
	`amountCents` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerPayments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL DEFAULT 1,
	`name` varchar(160) NOT NULL,
	`phone` varchar(30),
	`notes` text,
	`debtCents` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financialTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL DEFAULT 1,
	`type` enum('income','expense') NOT NULL,
	`category` varchar(80) NOT NULL,
	`amountCents` int NOT NULL,
	`description` varchar(180),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financialTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL DEFAULT 1,
	`name` varchar(180) NOT NULL,
	`barcode` varchar(32),
	`category` varchar(80),
	`costCents` int NOT NULL DEFAULT 0,
	`saleCents` int NOT NULL,
	`stockQuantity` int NOT NULL DEFAULT 0,
	`minimumStock` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saleItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL,
	`unitPriceCents` int NOT NULL,
	`subtotalCents` int NOT NULL,
	CONSTRAINT `saleItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL DEFAULT 1,
	`userId` int,
	`cashRegisterId` int,
	`customerId` int,
	`totalCents` int NOT NULL,
	`paymentMethod` enum('cash','pix','debit','credit','credit_account') NOT NULL,
	`receivedCents` int NOT NULL DEFAULT 0,
	`changeCents` int NOT NULL DEFAULT 0,
	`status` enum('completed','cancelled') NOT NULL DEFAULT 'completed',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stockMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL DEFAULT 1,
	`productId` int NOT NULL,
	`type` enum('entry','exit','sale','adjustment') NOT NULL,
	`quantity` int NOT NULL,
	`reason` varchar(180),
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stockMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `customers_company_idx` ON `customers` (`companyId`);--> statement-breakpoint
CREATE INDEX `finance_company_idx` ON `financialTransactions` (`companyId`);--> statement-breakpoint
CREATE INDEX `products_company_idx` ON `products` (`companyId`);--> statement-breakpoint
CREATE INDEX `products_barcode_idx` ON `products` (`barcode`);--> statement-breakpoint
CREATE INDEX `sales_company_idx` ON `sales` (`companyId`);--> statement-breakpoint
CREATE INDEX `sales_created_idx` ON `sales` (`createdAt`);--> statement-breakpoint
CREATE INDEX `stock_company_idx` ON `stockMovements` (`companyId`);