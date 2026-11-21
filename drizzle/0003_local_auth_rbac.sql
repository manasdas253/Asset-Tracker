CREATE TABLE `auth_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`loginId` varchar(80) NOT NULL,
	`employeeRecordId` int,
	`name` varchar(160) NOT NULL,
	`email` varchar(320),
	`role` enum('admin','employee') NOT NULL DEFAULT 'employee',
	`passwordHash` varchar(255) NOT NULL,
	`passwordVersion` int NOT NULL DEFAULT 1,
	`mustChangePassword` int NOT NULL DEFAULT 1,
	`temporaryPasswordExpiresAt` timestamp,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auth_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_accounts_loginId_unique` UNIQUE(`loginId`),
	CONSTRAINT `auth_accounts_employeeRecordId_unique` UNIQUE(`employeeRecordId`)
);
--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`bucketKey` varchar(64) NOT NULL,
	`attempts` int NOT NULL,
	`windowStart` timestamp NOT NULL,
	CONSTRAINT `auth_rate_limits_bucketKey` PRIMARY KEY(`bucketKey`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`tokenHash` varchar(64) NOT NULL,
	`accountId` int NOT NULL,
	`passwordVersion` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_sessions_tokenHash` PRIMARY KEY(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `employee_asset_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`assetId` int NOT NULL,
	`grantedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_asset_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `employee_asset_permission_idx` UNIQUE(`accountId`,`assetId`)
);
--> statement-breakpoint
CREATE TABLE `security_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int,
	`actor` varchar(80),
	`action` varchar(80) NOT NULL,
	`outcome` enum('success','denied') NOT NULL,
	`assetId` int,
	`ipAddress` varchar(64),
	`details` text,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `security_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `auth_accounts` ADD CONSTRAINT `auth_accounts_employeeRecordId_employees_id_fk` FOREIGN KEY (`employeeRecordId`) REFERENCES `employees`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_accountId_auth_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `auth_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_asset_permissions` ADD CONSTRAINT `employee_asset_permissions_accountId_auth_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `auth_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_asset_permissions` ADD CONSTRAINT `employee_asset_permissions_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_asset_permissions` ADD CONSTRAINT `employee_asset_permissions_grantedBy_auth_accounts_id_fk` FOREIGN KEY (`grantedBy`) REFERENCES `auth_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auth_sessions_account_idx` ON `auth_sessions` (`accountId`);--> statement-breakpoint
CREATE INDEX `auth_sessions_expiry_idx` ON `auth_sessions` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `security_audit_time_idx` ON `security_audit_logs` (`occurredAt`);--> statement-breakpoint
CREATE INDEX `security_audit_account_idx` ON `security_audit_logs` (`accountId`);