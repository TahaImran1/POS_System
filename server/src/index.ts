import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import pkg from 'pg';
import { v4 as uuidv4 } from 'uuid';

const { Pool } = pkg;

// Initialize PostgreSQL Master Connection Pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5433,
  user: process.env.POSTGRES_USER || 'pos_master_admin',
  password: process.env.POSTGRES_PASSWORD || 'pos_master_pass123',
  database: process.env.POSTGRES_DB || 'pos_master_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Ensure Master Database Schemas & Initial Seed Exist
async function initMasterDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS nodes (
        node_id VARCHAR(100) PRIMARY KEY,
        parent_node_id VARCHAR(100),
        node_type VARCHAR(20) CHECK (node_type IN ('MASTER', 'BRANCH', 'POS')),
        location_name VARCHAR(255) NOT NULL,
        created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
      );

      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        pin VARCHAR(20) NOT NULL,
        role VARCHAR(20) CHECK (role IN ('ADMIN', 'MANAGER', 'CASHIER')),
        node_id VARCHAR(100),
        created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
      );

      CREATE TABLE IF NOT EXISTS products (
        product_id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        product_type VARCHAR(50) NOT NULL,
        default_price NUMERIC(12, 2) NOT NULL,
        uom VARCHAR(20) DEFAULT 'PCS',
        barcode VARCHAR(100) UNIQUE,
        image TEXT,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS product_bom (
        bom_id VARCHAR(100) PRIMARY KEY,
        parent_product_id VARCHAR(100) NOT NULL,
        ingredient_product_id VARCHAR(100) NOT NULL,
        quantity_required NUMERIC(12, 4) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cash_sessions (
        session_id VARCHAR(100) PRIMARY KEY,
        node_id VARCHAR(100) NOT NULL,
        cashier_name VARCHAR(255) NOT NULL,
        opening_balance NUMERIC(12, 2) NOT NULL,
        closing_cash_counted NUMERIC(12, 2),
        expected_closing_balance NUMERIC(12, 2),
        cash_variance NUMERIC(12, 2),
        status VARCHAR(20) CHECK (status IN ('OPEN', 'CLOSED')) DEFAULT 'OPEN',
        opened_at BIGINT NOT NULL,
        closed_at BIGINT
      );

      CREATE TABLE IF NOT EXISTS sales (
        sale_id VARCHAR(100) PRIMARY KEY,
        node_id VARCHAR(100) NOT NULL,
        session_id VARCHAR(100) NOT NULL,
        subtotal NUMERIC(12, 2) NOT NULL,
        tax_total NUMERIC(12, 2) NOT NULL,
        discount_total NUMERIC(12, 2) DEFAULT 0,
        net_total NUMERIC(12, 2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        created_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_events (
        event_id VARCHAR(100) PRIMARY KEY,
        origin_node_id VARCHAR(100) NOT NULL,
        table_name VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        payload_json TEXT NOT NULL,
        is_synced INTEGER DEFAULT 0,
        created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
      );
    `);

    // Seed Master Node & Default Admin if empty
    const nodeRes = await client.query('SELECT COUNT(*) as count FROM nodes');
    if (parseInt(nodeRes.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO nodes (node_id, parent_node_id, node_type, location_name)
        VALUES ('NODE_MASTER_001', NULL, 'MASTER', 'Main Headquarter')
      `);

      await client.query(`
        INSERT INTO users (user_id, username, name, pin, role, node_id)
        VALUES ('user-admin-001', 'admin', 'Mitchell Admin', '1234', 'ADMIN', 'NODE_MASTER_001')
      `);

      // Seed Default Odoo Products
      await client.query(`
        INSERT INTO products (product_id, name, product_type, default_price, barcode, image, description)
        VALUES 
          ('prod-001', 'Office Chair', 'FINISHED_GOOD', 120.00, 'OD101', 'https://images.unsplash.com/photo-1580481072645-022f9a6d120a?w=400', 'Ergonomic Mesh Office Chair'),
          ('prod-002', 'Desk Combination', 'FINISHED_GOOD', 450.00, 'OD102', 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400', 'Executive Wooden Desk'),
          ('prod-003', 'Storage Box', 'RETAIL_GOOD', 18.50, 'OD103', 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=400', 'Heavy Duty Storage Box'),
          ('prod-004', 'Virtual Interior Design', 'SERVICE', 150.00, 'OD104', 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400', 'Virtual Room Consultation')
        ON CONFLICT (product_id) DO NOTHING
      `);
    }
  } catch (err) {
    console.error('Error initializing PostgreSQL database:', err);
  } finally {
    client.release();
  }
}

// Initialize database schemas
initMasterDb();

const server = Fastify({ logger: true });

// Register Plugins
await server.register(fastifyCors, {
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

await server.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'odoo-pos-ubuntu-master-secret-key-2026'
});

await server.register(fastifyWebsocket);

// -------------------------------------------------------------
// HEALTH CHECK API
// -------------------------------------------------------------
server.get('/health', async () => {
  return { 
    status: 'ONLINE', 
    engine: 'PostgreSQL 15', 
    node: 'NODE_MASTER_UBUNTU', 
    server_time: new Date().toISOString(),
    mode: process.env.NODE_ENV || 'production'
  };
});

// -------------------------------------------------------------
// AUTHENTICATION APIs
// -------------------------------------------------------------

// Cashier PIN Login API
server.post('/api/auth/verify-pin', async (request, reply) => {
  const { pin, username } = request.body as any;
  const res = await pool.query(
    'SELECT user_id, username, name, role, node_id FROM users WHERE (username = $1 OR $1 IS NULL) AND pin = $2',
    [username || null, pin]
  );

  const user = res.rows[0];
  if (!user) {
    return reply.status(401).send({ error: 'Invalid PIN or credentials' });
  }

  const token = server.jwt.sign({ userId: user.user_id, role: user.role, nodeId: user.node_id });
  return { status: 'OK', user, token };
});

// Admin / Manager Password Login API
server.post('/api/auth/login', async (request, reply) => {
  const { username, pin } = request.body as any;
  const res = await pool.query(
    'SELECT user_id, username, name, role, node_id FROM users WHERE username = $1 AND pin = $2',
    [username, pin]
  );

  const user = res.rows[0];
  if (!user) {
    return reply.status(401).send({ error: 'Invalid username or password/PIN' });
  }

  const token = server.jwt.sign({ userId: user.user_id, role: user.role, nodeId: user.node_id });
  return { status: 'OK', user, token };
});

// -------------------------------------------------------------
// MASTER DATA APIs
// -------------------------------------------------------------

// Query Products Catalog
server.get('/api/products', async () => {
  const prods = await pool.query('SELECT * FROM products ORDER BY name ASC');
  const boms = await pool.query('SELECT * FROM product_bom');
  return { products: prods.rows, boms: boms.rows };
});

// Create/Update Product
server.post('/api/products', async (request) => {
  const body = request.body as any;
  const prodId = body.product_id || uuidv4();

  await pool.query(
    `INSERT INTO products (product_id, name, product_type, default_price, uom, barcode, image, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (product_id) DO UPDATE SET
       name = EXCLUDED.name,
       product_type = EXCLUDED.product_type,
       default_price = EXCLUDED.default_price,
       uom = EXCLUDED.uom,
       barcode = EXCLUDED.barcode,
       image = EXCLUDED.image,
       description = EXCLUDED.description`,
    [prodId, body.name, body.product_type || 'RETAIL_GOOD', body.default_price, body.uom || 'PCS', body.barcode, body.image, body.description]
  );

  return { status: 'OK', product_id: prodId };
});

// Query Nodes Hierarchy
server.get('/api/nodes', async () => {
  const res = await pool.query('SELECT * FROM nodes ORDER BY created_at ASC');
  return { nodes: res.rows };
});

// Register POS Node
server.post('/api/nodes', async (request) => {
  const body = request.body as any;

  await pool.query(
    `INSERT INTO nodes (node_id, parent_node_id, node_type, location_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (node_id) DO UPDATE SET
       parent_node_id = EXCLUDED.parent_node_id,
       node_type = EXCLUDED.node_type,
       location_name = EXCLUDED.location_name`,
    [body.node_id, body.parent_node_id || 'NODE_MASTER_001', body.node_type || 'POS', body.location_name]
  );

  return { status: 'OK', node_id: body.node_id };
});

// -------------------------------------------------------------
// SESSIONS & SALES INGESTION APIs
// -------------------------------------------------------------

// Get Active Cash Session
server.get('/api/sessions/active', async () => {
  const res = await pool.query('SELECT * FROM cash_sessions WHERE status = \'OPEN\' ORDER BY opened_at DESC LIMIT 1');
  return { session: res.rows[0] || null };
});

// Open Cash Session
server.post('/api/sessions/open', async (request) => {
  const { node_id, cashier_name, opening_balance } = request.body as any;
  const sessionId = uuidv4();
  const now = Date.now();

  await pool.query(
    `INSERT INTO cash_sessions (session_id, node_id, cashier_name, opening_balance, status, opened_at)
     VALUES ($1, $2, $3, $4, 'OPEN', $5)`,
    [sessionId, node_id || 'NODE_POS_001', cashier_name || 'Mitchell Admin', opening_balance || 1000, now]
  );

  return { status: 'OK', session_id: sessionId, opening_balance };
});

// Close Cash Session
server.post('/api/sessions/close', async (request) => {
  const { session_id, closing_cash_counted } = request.body as any;
  const sessRes = await pool.query('SELECT * FROM cash_sessions WHERE session_id = $1', [session_id]);
  const session = sessRes.rows[0];

  if (!session) {
    return { error: 'Session not found' };
  }

  const salesSum = await pool.query(
    'SELECT SUM(net_total) as total FROM sales WHERE session_id = $1 AND payment_method = \'Cash\'',
    [session_id]
  );
  const cashSales = parseFloat(salesSum.rows[0]?.total || '0');
  const expected = parseFloat(session.opening_balance) + cashSales;
  const variance = closing_cash_counted - expected;

  await pool.query(
    `UPDATE cash_sessions 
     SET expected_closing_balance = $1, closing_cash_counted = $2, cash_variance = $3, status = 'CLOSED', closed_at = $4
     WHERE session_id = $5`,
    [expected, closing_cash_counted, variance, Date.now(), session_id]
  );

  return { status: 'OK', session_id, expected, closing_cash_counted, variance };
});

// Sales Ingestion API
server.post('/api/sales', async (request) => {
  const body = request.body as any;
  const saleId = body.sale_id || uuidv4();
  const now = body.created_at || Date.now();

  await pool.query(
    `INSERT INTO sales (sale_id, node_id, session_id, subtotal, tax_total, discount_total, net_total, payment_method, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      saleId,
      body.node_id || 'NODE_POS_001',
      body.session_id || 'session-live-001',
      body.subtotal,
      body.tax_total,
      body.discount_total || 0,
      body.net_total,
      body.payment_method,
      now
    ]
  );

  return { status: 'OK', sale_id: saleId };
});

// Query Sales Report
server.get('/api/reports/sales', async () => {
  const salesRes = await pool.query('SELECT * FROM sales ORDER BY created_at DESC');
  const summaryRes = await pool.query('SELECT COUNT(*) as count, COALESCE(SUM(net_total), 0) as total_net FROM sales');
  return { sales: salesRes.rows, summary: summaryRes.rows[0] };
});

// -------------------------------------------------------------
// WEBSOCKET MULTI-NODE EVENT SYNC GATEWAY
// -------------------------------------------------------------
server.register(async function (fastify) {
  fastify.get('/ws/sync', { websocket: true }, (connection, req) => {
    console.log('⚡ Connected to PostgreSQL Master WebSocket Sync Gateway!');

    connection.socket.on('message', async (message: string) => {
      try {
        const event = JSON.parse(message.toString());
        console.log(`📥 Ingested Master Sync Event [${event.action}] for table ${event.tableName}`);

        await pool.query(
          `INSERT INTO sync_events (event_id, origin_node_id, table_name, action, payload_json, is_synced, created_at)
           VALUES ($1, $2, $3, $4, $5, 1, $6)
           ON CONFLICT (event_id) DO NOTHING`,
          [
            event.eventId || `EVT_${Date.now()}`,
            event.originNodeId || 'NODE_POS_001',
            event.tableName,
            event.action,
            JSON.stringify(event.payload),
            Date.now()
          ]
        );

        connection.socket.send(JSON.stringify({ status: 'ACK', eventId: event.eventId, timestamp: Date.now() }));
      } catch (err) {
        console.error('Error in Master Sync Event Ingestion:', err);
      }
    });
  });
});

// -------------------------------------------------------------
// SERVER INITIALIZATION
// -------------------------------------------------------------
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    console.error('Failed to start PostgreSQL Backend Server:', err);
    process.exit(1);
  }
  console.log(`🚀 Odoo POS Master PostgreSQL Backend Server running at ${address}`);
});
