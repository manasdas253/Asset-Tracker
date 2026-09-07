import {
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
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

export const assetCategories = mysqlTable("asset_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  subcategory: varchar("subcategory", { length: 120 }),
  description: text("description"),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  nameIdx: uniqueIndex("asset_categories_name_subcategory_idx").on(table.name, table.subcategory),
}));

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const locations = mysqlTable("locations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  building: varchar("building", { length: 120 }),
  floor: varchar("floor", { length: 80 }),
  room: varchar("room", { length: 120 }),
  description: text("description"),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  nameIdx: index("locations_name_idx").on(table.name),
}));

export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: varchar("employeeId", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  departmentId: int("departmentId"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 40 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  nameIdx: index("employees_name_idx").on(table.name),
  departmentIdx: index("employees_department_idx").on(table.departmentId),
}));

export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  assetId: varchar("assetId", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 220 }).notNull(),
  categoryId: int("categoryId"),
  categoryName: varchar("categoryName", { length: 120 }),
  subcategory: varchar("subcategory", { length: 120 }),
  assetType: varchar("assetType", { length: 120 }),
  description: text("description"),
  serialNumber: varchar("serialNumber", { length: 160 }),
  manufacturer: varchar("manufacturer", { length: 160 }),
  brand: varchar("brand", { length: 160 }),
  model: varchar("model", { length: 160 }),
  modelNumber: varchar("modelNumber", { length: 160 }),
  sku: varchar("sku", { length: 160 }),
  barcodeNumber: varchar("barcodeNumber", { length: 160 }),
  purchaseDate: timestamp("purchaseDate"),
  purchaseCost: decimal("purchaseCost", { precision: 14, scale: 2 }),
  currency: varchar("currency", { length: 8 }).default("USD").notNull(),
  vendor: varchar("vendor", { length: 180 }),
  invoiceNumber: varchar("invoiceNumber", { length: 120 }),
  purchaseOrderNumber: varchar("purchaseOrderNumber", { length: 120 }),
  warrantyProvider: varchar("warrantyProvider", { length: 180 }),
  warrantyStartDate: timestamp("warrantyStartDate"),
  warrantyExpiryDate: timestamp("warrantyExpiryDate"),
  warrantyTerms: text("warrantyTerms"),
  departmentId: int("departmentId"),
  departmentName: varchar("departmentName", { length: 120 }),
  locationId: int("locationId"),
  locationName: varchar("locationName", { length: 160 }),
  building: varchar("building", { length: 120 }),
  floor: varchar("floor", { length: 80 }),
  storageLocation: varchar("storageLocation", { length: 160 }),
  condition: mysqlEnum("condition", ["new", "good", "fair", "damaged", "critical"]).default("good").notNull(),
  status: mysqlEnum("status", ["available", "assigned", "checked_out", "under_maintenance", "lost", "damaged", "retired", "disposed"]).default("available").notNull(),
  assignedEmployeeId: int("assignedEmployeeId"),
  assignedEmployeeName: varchar("assignedEmployeeName", { length: 160 }),
  assignedEmployeeCode: varchar("assignedEmployeeCode", { length: 80 }),
  assignedAt: timestamp("assignedAt"),
  expectedReturnDate: timestamp("expectedReturnDate"),
  lastCheckoutAt: timestamp("lastCheckoutAt"),
  lastCheckinAt: timestamp("lastCheckinAt"),
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
  notes: text("notes"),
  imageUrl: text("imageUrl"),
  isDemo: int("isDemo").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  retiredAt: timestamp("retiredAt"),
}, table => ({
  assetIdIdx: uniqueIndex("assets_asset_id_idx").on(table.assetId),
  serialIdx: index("assets_serial_idx").on(table.serialNumber),
  statusIdx: index("assets_status_idx").on(table.status),
  categoryIdx: index("assets_category_idx").on(table.categoryId),
  departmentIdx: index("assets_department_idx").on(table.departmentId),
  locationIdx: index("assets_location_idx").on(table.locationId),
  activityIdx: index("assets_activity_idx").on(table.lastActivityAt),
}));

export const qrCodes = mysqlTable("qr_codes", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull().unique(),
  token: varchar("token", { length: 96 }).notNull().unique(),
  publicUrl: text("publicUrl").notNull(),
  qrDataUrl: text("qrDataUrl"),
  isActive: int("isActive").default(1).notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  regeneratedAt: timestamp("regeneratedAt"),
});

export const assetAssignments = mysqlTable("asset_assignments", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  employeeId: int("employeeId"),
  employeeName: varchar("employeeName", { length: 160 }).notNull(),
  employeeCode: varchar("employeeCode", { length: 80 }),
  departmentName: varchar("departmentName", { length: 120 }),
  locationName: varchar("locationName", { length: 160 }),
  purpose: varchar("purpose", { length: 220 }),
  expectedReturnDate: timestamp("expectedReturnDate"),
  checkedOutAt: timestamp("checkedOutAt"),
  checkedInAt: timestamp("checkedInAt"),
  returnCondition: mysqlEnum("returnCondition", ["new", "good", "fair", "damaged", "critical"]),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  assetIdx: index("asset_assignments_asset_idx").on(table.assetId),
}));

export const assetTransactions = mysqlTable("asset_transactions", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  type: mysqlEnum("type", ["checkout", "checkin", "transfer", "damage", "retire", "dispose", "maintenance_start", "maintenance_end"]).notNull(),
  actorName: varchar("actorName", { length: 160 }),
  fromLocation: varchar("fromLocation", { length: 160 }),
  toLocation: varchar("toLocation", { length: 160 }),
  fromEmployee: varchar("fromEmployee", { length: 160 }),
  toEmployee: varchar("toEmployee", { length: 160 }),
  condition: mysqlEnum("condition", ["new", "good", "fair", "damaged", "critical"]),
  damageDescription: text("damageDescription"),
  purpose: varchar("purpose", { length: 220 }),
  notes: text("notes"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, table => ({
  assetIdx: index("asset_transactions_asset_idx").on(table.assetId),
  typeIdx: index("asset_transactions_type_idx").on(table.type),
  occurredIdx: index("asset_transactions_occurred_idx").on(table.occurredAt),
}));

export const maintenanceRecords = mysqlTable("maintenance_records", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  provider: varchar("provider", { length: 180 }),
  status: mysqlEnum("status", ["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled").notNull(),
  dueDate: timestamp("dueDate"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  cost: decimal("cost", { precision: 14, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  assetIdx: index("maintenance_asset_idx").on(table.assetId),
  dueIdx: index("maintenance_due_idx").on(table.dueDate),
}));

export const assetDocuments = mysqlTable("asset_documents", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  fileName: varchar("fileName", { length: 220 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: text("fileKey"),
  mimeType: varchar("mimeType", { length: 120 }),
  sizeBytes: int("sizeBytes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  assetIdx: index("asset_documents_asset_idx").on(table.assetId),
}));

export const assetEvents = mysqlTable("asset_events", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  eventType: varchar("eventType", { length: 80 }).notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  description: text("description"),
  actorName: varchar("actorName", { length: 160 }),
  metadata: text("metadata"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, table => ({
  assetIdx: index("asset_events_asset_idx").on(table.assetId),
  occurredIdx: index("asset_events_occurred_idx").on(table.occurredAt),
}));

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId"),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: int("entityId"),
  actorName: varchar("actorName", { length: 160 }),
  beforeData: text("beforeData"),
  afterData: text("afterData"),
  reason: text("reason"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, table => ({
  assetIdx: index("audit_asset_idx").on(table.assetId),
  occurredIdx: index("audit_occurred_idx").on(table.occurredAt),
}));

export const importJobs = mysqlTable("import_jobs", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("fileName", { length: 220 }).notNull(),
  totalRows: int("totalRows").default(0).notNull(),
  successfulRows: int("successfulRows").default(0).notNull(),
  failedRows: int("failedRows").default(0).notNull(),
  errorCount: int("errorCount").default(0).notNull(),
  status: mysqlEnum("status", ["validated", "completed", "failed"]).default("validated").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const importErrors = mysqlTable("import_errors", {
  id: int("id").autoincrement().primaryKey(),
  importJobId: int("importJobId").notNull(),
  rowNumber: int("rowNumber").notNull(),
  fieldName: varchar("fieldName", { length: 120 }),
  message: text("message").notNull(),
  rawData: text("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  jobIdx: index("import_errors_job_idx").on(table.importJobId),
}));

export const notificationEvents = mysqlTable("notification_events", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["warranty", "maintenance", "audit", "approval", "system"]).notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  message: text("message").notNull(),
  assetId: int("assetId"),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  isRead: int("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  readIdx: index("notification_read_idx").on(table.isRead),
  createdIdx: index("notification_created_idx").on(table.createdAt),
}));

export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 120 }).notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;
export type AssetEvent = typeof assetEvents.$inferSelect;
export type MaintenanceRecord = typeof maintenanceRecords.$inferSelect;
export type AssetTransaction = typeof assetTransactions.$inferSelect;
