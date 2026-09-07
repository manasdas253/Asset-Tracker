CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(120) NOT NULL,
	`value` text,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `asset_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`employeeId` int,
	`employeeName` varchar(160) NOT NULL,
	`employeeCode` varchar(80),
	`departmentName` varchar(120),
	`locationName` varchar(160),
	`purpose` varchar(220),
	`expectedReturnDate` timestamp,
	`checkedOutAt` timestamp,
	`checkedInAt` timestamp,
	`returnCondition` enum('new','good','fair','damaged','critical'),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asset_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `asset_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`subcategory` varchar(120),
	`description` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asset_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `asset_categories_name_subcategory_idx` UNIQUE(`name`,`subcategory`)
);
--> statement-breakpoint
CREATE TABLE `asset_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`fileName` varchar(220) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` text,
	`mimeType` varchar(120),
	`sizeBytes` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asset_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `asset_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`eventType` varchar(80) NOT NULL,
	`title` varchar(220) NOT NULL,
	`description` text,
	`actorName` varchar(160),
	`metadata` text,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asset_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `asset_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`type` enum('checkout','checkin','transfer','damage','retire','dispose','maintenance_start','maintenance_end') NOT NULL,
	`actorName` varchar(160),
	`fromLocation` varchar(160),
	`toLocation` varchar(160),
	`fromEmployee` varchar(160),
	`toEmployee` varchar(160),
	`condition` enum('new','good','fair','damaged','critical'),
	`damageDescription` text,
	`purpose` varchar(220),
	`notes` text,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asset_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` varchar(80) NOT NULL,
	`name` varchar(220) NOT NULL,
	`categoryId` int,
	`categoryName` varchar(120),
	`subcategory` varchar(120),
	`assetType` varchar(120),
	`description` text,
	`serialNumber` varchar(160),
	`manufacturer` varchar(160),
	`brand` varchar(160),
	`model` varchar(160),
	`modelNumber` varchar(160),
	`sku` varchar(160),
	`barcodeNumber` varchar(160),
	`purchaseDate` timestamp,
	`purchaseCost` decimal(14,2),
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`vendor` varchar(180),
	`invoiceNumber` varchar(120),
	`purchaseOrderNumber` varchar(120),
	`warrantyProvider` varchar(180),
	`warrantyStartDate` timestamp,
	`warrantyExpiryDate` timestamp,
	`warrantyTerms` text,
	`departmentId` int,
	`departmentName` varchar(120),
	`locationId` int,
	`locationName` varchar(160),
	`building` varchar(120),
	`floor` varchar(80),
	`storageLocation` varchar(160),
	`condition` enum('new','good','fair','damaged','critical') NOT NULL DEFAULT 'good',
	`status` enum('available','assigned','checked_out','under_maintenance','lost','damaged','retired','disposed') NOT NULL DEFAULT 'available',
	`assignedEmployeeId` int,
	`assignedEmployeeName` varchar(160),
	`assignedEmployeeCode` varchar(80),
	`assignedAt` timestamp,
	`expectedReturnDate` timestamp,
	`lastCheckoutAt` timestamp,
	`lastCheckinAt` timestamp,
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	`imageUrl` text,
	`isDemo` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`retiredAt` timestamp,
	CONSTRAINT `assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `assets_assetId_unique` UNIQUE(`assetId`),
	CONSTRAINT `assets_asset_id_idx` UNIQUE(`assetId`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` int,
	`actorName` varchar(160),
	`beforeData` text,
	`afterData` text,
	`reason` text,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`code` varchar(32) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `departments_name_unique` UNIQUE(`name`),
	CONSTRAINT `departments_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`departmentId` int,
	`email` varchar(320),
	`phone` varchar(40),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `employees_employeeId_unique` UNIQUE(`employeeId`)
);
--> statement-breakpoint
CREATE TABLE `import_errors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`importJobId` int NOT NULL,
	`rowNumber` int NOT NULL,
	`fieldName` varchar(120),
	`message` text NOT NULL,
	`rawData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `import_errors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileName` varchar(220) NOT NULL,
	`totalRows` int NOT NULL DEFAULT 0,
	`successfulRows` int NOT NULL DEFAULT 0,
	`failedRows` int NOT NULL DEFAULT 0,
	`errorCount` int NOT NULL DEFAULT 0,
	`status` enum('validated','completed','failed') NOT NULL DEFAULT 'validated',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `import_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`building` varchar(120),
	`floor` varchar(80),
	`room` varchar(120),
	`description` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`provider` varchar(180),
	`status` enum('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
	`dueDate` timestamp,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`cost` decimal(14,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `maintenance_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('warranty','maintenance','audit','approval','system') NOT NULL,
	`title` varchar(220) NOT NULL,
	`message` text NOT NULL,
	`assetId` int,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `qr_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`token` varchar(96) NOT NULL,
	`publicUrl` text NOT NULL,
	`qrDataUrl` text,
	`isActive` int NOT NULL DEFAULT 1,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`regeneratedAt` timestamp,
	CONSTRAINT `qr_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `qr_codes_assetId_unique` UNIQUE(`assetId`),
	CONSTRAINT `qr_codes_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE INDEX `asset_assignments_asset_idx` ON `asset_assignments` (`assetId`);--> statement-breakpoint
CREATE INDEX `asset_documents_asset_idx` ON `asset_documents` (`assetId`);--> statement-breakpoint
CREATE INDEX `asset_events_asset_idx` ON `asset_events` (`assetId`);--> statement-breakpoint
CREATE INDEX `asset_events_occurred_idx` ON `asset_events` (`occurredAt`);--> statement-breakpoint
CREATE INDEX `asset_transactions_asset_idx` ON `asset_transactions` (`assetId`);--> statement-breakpoint
CREATE INDEX `asset_transactions_type_idx` ON `asset_transactions` (`type`);--> statement-breakpoint
CREATE INDEX `asset_transactions_occurred_idx` ON `asset_transactions` (`occurredAt`);--> statement-breakpoint
CREATE INDEX `assets_serial_idx` ON `assets` (`serialNumber`);--> statement-breakpoint
CREATE INDEX `assets_status_idx` ON `assets` (`status`);--> statement-breakpoint
CREATE INDEX `assets_category_idx` ON `assets` (`categoryId`);--> statement-breakpoint
CREATE INDEX `assets_department_idx` ON `assets` (`departmentId`);--> statement-breakpoint
CREATE INDEX `assets_location_idx` ON `assets` (`locationId`);--> statement-breakpoint
CREATE INDEX `assets_activity_idx` ON `assets` (`lastActivityAt`);--> statement-breakpoint
CREATE INDEX `audit_asset_idx` ON `audit_logs` (`assetId`);--> statement-breakpoint
CREATE INDEX `audit_occurred_idx` ON `audit_logs` (`occurredAt`);--> statement-breakpoint
CREATE INDEX `employees_name_idx` ON `employees` (`name`);--> statement-breakpoint
CREATE INDEX `employees_department_idx` ON `employees` (`departmentId`);--> statement-breakpoint
CREATE INDEX `import_errors_job_idx` ON `import_errors` (`importJobId`);--> statement-breakpoint
CREATE INDEX `locations_name_idx` ON `locations` (`name`);--> statement-breakpoint
CREATE INDEX `maintenance_asset_idx` ON `maintenance_records` (`assetId`);--> statement-breakpoint
CREATE INDEX `maintenance_due_idx` ON `maintenance_records` (`dueDate`);--> statement-breakpoint
CREATE INDEX `notification_read_idx` ON `notification_events` (`isRead`);--> statement-breakpoint
CREATE INDEX `notification_created_idx` ON `notification_events` (`createdAt`);