import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { sqlite } from '../../src/db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const server = Fastify({ logger: true });

// Register Static File Serving (serves index.html, css/, js/ directly on port 3000)
server.register(fastifyStatic, {
  root: rootDir,
  prefix: '/',
});

// Register WebSocket plugin
server.register(fastifyWebsocket);

// Health check endpoint
server.get('/health', async () => {
  return { status: 'OK', node: 'NODE_BRANCH_01', timestamp: new Date().toISOString() };
});

// Query Nodes Hierarchy API
server.get('/api/nodes', async () => {
  const nodes = sqlite.prepare('SELECT * FROM nodes').all();
  return { nodes };
});

// Query Products & BOM Recipes API
server.get('/api/products', async () => {
  const products = sqlite.prepare('SELECT * FROM products').all();
  const boms = sqlite.prepare('SELECT * FROM product_bom').all();
  return { products, boms };
});

// Event Sourcing Ingestion & WebSocket Gateway
server.register(async function (fastify) {
  fastify.get('/ws/sync', { websocket: true }, (connection, req) => {
    console.log('⚡ Connected to WebSocket Sync Daemon Client!');

    connection.socket.on('message', (message: string) => {
      try {
        const event = JSON.parse(message.toString());
        console.log(`📥 Received Event [${event.action}] for table ${event.tableName}`);

        // Ingest into local SQL sync_events table
        const insertEvt = sqlite.prepare(`
          INSERT OR IGNORE INTO sync_events (event_id, origin_node_id, table_name, action, payload_json, is_synced, created_at)
          VALUES (?, ?, ?, ?, ?, 1, ?)
        `);
        insertEvt.run(
          event.eventId || `EVT_${Date.now()}`,
          event.originNodeId || 'NODE_UNKNOWN',
          event.tableName,
          event.action,
          JSON.stringify(event.payload),
          new Date().toISOString()
        );

        connection.socket.send(JSON.stringify({ status: 'ACK', eventId: event.eventId }));
      } catch (err) {
        console.error('Error processing sync event:', err);
      }
    });
  });
});

const PORT = 3000;
server.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Fastify POS Web App & API running at ${address}`);
});
