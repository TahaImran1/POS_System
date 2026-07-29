import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { v4 as uuidv4 } from 'uuid'

export interface BomRecipe {
  bom_id: string
  parent_product_id: string
  ingredient_product_id: string
  quantity_required: number
  uom: string
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

export async function processSale(cartItems: Array<{ product_id: string, quantity: number, price: number, tax: number }>, paymentMethod: string, total: number, subtotal: number, taxTotal: number, sessionId: string, nodeId: string) {
  const saleId = uuidv4()
  const nowMs = Date.now()

  try {
    // 1. Create Sale Record
    await db.insert(schema.sales).values({
      sale_id: saleId,
      node_id: nodeId || 'NODE_POS_001',
      session_id: sessionId || 'session-live-001',
      subtotal: subtotal,
      tax_total: taxTotal,
      discount_total: 0,
      net_total: total,
      payment_method: paymentMethod,
      created_at: nowMs
    })

    // 2. Insert Items & Deduct BOM
    for (const item of cartItems) {
      const saleItemId = uuidv4()
      
      await db.insert(schema.sale_items).values({
        sale_item_id: saleItemId,
        sale_id: saleId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.price,
        tax_amount: item.tax,
        line_total: item.price * item.quantity
      })

      // Auto-Deduct Inventory
      const productRecord = await db.select().from(schema.products).where(eq(schema.products.product_id, item.product_id)).get()
      
      if (productRecord?.product_type === 'FINISHED_GOOD') {
        const bomItems = await db.select().from(schema.product_bom).where(eq(schema.product_bom.parent_product_id, item.product_id))
        
        for (const bom of bomItems) {
          const requiredQty = bom.quantity_required * item.quantity
          
          const currentStock = await db.select().from(schema.inventory)
            .where(eq(schema.inventory.product_id, bom.ingredient_product_id))
            .get()
            
          if (currentStock) {
            await db.update(schema.inventory)
              .set({ quantity: currentStock.quantity - requiredQty, last_updated: nowMs })
              .where(eq(schema.inventory.inventory_id, currentStock.inventory_id))
          }
        }
      } else if (productRecord?.product_type === 'RETAIL_GOOD') {
        const currentStock = await db.select().from(schema.inventory)
          .where(eq(schema.inventory.product_id, item.product_id))
          .get()
          
        if (currentStock) {
          await db.update(schema.inventory)
            .set({ quantity: currentStock.quantity - item.quantity, last_updated: nowMs })
            .where(eq(schema.inventory.inventory_id, currentStock.inventory_id))
        }
      }
    }
  } catch (e) {
    console.warn('DB processSale notice (continuing sale):', e)
  }

  return saleId
}

export const bomService = {
  getBomRecipes,
  addIngredientToBom,
  processSale
}
