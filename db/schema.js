import { pgTable, serial, varchar, text, timestamp, integer,uniqueIndex } from 'drizzle-orm/pg-core';

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

export const barcodeCounters = pgTable('barcode_counters', {
  id: serial('id').primaryKey(),
  datePrefix: varchar('date_prefix', { length: 8 }).notNull(), // YYYYMMDD
  labelType: varchar('label_type', { length: 32 }).notNull().default('trace'), // 👈 新增：标签类型区分 ('trace', 'product', 'customer'等)
  count: integer('count').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (table) => {
  return {
    // 🔑 联合唯一索引：确保同一天、同一种标签类型只有一条计数器记录
    dateTypeIdx: uniqueIndex('date_type_idx').on(table.datePrefix, table.labelType),
  };
});

// 用户表（用于多用户登录与权限区分）
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(), // 账号
  passwordHash: varchar('password_hash', { length: 255 }).notNull(), // 加密后的密码密文
  role: varchar('role', { length: 20 }).notNull().default('operator'), // 角色: 'admin' (管理员), 'operator' (普通操作员)
  createdAt: timestamp('created_at').defaultNow(),                  // 创建时间
});


// 追溯码映射字典表
export const codeMappings = pgTable('code_mappings', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 20 }).notNull(), // 'model'(型号), 'capacity'(容量), 'color'(颜色), 'customer'(客户)
  name: varchar('name', { length: 50 }).notNull(),         // 显示名称（如: "DL3500", "黑色"）
  code: varchar('code', { length: 2 }).notNull(),          // 对应的 2 位数字编码（如: "01", "05"）
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => {
  return {
    // 保证同一个分类下，名称不重复；同分类下编码也不重复
    uniqueCategoryName: uniqueIndex('cat_name_idx').on(table.category, table.name),
    uniqueCategoryCode: uniqueIndex('cat_code_idx').on(table.category, table.code),
  };
});


// 追溯码明细表
export const traceCodes = pgTable('trace_codes', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 100 }).notNull().unique(), // 完整的 17 位追溯码（加 unique 绝对防重）
  model: varchar('model', { length: 50 }).notNull(),       // 型号
  capacity: varchar('capacity', { length: 50 }).notNull(), // 容量
  color: varchar('color', { length: 30 }).notNull(),       // 颜色
  customer: varchar('customer', { length: 50 }).notNull(), // 客户
  counter: integer('counter').notNull(),                   // 当天的第几个计数码
  datePrefix: varchar('date_prefix', { length: 8 }).notNull(), // YYYYMMDD 用于按天归档查询
  printedBy: varchar('printed_by', { length: 50 }),        // 操作员（多用户上线后可记录谁打印的）
  createdAt: timestamp('created_at').defaultNow(),         // 生成/打印时间
});


// 🆕 新增：型号与容量/颜色的绑定关系表
export const productRelations = pgTable('product_relations', {
  id: serial('id').primaryKey(),
  modelCode: varchar('model_code', { length: 10 }).notNull(), // 型号编码 (如: "01")
  // 储存绑定的容量编码列表（逗号分隔，如: "01,02"）或存储 JSON
  capacityCodes: text('capacity_codes').default(''), 
  // 储存绑定的颜色编码列表（逗号分隔，如: "01,02,05"）
  colorCodes: text('color_codes').default(''), 
  updatedAt: timestamp('updated_at').defaultNow(),
});