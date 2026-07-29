import { v4 as uuidv4 } from 'uuid'
import { db } from './client'
import * as schema from './schema'

export async function runInitialSeed() {
  const existingProducts = await db.select().from(schema.products).limit(1)
  if (existingProducts.length > 0) {
    console.log('Database already seeded. Skipping initial seed.')
    return
  }

  console.log('Starting initial database seed with Odoo products...')

  const rootNodeId = uuidv4()
  const posNodeId = uuidv4()

  await db.insert(schema.nodes).values([
    { node_id: rootNodeId, node_type: 'ROOT', location_name: 'HQ Cloud' },
    { node_id: posNodeId, parent_node_id: rootNodeId, node_type: 'POS', location_name: 'Downtown Flagship' }
  ])

  const taxVat10 = uuidv4()
  await db.insert(schema.tax_groups).values([
    { tax_group_id: taxVat10, name: 'VAT 10% (Inclusive)', rate_percentage: 10, is_inclusive: true }
  ])

  const odooProducts = [
    { name: 'Office Chair', price: 81.90, category: 'chairs', barcode: 'OD001' },
    { name: 'Office Lamp', price: 35.00, category: 'misc', barcode: 'OD002' },
    { name: 'Office Design Software', price: 327.60, category: 'misc', barcode: 'OD003' },
    { name: 'Desk Combination', price: 450.00, category: 'desks', barcode: 'OD004' },
    { name: 'Customizable Desk', price: 650.00, category: 'desks', barcode: 'OD005' },
    { name: 'Corner Desk Right Sit', price: 540.00, category: 'desks', barcode: 'OD006' },
    { name: 'Large Cabinet', price: 320.00, category: 'misc', barcode: 'OD007' },
    { name: 'Storage Box', price: 15.00, category: 'misc', barcode: 'OD008' },
    { name: 'Virtual Interior Design', price: 35.98, category: 'misc', barcode: 'OD009' },
    { name: 'Virtual Home Staging', price: 44.75, category: 'misc', barcode: 'OD010' },
    { name: 'Pedal Bin', price: 18.00, category: 'misc', barcode: 'OD011' },
    { name: 'Cabinet with Doors', price: 140.00, category: 'misc', barcode: 'OD012' },
    { name: 'Conference Chair', price: 165.00, category: 'chairs', barcode: 'OD013' },
    { name: 'Corner Desk Left Sit', price: 540.00, category: 'desks', barcode: 'OD014' },
    { name: 'Drawer Black', price: 129.29, category: 'desks', barcode: 'OD015' },
    { name: 'Flipover', price: 85.00, category: 'misc', barcode: 'OD016' },
    { name: 'Desk Stand with Screen', price: 210.00, category: 'desks', barcode: 'OD017' },
    { name: 'Individual Workplace', price: 890.00, category: 'desks', barcode: 'OD018' },
    { name: 'Drawer', price: 129.29, category: 'desks', barcode: 'OD019' }
  ]

  for (const prod of odooProducts) {
    const pId = uuidv4()
    await db.insert(schema.products).values({
      product_id: pId,
      name: prod.name,
      product_type: 'RETAIL_GOOD',
      default_price: prod.price,
      uom: 'PCS',
      barcode: prod.barcode,
      image: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(prod.name) + '&background=f1f3f5&color=495057&size=128',
      description: prod.name
    })

    await db.insert(schema.product_taxes).values({
      product_tax_id: uuidv4(),
      product_id: pId,
      tax_group_id: taxVat10
    })

    await db.insert(schema.inventory).values({
      inventory_id: uuidv4(),
      node_id: posNodeId,
      product_id: pId,
      quantity: 100,
      min_stock_alert: 10
    })
  }

  // Seed Users if none exist
  const existingUsers = await db.select().from(schema.users)
  if (existingUsers.length === 0) {
    const rootNode = (await db.select().from(schema.nodes).limit(1))[0]
    const defaultNodeId = rootNode?.node_id || posNodeId

    await db.insert(schema.users).values([
      {
        user_id: uuidv4(),
        username: 'dev',
        name: 'Super Developer',
        pin: '1234',
        role: 'DEVELOPER',
        node_id: defaultNodeId,
        created_at: Date.now()
      },
      {
        user_id: uuidv4(),
        username: 'manager',
        name: 'Store Manager',
        pin: '5555',
        role: 'MANAGER',
        node_id: defaultNodeId,
        created_at: Date.now()
      },
      {
        user_id: uuidv4(),
        username: 'cashier',
        name: 'Salesperson Cashier',
        pin: '0000',
        role: 'SALESPERSON',
        node_id: posNodeId,
        created_at: Date.now()
      }
    ])
    console.log('Seeded default users (dev: 1234, manager: 5555, cashier: 0000).')
  }

  // Seed App Settings if none exist
  const existingSettings = await db.select().from(schema.app_settings)
  if (existingSettings.length === 0) {
    await db.insert(schema.app_settings).values([
      { setting_id: uuidv4(), key: 'master_db_url', value: 'http://localhost:3000', updated_at: Date.now() },
      { setting_id: uuidv4(), key: 'ws_sync_url', value: 'ws://localhost:3000/ws/sync', updated_at: Date.now() },
      { setting_id: uuidv4(), key: 'master_api_key', value: 'pos_master_secret_2026', updated_at: Date.now() }
    ])
    console.log('Seeded default app_settings.')
  }

  console.log('Odoo products initial seed complete.')
}

