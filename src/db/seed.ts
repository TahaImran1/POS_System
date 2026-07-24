import { sqlite } from './client.js';

export function seedLocalDatabase() {
  console.log('⚡ Initializing & Seeding Local SQLite Database (pos_local.sqlite)...');

  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      node_id TEXT PRIMARY KEY,
      parent_node_id TEXT,
      node_type TEXT NOT NULL,
      location_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pos_config (
      config_id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      industry_mode TEXT NOT NULL,
      enable_kds INTEGER DEFAULT 0,
      enable_table_mgmt INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      product_id TEXT PRIMARY KEY,
      barcode TEXT UNIQUE,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      product_type TEXT NOT NULL,
      default_price REAL NOT NULL,
      uom TEXT NOT NULL DEFAULT 'PCS',
      attributes_json TEXT
    );

    CREATE TABLE IF NOT EXISTS product_bom (
      bom_id TEXT PRIMARY KEY,
      parent_product_id TEXT NOT NULL,
      ingredient_product_id TEXT NOT NULL,
      quantity_required REAL NOT NULL,
      uom TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory (
      inventory_id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      min_stock_alert REAL DEFAULT 10,
      last_updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tax_groups (
      tax_group_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rate_percentage REAL NOT NULL,
      is_inclusive INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pricelists (
      pricelist_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      discount_factor REAL DEFAULT 1.0
    );

    CREATE TABLE IF NOT EXISTS customers (
      customer_id TEXT PRIMARY KEY,
      pricelist_id TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      credit_limit REAL DEFAULT 0,
      current_balance REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cash_sessions (
      session_id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      cashier_user_id TEXT NOT NULL,
      opening_balance REAL NOT NULL,
      cash_sales_total REAL DEFAULT 0,
      bank_sales_total REAL DEFAULT 0,
      credit_sales_total REAL DEFAULT 0,
      closing_cash_counted REAL,
      cash_variance REAL,
      status TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sales (
      sale_id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      customer_id TEXT,
      subtotal REAL NOT NULL,
      tax_total REAL NOT NULL,
      discount_total REAL DEFAULT 0,
      net_total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      order_type TEXT DEFAULT 'TAKEAWAY',
      extra_attributes_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      sale_item_id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      tax_amount REAL NOT NULL,
      line_total REAL NOT NULL,
      modifiers_json TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_events (
      event_id TEXT PRIMARY KEY,
      origin_node_id TEXT NOT NULL,
      table_name TEXT NOT NULL,
      action TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      is_synced INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Prepared Statements for Seeding
  const insertNode = sqlite.prepare(`INSERT OR IGNORE INTO nodes (node_id, parent_node_id, node_type, location_name, created_at) VALUES (?, ?, ?, ?, ?)`);
  insertNode.run('NODE_POS_001', 'NODE_BRANCH_01', 'POS', 'Downtown POS Terminal 1', new Date().toISOString());

  const insertTax = sqlite.prepare(`INSERT OR IGNORE INTO tax_groups (tax_group_id, name, rate_percentage, is_inclusive) VALUES (?, ?, ?, ?)`);
  insertTax.run('vat10_inc', 'VAT 10% Inclusive', 0.10, 1);
  insertTax.run('gst15_exc', 'GST 15% Exclusive', 0.15, 0);

  const insertPricelist = sqlite.prepare(`INSERT OR IGNORE INTO pricelists (pricelist_id, name, discount_factor) VALUES (?, ?, ?)`);
  insertPricelist.run('standard', 'Standard Retail', 1.0);
  insertPricelist.run('vip', 'VIP Customer 10%', 0.9);

  const insertProduct = sqlite.prepare(`INSERT OR IGNORE INTO products (product_id, barcode, sku, name, product_type, default_price, uom) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  insertProduct.run('ING_BEEF_PATTY', 'RAW001', 'RAW_PATTY', 'Raw Beef Patty 150g', 'RAW_MATERIAL', 2.0, 'PCS');
  insertProduct.run('ING_BURGER_BUN', 'RAW002', 'RAW_BUN', 'Sesame Bun', 'RAW_MATERIAL', 0.5, 'PCS');
  insertProduct.run('ING_CHEESE_SLICE', 'RAW003', 'RAW_CHEESE', 'Cheddar Cheese Slice', 'RAW_MATERIAL', 0.3, 'PCS');
  insertProduct.run('PROD_BURGER', '8801001', 'BURGER_DBL', 'Double Bacon Cheeseburger', 'FINISHED_GOOD', 12.50, 'PCS');

  const insertBom = sqlite.prepare(`INSERT OR IGNORE INTO product_bom (bom_id, parent_product_id, ingredient_product_id, quantity_required, uom) VALUES (?, ?, ?, ?, ?)`);
  insertBom.run('BOM_001', 'PROD_BURGER', 'ING_BEEF_PATTY', 2.0, 'PCS');
  insertBom.run('BOM_002', 'PROD_BURGER', 'ING_BURGER_BUN', 1.0, 'PCS');
  insertBom.run('BOM_003', 'PROD_BURGER', 'ING_CHEESE_SLICE', 2.0, 'PCS');

  const insertInv = sqlite.prepare(`INSERT OR IGNORE INTO inventory (inventory_id, node_id, product_id, quantity, min_stock_alert, last_updated) VALUES (?, ?, ?, ?, ?, ?)`);
  insertInv.run('INV_001', 'NODE_POS_001', 'ING_BEEF_PATTY', 150, 20, new Date().toISOString());
  insertInv.run('INV_002', 'NODE_POS_001', 'ING_BURGER_BUN', 200, 20, new Date().toISOString());
  insertInv.run('INV_003', 'NODE_POS_001', 'ING_CHEESE_SLICE', 300, 30, new Date().toISOString());

  console.log('✅ Local SQLite Database initialized & seeded successfully!');
}

seedLocalDatabase();
