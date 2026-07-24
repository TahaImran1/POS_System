import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

// 1. NODES HIERARCHY
export const nodes = sqliteTable('nodes', {
  nodeId: text('node_id').primaryKey(),
  parentNodeId: text('parent_node_id'),
  nodeType: text('node_type').notNull(), // 'ROOT', 'REGION', 'CITY', 'BRANCH', 'POS'
  locationName: text('location_name').notNull(),
  createdAt: text('created_at').notNull()
});

// 2. POS CONFIGURATION
export const posConfig = sqliteTable('pos_config', {
  configId: text('config_id').primaryKey(),
  nodeId: text('node_id').notNull(),
  industryMode: text('industry_mode').notNull(), // 'RETAIL', 'RESTAURANT', 'SERVICE'
  enableKds: integer('enable_kds', { mode: 'boolean' }).default(false),
  enableTableMgmt: integer('enable_table_mgmt', { mode: 'boolean' }).default(false)
});

// 3. PRODUCTS & RAW MATERIALS
export const products = sqliteTable('products', {
  productId: text('product_id').primaryKey(),
  barcode: text('barcode').unique(),
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  productType: text('product_type').notNull(), // 'FINISHED_GOOD', 'RAW_MATERIAL', 'SERVICE'
  defaultPrice: real('default_price').notNull(),
  uom: text('uom').notNull().default('PCS'),
  attributesJson: text('attributes_json') // JSON metadata
});

// 4. BILL OF MATERIALS (BOM) RECIPES
export const productBom = sqliteTable('product_bom', {
  bomId: text('bom_id').primaryKey(),
  parentProductId: text('parent_product_id').notNull(), // Composite Item (e.g. Burger)
  ingredientProductId: text('ingredient_product_id').notNull(), // Raw Material (e.g. Patty)
  quantityRequired: real('quantity_required').notNull(),
  uom: text('uom').notNull()
});

// 5. INVENTORY & STOCK
export const inventory = sqliteTable('inventory', {
  inventoryId: text('inventory_id').primaryKey(),
  nodeId: text('node_id').notNull(),
  productId: text('product_id').notNull(),
  quantity: real('quantity').notNull().default(0),
  minStockAlert: real('min_stock_alert').default(10),
  lastUpdated: text('last_updated').notNull()
});

// 6. TAX GROUPS
export const taxGroups = sqliteTable('tax_groups', {
  taxGroupId: text('tax_group_id').primaryKey(),
  name: text('name').notNull(),
  ratePercentage: real('rate_percentage').notNull(),
  isInclusive: integer('is_inclusive', { mode: 'boolean' }).default(true)
});

// 7. PRICELISTS & CUSTOMERS
export const pricelists = sqliteTable('pricelists', {
  pricelistId: text('pricelist_id').primaryKey(),
  name: text('name').notNull(),
  discountFactor: real('discount_factor').default(1.0)
});

export const customers = sqliteTable('customers', {
  customerId: text('customer_id').primaryKey(),
  pricelistId: text('pricelist_id'),
  name: text('name').notNull(),
  phone: text('phone'),
  creditLimit: real('credit_limit').default(0),
  currentBalance: real('current_balance').default(0)
});

// 8. CASH SESSIONS (Z-REPORT AUDITING)
export const cashSessions = sqliteTable('cash_sessions', {
  sessionId: text('session_id').primaryKey(),
  nodeId: text('node_id').notNull(),
  cashierUserId: text('cashier_user_id').notNull(),
  openingBalance: real('opening_balance').notNull(),
  cashSalesTotal: real('cash_sales_total').default(0),
  bankSalesTotal: real('bank_sales_total').default(0),
  creditSalesTotal: real('credit_sales_total').default(0),
  closingCashCounted: real('closing_cash_counted'),
  cashVariance: real('cash_variance'),
  status: text('status').notNull(), // 'OPEN', 'CLOSED'
  openedAt: text('opened_at').notNull(),
  closedAt: text('closed_at')
});

// 9. SALES & SALE ITEMS
export const sales = sqliteTable('sales', {
  saleId: text('sale_id').primaryKey(),
  nodeId: text('node_id').notNull(),
  sessionId: text('session_id').notNull(),
  customerId: text('customer_id'),
  subtotal: real('subtotal').notNull(),
  taxTotal: real('tax_total').notNull(),
  discountTotal: real('discount_total').default(0),
  netTotal: real('net_total').notNull(),
  paymentMethod: text('payment_method').notNull(),
  orderType: text('order_type').default('TAKEAWAY'),
  extraAttributesJson: text('extra_attributes_json'),
  createdAt: text('created_at').notNull()
});

export const saleItems = sqliteTable('sale_items', {
  saleItemId: text('sale_item_id').primaryKey(),
  saleId: text('sale_id').notNull(),
  productId: text('product_id').notNull(),
  quantity: real('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  taxAmount: real('tax_amount').notNull(),
  lineTotal: real('line_total').notNull(),
  modifiersJson: text('modifiers_json')
});

// 10. SYNC EVENTS (EVENT SOURCING REPLICATION)
export const syncEvents = sqliteTable('sync_events', {
  eventId: text('event_id').primaryKey(),
  originNodeId: text('origin_node_id').notNull(),
  tableName: text('table_name').notNull(),
  action: text('action').notNull(), // 'INSERT', 'UPDATE', 'DELETE'
  payloadJson: text('payload_json').notNull(),
  isSynced: integer('is_synced', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull()
});
