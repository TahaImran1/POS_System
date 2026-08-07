import { v4 as uuidv4 } from 'uuid'
import { db } from './client'
import * as schema from './schema'
import { eq } from 'drizzle-orm'

export async function runInitialSeed() {
  const existingNodes = await db.select().from(schema.nodes).limit(1)
  if (existingNodes.length === 0) {
    console.log('Starting initial database setup...')
    const rootNodeId = 'NODE_ROOT_001'
    const posNodeId = 'NODE_POS_001'

    await db.insert(schema.nodes).values([
      { node_id: rootNodeId, node_type: 'ROOT', location_name: 'Main Store HQ' },
      { node_id: posNodeId, parent_node_id: rootNodeId, node_type: 'POS', location_name: 'Main Store Register 1' }
    ]).catch(() => {})
  }

  // Guarantee NODE_POS_001 node exists in DB
  try {
    const pos001 = await db.select().from(schema.nodes).where(eq(schema.nodes.node_id, 'NODE_POS_001')).get()
    if (!pos001) {
      await db.insert(schema.nodes).values({
        node_id: 'NODE_POS_001',
        node_type: 'POS',
        location_name: 'Main Store Register 1'
      }).catch(() => {})
    }
  } catch (_) {}


  // Seed Developers fallback user if none exist
  const existingUsers = await db.select().from(schema.users)
  if (existingUsers.length === 0) {
    const posNode = (await db.select().from(schema.nodes).limit(1))[0]
    const defaultNodeId = posNode?.node_id || uuidv4()

    await db.insert(schema.users).values([
      {
        user_id: uuidv4(),
        username: 'dev',
        name: 'Super Developer',
        pin: '1234',
        role: 'DEVELOPER',
        node_id: defaultNodeId,
        created_at: Date.now()
      }
    ])
    console.log('Seeded default developer account.')
  }

  // Seed App Settings if none exist
  const existingSettings = await db.select().from(schema.app_settings)
  if (existingSettings.length === 0) {
    await db.insert(schema.app_settings).values([
      {
        setting_id: uuidv4(),
        key: 'store_name',
        value: 'Main Flagship Store',
        updated_at: Date.now()
      }
    ])
  }

  console.log('Database initial seed complete! Products catalog clean.')
}
