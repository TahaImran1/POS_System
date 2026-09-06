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
  cost_price: real('cost_price').notNull().default(0),
  uom: text('uom').notNull().default('PCS'),
  image: text('image'),
  description: text('description'),
  category: text('category').default('misc')
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
  last_updated: integer('last_updated') // timestamp ms
})

export const inventory_logs = sqliteTable('inventory_logs', {
  log_id: text('log_id').primaryKey(),
  node_id: text('node_id').references(() => nodes.node_id),
  product_id: text('product_id').notNull().references(() => products.product_id),
  movement_type: text('movement_type').notNull(), // RESTOCK, POS_SALE, BOM_DEDUCTION, MANUAL_ADJUSTMENT, INITIAL_SEED
  quantity_change: real('quantity_change').notNull(),
  quantity_after: real('quantity_after').notNull(),
  reference_note: text('reference_note'),
  user_name: text('user_name'),
  created_at: integer('created_at')
})

export const tax_groups = sqliteTable('tax_groups', {
  tax_group_id: text('tax_group_id').primaryKey(),
  name: text('name').notNull(),
  rate_percentage: real('rate_percentage').notNull(),
  is_inclusive: integer('is_inclusive', { mode: 'boolean' }).notNull(),
  tax_type: text('tax_type').notNull().default('ITEM'), // 'ITEM' or 'BILL'
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  parent_tax_id: text('parent_tax_id')
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
  closing_notes_breakdown: text('closing_notes_breakdown'),
  closing_note: text('closing_note'),
  status: text('status').notNull().default('OPEN'), // OPEN, CLOSED
  opened_at: integer('opened_at'),
  closed_at: integer('closed_at')
})

export const cash_drops = sqliteTable('cash_drops', {
  drop_id: text('drop_id').primaryKey(),
  session_id: text('session_id').notNull().references(() => cash_sessions.session_id),
  type: text('type').notNull(), // CASH_IN, CASH_OUT_SAFE, EXPENSE
  amount: real('amount').notNull(),
  reason: text('reason'),
  created_at: integer('created_at')
})

export const sales = sqliteTable('sales', {
  sale_id: text('sale_id').primaryKey(),
  node_id: text('node_id').notNull().references(() => nodes.node_id),
  session_id: text('session_id').notNull().references(() => cash_sessions.session_id),
  origin_branch_id: text('origin_branch_id'),
  origin_pos_id: text('origin_pos_id'),
  origin_user_id: text('origin_user_id'),
  synced: integer('synced', { mode: 'boolean' }).notNull().default(false),
  subtotal: real('subtotal').notNull(),
  tax_total: real('tax_total').notNull(),
  discount_total: real('discount_total').notNull(),
  net_total: real('net_total').notNull(),
  payment_method: text('payment_method').notNull(),
  order_type: text('order_type').notNull().default('TAKEAWAY'),
  extra_attributes: text('extra_attributes', { mode: 'json' }),
  created_at: integer('created_at'),
  updated_at: integer('updated_at')
})

export const sales_audit_logs = sqliteTable('sales_audit_logs', {
  audit_id: text('audit_id').primaryKey(),
  sale_id: text('sale_id').notNull().references(() => sales.sale_id),
  modified_by_user_id: text('modified_by_user_id').notNull(),
  shift_session_id: text('shift_session_id').notNull(),
  action_type: text('action_type').notNull(), // PRICE_ADJUSTMENT, QUANTITY_CHANGE, VOID, RETURN
  old_snapshot_json: text('old_snapshot_json').notNull(),
  new_snapshot_json: text('new_snapshot_json').notNull(),
  reason_note: text('reason_note').notNull(),
  synced: integer('synced', { mode: 'boolean' }).notNull().default(false),
  created_at: integer('created_at').notNull()
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
  created_at: integer('created_at')
})

export const sync_ledger = sqliteTable('sync_ledger', {
  sync_id: text('sync_id').primaryKey(),
  source_node_id: text('source_node_id').notNull().references(() => nodes.node_id),
  target_node_id: text('target_node_id').notNull().references(() => nodes.node_id),
  last_synced_event_id: text('last_synced_event_id').references(() => sync_events.event_id),
  last_sync_time: integer('last_sync_time')
})

export const users = sqliteTable('users', {
  user_id: text('user_id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  pin: text('pin').notNull(),
  role: text('role').notNull().default('SALESPERSON'), // Legacy role field retained for compatibility
  designation: text('designation').notNull().default('Staff Member'),
  rights: text('rights', { mode: 'json' }), // JSON array of granted feature/screen permission keys
  reports_to_user_id: text('reports_to_user_id'), // User ID of direct manager / superior in hierarchy
  node_id: text('node_id').references(() => nodes.node_id),
  created_at: integer('created_at')
})

export const app_settings = sqliteTable('app_settings', {
  setting_id: text('setting_id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updated_at: integer('updated_at')
})

export const product_price_history = sqliteTable('product_price_history', {
  history_id: text('history_id').primaryKey(),
  product_id: text('product_id').notNull().references(() => products.product_id),
  old_price: real('old_price').notNull(),
  new_price: real('new_price').notNull(),
  change_reason: text('change_reason'),
  user_name: text('user_name'),
  created_at: integer('created_at')
})

export const sales_returns = sqliteTable('sales_returns', {
  return_id: text('return_id').primaryKey(),
  origin_sale_id: text('origin_sale_id').notNull().references(() => sales.sale_id),
  session_id: text('session_id').references(() => cash_sessions.session_id),
  node_id: text('node_id').references(() => nodes.node_id),
  return_type: text('return_type').notNull().default('PARTIAL'), // FULL, PARTIAL, EXCHANGE
  total_refund_credit: real('total_refund_credit').notNull().default(0),
  total_new_charges: real('total_new_charges').notNull().default(0),
  net_settlement: real('net_settlement').notNull().default(0),
  refund_method: text('refund_method').notNull().default('Cash'),
  user_name: text('user_name'),
  reason: text('reason'),
  created_at: integer('created_at')
})

export const sales_return_items = sqliteTable('sales_return_items', {
  return_item_id: text('return_item_id').primaryKey(),
  return_id: text('return_id').notNull().references(() => sales_returns.return_id),
  sale_item_id: text('sale_item_id').references(() => sale_items.sale_item_id),
  product_id: text('product_id').notNull().references(() => products.product_id),
  quantity_returned: real('quantity_returned').notNull(),
  old_unit_price: real('old_unit_price').notNull(),
  item_condition: text('item_condition').notNull().default('RESTOCKABLE'), // RESTOCKABLE, DAMAGED, EXPIRED, DEFECTIVE_VENDOR_CLAIM
  refund_subtotal: real('refund_subtotal').notNull()
})

export const vendors = sqliteTable('vendors', {
  vendor_id: text('vendor_id').primaryKey(),
  name: text('name').notNull(),
  company_name: text('company_name'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  balance: real('balance').notNull().default(0), // + we owe vendor, - vendor credit
  created_at: integer('created_at')
})

export const damaged_expired_hold = sqliteTable('damaged_expired_hold', {
  hold_id: text('hold_id').primaryKey(),
  sale_return_id: text('sale_return_id').references(() => sales_returns.return_id),
  product_id: text('product_id').notNull().references(() => products.product_id),
  quantity: real('quantity').notNull(),
  cost_price: real('cost_price').notNull(),
  condition: text('condition').notNull().default('DAMAGED_HOLD'), // DAMAGED_HOLD, EXPIRED_HOLD
  status: text('status').notNull().default('PENDING_CLAIM'), // PENDING_CLAIM, VENDOR_RECLAIMED, SCRAPPED
  reclaimed_vendor_id: text('reclaimed_vendor_id').references(() => vendors.vendor_id),
  debit_note_id: text('debit_note_id'),
  created_at: integer('created_at')
})

export const vendor_payments = sqliteTable('vendor_payments', {
  payment_id: text('payment_id').primaryKey(),
  vendor_id: text('vendor_id').notNull().references(() => vendors.vendor_id),
  po_id: text('po_id'),
  session_id: text('session_id').references(() => cash_sessions.session_id),
  amount: real('amount').notNull(),
  debit_note_amount: real('debit_note_amount').notNull().default(0),
  payment_method: text('payment_method').notNull().default('Cash'), // Cash, Bank, Cheque, Debit Note Credit
  user_name: text('user_name'),
  notes: text('notes'),
  created_at: integer('created_at')
})

export const product_uom = sqliteTable('product_uom', {
  uom_id: text('uom_id').primaryKey(),
  product_id: text('product_id').notNull().references(() => products.product_id),
  uom_name: text('uom_name').notNull(), // Piece, Pack, Box, Carton
  multiplier_to_base: real('multiplier_to_base').notNull().default(1),
  cost_price: real('cost_price').notNull().default(0),
  selling_price: real('selling_price').notNull().default(0),
  is_base_uom: integer('is_base_uom').notNull().default(0),
  created_at: integer('created_at')
})

export const product_barcodes = sqliteTable('product_barcodes', {
  barcode_id: text('barcode_id').primaryKey(),
  barcode: text('barcode').notNull().unique(),
  product_id: text('product_id').notNull().references(() => products.product_id),
  uom_id: text('uom_id').references(() => product_uom.uom_id),
  created_at: integer('created_at')
})

export const vendor_product_prices = sqliteTable('vendor_product_prices', {
  id: text('id').primaryKey(),
  vendor_id: text('vendor_id').notNull().references(() => vendors.vendor_id),
  product_id: text('product_id').notNull().references(() => products.product_id),
  uom_name: text('uom_name').notNull().default('PCS'),
  last_buying_price: real('last_buying_price').notNull().default(0),
  updated_at: integer('updated_at')
})

export const vendor_purchases = sqliteTable('vendor_purchases', {
  purchase_id: text('purchase_id').primaryKey(),
  vendor_id: text('vendor_id').notNull().references(() => vendors.vendor_id),
  po_id: text('po_id').notNull(),
  product_id: text('product_id').notNull().references(() => products.product_id),
  product_name: text('product_name').notNull(),
  product_barcode: text('product_barcode'),
  quantity: real('quantity').notNull(),
  uom_name: text('uom_name').notNull().default('PCS'),
  uom_multiplier: real('uom_multiplier').notNull().default(1),
  unit_cost: real('unit_cost').notNull().default(0),
  total_cost: real('total_cost').notNull().default(0),
  reference_note: text('reference_note'),
  user_name: text('user_name'),
  created_at: integer('created_at').notNull()
})
