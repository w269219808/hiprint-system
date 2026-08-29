import { pgTable, serial, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const printLogs = pgTable('print_logs', {
  id: serial('id').primaryKey(),
  printType: varchar('print_type', { length: 50 }).notNull(), // 打印类型 (如: "Hiprint标签")
  contentSummary: text('content_summary'),                   // 打印内容 / JSON
  ipAddress: varchar('ip_address', { length: 50 }),          // 新增：打印电脑的 IP 地址
  status: varchar('status', { length: 20 }).default('SUCCESS'),// 状态
  createdAt: timestamp('created_at').defaultNow(),          // 打印时间
});