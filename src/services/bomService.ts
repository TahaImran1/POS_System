import { eq, desc } from 'drizzle-orm'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { v4 as uuidv4 } from 'uuid'
import { useProductStore } from '../stores/useProductStore'

export interface BomRecipe {
  bom_id: string
  parent_product_id: string
  ingredient_product_id: string
  quantity_required: number
  uom: string
}

export interface InventoryLogItem {
  log_id: string
  node_id?: string | null
  product_id: string
  product_name?: string
  product_barcode?: string
  movement_type: 'RESTOCK' | 'POS_SALE' | 'BOM_DEDUCTION' | 'MANUAL_ADJUSTMENT' | 'INITIAL_SEED' | string
  quantity_change: number
  quantity_after: number
  reference_note?: string | null
  user_name?: string | null
  created_at: number | Date | null
}

export async function getBomRecipes(): Promise<BomRecipe[]> {
  try {
    const boms = await db.select().from(schema.product_bom)
    return boms as BomRecipe[]
  } catch (e) {
    console.warn('Failed to load BOM recipes:', e)
    return []
  }
}

export async function addIngredientToBom(item: Omit<BomRecipe, 'bom_id'>): Promise<BomRecipe> {
  const newBom: BomRecipe = {
    ...item,
    bom_id: uuidv4()
  }
  await db.insert(schema.product_bom).values(newBom as any)
  return newBom
}

export async function processSale(
  cartItems: Array<{ product_id: string, quantity: number, price: number, tax: number }>, 
  paymentMethod: string, 
  total: number, 
  subtotal: number, 
  taxTotal: number, 
  sessionId: string, 
  nodeId: string,
  userName?: string
) {
  const saleId = uuidv4()
  const nowMs = Date.now()
  const saleReceiptRef = `Sale Receipt #${saleId.substr(0, 8).toUpperCase()}`

  try {
    // Ensure valid node_id in nodes table
    let targetNodeId = nodeId
    if (!targetNodeId) {
      const posNode = await db.select().from(schema.nodes).where(eq(schema.nodes.node_type, 'POS')).limit(1).get()
      targetNodeId = posNode?.node_id || 'NODE_POS_001'
    }
    const existingNode = await db.select().from(schema.nodes).where(eq(schema.nodes.node_id, targetNodeId)).get()
    if (!existingNode) {
      await db.insert(schema.nodes).values({
        node_id: targetNodeId,
        node_type: 'POS',
        location_name: 'Main Store Register 1'
      }).catch(() => {})
    }

    // Ensure valid session_id in cash_sessions table
    let targetSessionId = sessionId
    if (!targetSessionId) {
      const openSession = await db.select().from(schema.cash_sessions).where(eq(schema.cash_sessions.status, 'OPEN')).limit(1).get()
      targetSessionId = openSession?.session_id || 'session-live-001'
    }
    const existingSession = await db.select().from(schema.cash_sessions).where(eq(schema.cash_sessions.session_id, targetSessionId)).get()
    if (!existingSession) {
      await db.insert(schema.cash_sessions).values({
        session_id: targetSessionId,
        node_id: targetNodeId,
        cashier_name: userName || 'Store Manager',
        opening_balance: 0,
        status: 'OPEN',
        opened_at: nowMs
      }).catch(() => {})
    }

    // 1. Create Sale Record in SQLite
    await db.insert(schema.sales).values({
      sale_id: saleId,
      node_id: targetNodeId,
      session_id: targetSessionId,
      subtotal: subtotal,
      tax_total: taxTotal,
      discount_total: 0,
      net_total: total,
      payment_method: paymentMethod,
      created_at: nowMs
    })

    // 2. Process Cart Items & Deduct Inventory / Raw Material BOM Ingredients
    for (const item of cartItems) {
      const saleItemId = uuidv4()
      
      // Find product in DB by ID or SKU/Barcode
      let productRecord = await db.select()
        .from(schema.products)
        .where(eq(schema.products.product_id, item.product_id))
        .get()

      if (!productRecord) {
        productRecord = await db.select()
          .from(schema.products)
          .where(eq(schema.products.barcode, item.product_id))
          .get()
      }

      const targetPId = productRecord?.product_id || item.product_id
      if (!productRecord) {
        // Ensure product exists in products table so sale_items FK does not fail
        await db.insert(schema.products).values({
          product_id: targetPId,
          barcode: item.product_id,
          name: 'Retail Item',
          product_type: 'RETAIL_GOOD',
          default_price: item.price || 0,
          uom: 'PCS',
          category: 'misc'
        }).catch(() => {})
      }

      await db.insert(schema.sale_items).values({
        sale_item_id: saleItemId,
        sale_id: saleId,
        product_id: targetPId,
        quantity: item.quantity,
        unit_price: item.price,
        tax_amount: item.tax,
        line_total: item.price * item.quantity
      })

      const pType = productRecord?.product_type || 'RETAIL_GOOD'

      // 3. Handle BOM Finished Goods Deduction vs Direct Retail Good Deduction
      if (pType === 'FINISHED_GOOD' && productRecord) {
        // Fetch raw material ingredients recipe
        const bomItems = await db.select()
          .from(schema.product_bom)
          .where(eq(schema.product_bom.parent_product_id, targetPId))
        
        for (const bom of bomItems) {
          const requiredQty = bom.quantity_required * item.quantity
          await deductInventoryStock(bom.ingredient_product_id, requiredQty, targetNodeId, 'BOM_DEDUCTION', `${saleReceiptRef} (BOM Usage)`, userName)
        }
      }

      // Always deduct direct inventory stock for the sold product
      await deductInventoryStock(targetPId, item.quantity, targetNodeId, 'POS_SALE', saleReceiptRef, userName)
    }

    // 4. Try background sync to Master DB server if available
    try {
      const { useMasterDbStore } = await import('../stores/useMasterDbStore')
      const masterDbStore = useMasterDbStore()
      if (masterDbStore.masterDbUrl) {
        fetch(`${masterDbStore.masterDbUrl}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: saleId,
            node_id: targetNodeId,
            session_id: targetSessionId,
            subtotal: subtotal,
            tax_total: taxTotal,
            net_total: total,
            payment_method: paymentMethod,
            created_at: nowMs,
            lines: cartItems.map(i => ({
              product_id: i.product_id,
              product_name: 'Item',
              qty: i.quantity,
              unit_price: i.price,
              tax_amount: i.tax,
              price_subtotal: i.price * i.quantity
            }))
          })
        }).catch(() => {})
      }
    } catch (_) { /* ignore remote sync offline */ }

    // 5. Update in-memory Pinia product store stock levels immediately
    const productStore = useProductStore()
    await productStore.loadFromDb()

  } catch (e) {
    console.error('DB processSale error:', e)
  }

  return saleId
}

// Helper to deduct or upsert stock in schema.inventory and record inventory log
async function deductInventoryStock(
  productId: string, 
  qtyToDeduct: number, 
  nodeId: string, 
  movementType: 'POS_SALE' | 'BOM_DEDUCTION' | 'MANUAL_ADJUSTMENT' = 'POS_SALE',
  refNote?: string,
  userName: string = 'Cashier'
) {
  const nowMs = Date.now()
  try {
    let validNodeId = nodeId || 'NODE_POS_001'
    const existingNode = await db.select().from(schema.nodes).where(eq(schema.nodes.node_id, validNodeId)).get()
    if (!existingNode) {
      const posNode = await db.select().from(schema.nodes).where(eq(schema.nodes.node_type, 'POS')).limit(1).get()
      if (posNode) {
        validNodeId = posNode.node_id
      } else {
        await db.insert(schema.nodes).values({
          node_id: validNodeId,
          node_type: 'POS',
          location_name: 'Main Store Register 1'
        }).catch(() => {})
      }
    }

    const currentStock = await db.select()
      .from(schema.inventory)
      .where(eq(schema.inventory.product_id, productId))
      .get()

    let newQty = 0
    if (currentStock) {
      newQty = Math.max(0, currentStock.quantity - qtyToDeduct)
      await db.update(schema.inventory)
        .set({ quantity: newQty, last_updated: nowMs })
        .where(eq(schema.inventory.inventory_id, currentStock.inventory_id))
    } else {
      const initialStock = 100
      newQty = Math.max(0, initialStock - qtyToDeduct)
      await db.insert(schema.inventory).values({
        inventory_id: uuidv4(),
        node_id: validNodeId,
        product_id: productId,
        quantity: newQty,
        min_stock_alert: 10,
        last_updated: nowMs
      })
    }

    // Log Inventory Movement
    await db.insert(schema.inventory_logs).values({
      log_id: uuidv4(),
      node_id: validNodeId,
      product_id: productId,
      movement_type: movementType,
      quantity_change: -qtyToDeduct,
      quantity_after: newQty,
      reference_note: refNote || `POS Checkout (-${qtyToDeduct})`,
      user_name: userName,
      created_at: nowMs
    })
  } catch (e) {
    console.warn(`Error deducting inventory for product ${productId}:`, e)
  }
}

// Helper function to Restock / Add Inventory Stock manually
export async function restockProduct(
  productId: string, 
  addQty: number, 
  referenceNote: string = 'Manual Vendor Restock', 
  userName: string = 'Store Manager',
  nodeId: string = 'NODE_POS_001'
) {
  const nowMs = Date.now()
  try {

    // Find real product ID if matched by barcode
    let targetProductId = productId
    let prod = await db.select().from(schema.products).where(eq(schema.products.product_id, productId)).get()
    if (!prod) {
      prod = await db.select().from(schema.products).where(eq(schema.products.barcode, productId)).get()
      if (prod) targetProductId = prod.product_id
    }

    const currentStock = await db.select()
      .from(schema.inventory)
      .where(eq(schema.inventory.product_id, targetProductId))
      .get()

    let newQty = addQty
    if (currentStock) {
      newQty = currentStock.quantity + addQty
      await db.update(schema.inventory)
        .set({ quantity: newQty, last_updated: nowMs })
        .where(eq(schema.inventory.inventory_id, currentStock.inventory_id))
    } else {
      await db.insert(schema.inventory).values({
        inventory_id: uuidv4(),
        node_id: nodeId,
        product_id: targetProductId,
        quantity: addQty,
        min_stock_alert: 10,
        last_updated: nowMs
      })
    }

    // Insert Restock Log Entry
    await db.insert(schema.inventory_logs).values({
      log_id: uuidv4(),
      node_id: nodeId,
      product_id: targetProductId,
      movement_type: 'RESTOCK',
      quantity_change: addQty,
      quantity_after: newQty,
      reference_note: referenceNote,
      user_name: userName,
      created_at: nowMs
    })

    // Reload Pinia Store
    const productStore = useProductStore()
    await productStore.loadFromDb()

    return newQty
  } catch (e) {
    console.error('Failed to restock product:', e)
    throw e
  }
}

// Fetch complete inventory stocking history from DB
export async function getAllInventoryLogs(): Promise<InventoryLogItem[]> {
  try {
    const rawLogs = await db.select().from(schema.inventory_logs).orderBy(desc(schema.inventory_logs.created_at))
    const prods = await db.select().from(schema.products)

    const prodMap = new Map<string, any>(prods.map((p: any) => [p.product_id, p]))

    return rawLogs.map((log: any) => {
      const prod = prodMap.get(log.product_id)
      return {
        log_id: log.log_id,
        node_id: log.node_id,
        product_id: log.product_id,
        product_name: prod ? prod.name : 'Product #' + log.product_id.substr(0, 6),
        product_barcode: prod ? prod.barcode || '' : '',
        movement_type: log.movement_type,
        quantity_change: Number(log.quantity_change),
        quantity_after: Number(log.quantity_after),
        reference_note: log.reference_note,
        user_name: log.user_name || 'System Operator',
        created_at: log.created_at
      }
    })
  } catch (e) {
    console.warn('Failed to load inventory logs from DB:', e)
    return []
  }
}

export const bomService = {
  getBomRecipes,
  addIngredientToBom,
  processSale,
  restockProduct,
  getAllInventoryLogs
}
