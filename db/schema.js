import { pgTable, serial, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const printLogs = pgTable('print_logs', {
  id: serial('id').primaryKey(),
  printType: varchar('print_type', { length: 50 }).notNull(), // 打印类型 (如: "Hiprint标签")
  contentSummary: text('content_summary'),                   // 打印内容 / JSON
  ipAddress: varchar('ip_address', { length: 50 }),          // 新增：打印电脑的 IP 地址
  status: varchar('status', { length: 20 }).default('SUCCESS'),// 状态
  createdAt: timestamp('created_at').defaultNow(),          // 打印时间
});

// 在现有的 schema.js 里加上这个
export const printerConfigs = pgTable('printer_configs', {
  id: serial('id').primaryKey(),
  paperSize: varchar('paper_size', { length: 20 }).notNull().unique(),
  printerName: varchar('printer_name', { length: 100 }).notNull(),
  clientId: varchar('client_id', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});