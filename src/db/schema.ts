import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core'

export const nodes = sqliteTable('nodes', {
  node_id: text('node_id').primaryKey(), // UUID
  parent_node_id: text('parent_node_id'),
  node_type: text('node_type').notNull(), // ROOT, REGION, CITY, BRANCH, POS
  location_name: text('location_name').notNull()
})

export const products = sqliteTable('products', {
  product_id: text('product_id').primaryKey(),
  barcode: text('barcode').unique(),
  name: text('name').notNull(),
  product_type: text('product_type').notNull(), // FINISHED_GOOD, RAW_MATERIAL, SERVICE
  default_price: real('default_price').notNull().default(0),
  uom: text('uom').notNull().default('PCS'),
  image: text('image'),
  description: text('description')
})

export const product_bom = sqliteTable('product_bom', {
  bom_id: text('bom_id').primaryKey(),
  parent_product_id: text('parent_product_id').notNull().references(() => products.product_id),
  ingredient_product_id: text('ingredient_product_id').notNull().references(() => products.product_id),
  quantity_required: real('quantity_required').notNull(),
  uom: text('uom').notNull()
})

export const inventory = sqliteTable('inventory', {
  inventory_id: text('inventory_id').primaryKey(),
  node_id: text('node_id').notNull().references(() => nodes.node_id),
  product_id: text('product_id').notNull().references(() => products.product_id),
  quantity: real('quantity').notNull().default(0),
  min_stock_alert: real('min_stock_alert').notNull().default(0),
  last_updated: integer('last_updated', { mode: 'timestamp_ms' }) // timestamp
})

export const tax_groups = sqliteTable('tax_groups', {
  tax_group_id: text('tax_group_id').primaryKey(),
  name: text('name').notNull(),
  rate_percentage: real('rate_percentage').notNull(),
  is_inclusive: integer('is_inclusive', { mode: 'boolean' }).notNull()
})

export const product_taxes = sqliteTable('product_taxes', {
  product_tax_id: text('product_tax_id').primaryKey(),
  product_id: text('product_id').notNull().references(() => products.product_id),
  tax_group_id: text('tax_group_id').notNull().references(() => tax_groups.tax_group_id)
})

export const pricelists = sqliteTable('pricelists', {
  pricelist_id: text('pricelist_id').primaryKey(),
  name: text('name').notNull(),
  currency: text('currency').notNull().default('PKR')
})

export const pricelist_items = sqliteTable('pricelist_items', {
  item_id: text('item_id').primaryKey(),
  pricelist_id: text('pricelist_id').notNull().references(() => pricelists.pricelist_id),
  product_id: text('product_id').notNull().references(() => products.product_id),
  fixed_price: real('fixed_price').notNull()
})

export const cash_sessions = sqliteTable('cash_sessions', {
  session_id: text('session_id').primaryKey(),
  node_id: text('node_id').notNull().references(() => nodes.node_id),
  cashier_name: text('cashier_name').notNull(),
  opening_balance: real('opening_balance').notNull().default(0),
  expected_closing_balance: real('expected_closing_balance').default(0),
  closing_cash_counted: real('closing_cash_counted'),
  cash_variance: real('cash_variance'),
  status: text('status').notNull().default('OPEN'), // OPEN, CLOSED
  opened_at: integer('opened_at', { mode: 'timestamp_ms' }),
  closed_at: integer('closed_at', { mode: 'timestamp_ms' })
})

export const cash_drops = sqliteTable('cash_drops', {
  drop_id: text('drop_id').primaryKey(),
  session_id: text('session_id').notNull().references(() => cash_sessions.session_id),
  type: text('type').notNull(), // CASH_IN, CASH_OUT_SAFE, EXPENSE
  amount: real('amount').notNull(),
  reason: text('reason'),
  created_at: integer('created_at', { mode: 'timestamp_ms' })
})

export const sales = sqliteTable('sales', {
  sale_id: text('sale_id').primaryKey(),
  node_id: text('node_id').notNull().references(() => nodes.node_id),
  session_id: text('session_id').notNull().references(() => cash_sessions.session_id),
  subtotal: real('subtotal').notNull(),
  tax_total: real('tax_total').notNull(),
  discount_total: real('discount_total').notNull(),
  net_total: real('net_total').notNull(),
  payment_method: text('payment_method').notNull(),
  order_type: text('order_type').notNull().default('TAKEAWAY'),
  extra_attributes: text('extra_attributes', { mode: 'json' }),
  created_at: integer('created_at', { mode: 'timestamp_ms' })
})

export const sale_items = sqliteTable('sale_items', {
  sale_item_id: text('sale_item_id').primaryKey(),
  sale_id: text('sale_id').notNull().references(() => sales.sale_id),
  product_id: text('product_id').notNull().references(() => products.product_id),
  quantity: real('quantity').notNull(),
  unit_price: real('unit_price').notNull(),
  tax_amount: real('tax_amount').notNull(),
  line_total: real('line_total').notNull()
})

export const sale_item_modifiers = sqliteTable('sale_item_modifiers', {
  modifier_id: text('modifier_id').primaryKey(),
  sale_item_id: text('sale_item_id').notNull().references(() => sale_items.sale_item_id),
  modifier_name: text('modifier_name').notNull(),
  price_override: real('price_override').notNull()
})

export const sync_events = sqliteTable('sync_events', {
  event_id: text('event_id').primaryKey(),
  origin_node_id: text('origin_node_id').notNull().references(() => nodes.node_id),
  table_name: text('table_name').notNull(),
  action: text('action').notNull(), // INSERT, UPDATE, DELETE
  payload: text('payload').notNull(), // JSON string
  created_at: integer('created_at', { mode: 'timestamp_ms' })
})

export const sync_ledger = sqliteTable('sync_ledger', {
  sync_id: text('sync_id').primaryKey(),
  source_node_id: text('source_node_id').notNull().references(() => nodes.node_id),
  target_node_id: text('target_node_id').notNull().references(() => nodes.node_id),
  last_synced_event_id: text('last_synced_event_id').references(() => sync_events.event_id),
  last_sync_time: integer('last_sync_time', { mode: 'timestamp_ms' })
})

export const users = sqliteTable('users', {
  user_id: text('user_id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  pin: text('pin').notNull(),
  role: text('role').notNull(), // DEVELOPER, MANAGER, SALESPERSON
  node_id: text('node_id').references(() => nodes.node_id),
  created_at: integer('created_at', { mode: 'timestamp_ms' })
})

export const app_settings = sqliteTable('app_settings', {
  setting_id: text('setting_id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp_ms' })
})

