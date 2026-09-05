import { eq, desc, and } from 'drizzle-orm'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { v4 as uuidv4 } from 'uuid'
import { useProductStore } from '../stores/useProductStore'
import { recordVendorProductPrice } from './vendorService'

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
      const baseDeductionQty = item.quantity * (Number((item as any).uom_multiplier) || 1)

      // 3. Handle BOM Finished Goods Deduction vs Direct Retail Good Deduction
      if (pType === 'FINISHED_GOOD' && productRecord) {
        // Fetch raw material ingredients recipe
        const bomItems = await db.select()
          .from(schema.product_bom)
          .where(eq(schema.product_bom.parent_product_id, targetPId))
        
        for (const bom of bomItems) {
          const requiredQty = bom.quantity_required * baseDeductionQty
          await deductInventoryStock(bom.ingredient_product_id, requiredQty, targetNodeId, 'BOM_DEDUCTION', `${saleReceiptRef} (BOM Usage)`, userName)
        }
      }

      // Always deduct direct inventory stock for the sold product in Base Units
      await deductInventoryStock(targetPId, baseDeductionQty, targetNodeId, 'POS_SALE', saleReceiptRef, userName)
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

export interface BatchAdjustmentLine {
  product_id: string
  qty_change: number // positive (+) or negative (-)
  cost_price?: number // buying price for this restock batch
  new_price?: number // optional readjusted unit selling price
  uom_name?: string
  reference_note?: string
  movement_type?: 'RESTOCK' | 'STOCK_REDUCTION' | 'WASTAGE' | 'AUDIT_CORRECTION' | 'PRICE_ADJUSTMENT' | string
}

export interface PriceHistoryLogItem {
  history_id: string
  product_id: string
  product_name?: string
  product_barcode?: string
  old_price: number
  new_price: number
  price_delta: number
  price_delta_percent: number
  change_reason?: string | null
  user_name?: string | null
  created_at: number | Date | null
}

// Process Purchase Order (PO) Inventory Restock & Stock Reductions with Optional Price Readjustment
export async function processBatchInventoryAdjustment(
  items: BatchAdjustmentLine[],
  userName: string = 'Store Manager',
  batchReason: string = 'Purchase Order (PO) & Stock Adjustment Session',
  nodeId: string = 'NODE_POS_001',
  vendorId?: string
): Promise<string> {
  const nowMs = Date.now()
  const batchId = `PO-${nowMs.toString().slice(-6)}`

  try {
    for (const item of items) {
      let targetPId = item.product_id
      let prod = await db.select().from(schema.products).where(eq(schema.products.product_id, item.product_id)).get()
      if (!prod) {
        prod = await db.select().from(schema.products).where(eq(schema.products.barcode, item.product_id)).get()
        if (prod) targetPId = prod.product_id
      }

      // 1. Update Latest Buying Cost & Vendor Agreed Rates if cost_price is provided on a restock
      if (item.cost_price !== undefined && Number(item.cost_price) > 0) {
        const cost = Number(item.cost_price)
        await db.update(schema.products)
          .set({ cost_price: cost })
          .where(eq(schema.products.product_id, targetPId))

        // Also update product_uom cost_price if matching UOM exists
        if (item.uom_name) {
          await db.update(schema.product_uom)
            .set({ cost_price: cost })
            .where(
              and(
                eq(schema.product_uom.product_id, targetPId),
                eq(schema.product_uom.uom_name, item.uom_name)
              )
            )
        }

        // Record vendor-specific agreed purchase price
        if (vendorId) {
          await recordVendorProductPrice(vendorId, targetPId, item.uom_name || 'PCS', cost)
        }
      }

      // 2. Price Readjustment & Fluctuation History Tracking
      if (prod && item.new_price !== undefined && Number(item.new_price) !== Number(prod.default_price)) {
        const oldP = Number(prod.default_price) || 0
        const newP = Number(item.new_price) || 0

        // Insert Price Fluctuation Log
        await db.insert(schema.product_price_history).values({
          history_id: uuidv4(),
          product_id: targetPId,
          old_price: oldP,
          new_price: newP,
          change_reason: item.reference_note ? `[PO #${batchId}] ${item.reference_note}` : `[PO #${batchId}] ${batchReason}`,
          user_name: userName,
          created_at: nowMs
        })

        // Update default_price in products table
        await db.update(schema.products)
          .set({ default_price: newP })
          .where(eq(schema.products.product_id, targetPId))
      }

      // 3. Stock Update & Log Insertion
      const currentStock = await db.select()
        .from(schema.inventory)
        .where(eq(schema.inventory.product_id, targetPId))
        .get()

      const qtyDelta = Number(item.qty_change) || 0
      let newQty = qtyDelta
      if (currentStock) {
        newQty = Math.max(0, currentStock.quantity + qtyDelta)
        await db.update(schema.inventory)
          .set({ quantity: newQty, last_updated: nowMs })
          .where(eq(schema.inventory.inventory_id, currentStock.inventory_id))
      } else {
        await db.insert(schema.inventory).values({
          inventory_id: uuidv4(),
          node_id: nodeId,
          product_id: targetPId,
          quantity: Math.max(0, qtyDelta),
          min_stock_alert: 10,
          last_updated: nowMs
        })
      }

      // Determine movement type
      let movType = item.movement_type
      if (!movType) {
        movType = qtyDelta >= 0 ? 'RESTOCK' : 'STOCK_REDUCTION'
      }

      await db.insert(schema.inventory_logs).values({
        log_id: uuidv4(),
        node_id: nodeId,
        product_id: targetPId,
        movement_type: movType,
        quantity_change: qtyDelta,
        quantity_after: newQty,
        reference_note: item.reference_note ? `[PO #${batchId}] ${item.reference_note}` : `[PO #${batchId}] ${batchReason}`,
        user_name: userName,
        created_at: nowMs
      })
    }

    // Reload Pinia Store
    const productStore = useProductStore()
    await productStore.loadFromDb()

    return batchId
  } catch (e) {
    console.error('Failed to process batch inventory adjustment:', e)
    throw e
  }
}

// Fetch complete price fluctuation history from DB
export async function getAllPriceHistory(productId?: string): Promise<PriceHistoryLogItem[]> {
  try {
    const rawLogs = await db.select().from(schema.product_price_history).orderBy(desc(schema.product_price_history.created_at))
    const prods = await db.select().from(schema.products)

    const prodMap = new Map<string, any>(prods.map((p: any) => [p.product_id, p]))

    let filtered = rawLogs
    if (productId && productId !== 'ALL') {
      filtered = rawLogs.filter((l: any) => l.product_id === productId)
    }

    return filtered.map((log: any) => {
      const prod = prodMap.get(log.product_id)
      const oldP = Number(log.old_price || 0)
      const newP = Number(log.new_price || 0)
      const delta = newP - oldP
      const pct = oldP > 0 ? ((delta / oldP) * 100) : 0

      return {
        history_id: log.history_id,
        product_id: log.product_id,
        product_name: prod ? prod.name : 'Product #' + log.product_id.substr(0, 6),
        product_barcode: prod ? prod.barcode || '' : '',
        old_price: oldP,
        new_price: newP,
        price_delta: delta,
        price_delta_percent: pct,
        change_reason: log.change_reason || 'Price Adjustment',
        user_name: log.user_name || 'Store Manager',
        created_at: log.created_at
      }
    })
  } catch (e) {
    console.warn('Failed to load price history logs from DB:', e)
    return []
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
  processBatchInventoryAdjustment,
  getAllPriceHistory,
  getAllInventoryLogs,
  searchSalesForReturn,
  processSalesReturnExchange
}

export interface ReturnExchangePayload {
  origin_sale_id: string
  session_id?: string
  node_id?: string
  returned_items: Array<{
    sale_item_id?: string
    product_id: string
    quantity_returned: number
    old_unit_price: number
    item_condition: 'RESTOCKABLE' | 'DAMAGED' | 'EXPIRED' | 'DEFECTIVE_VENDOR_CLAIM'
    reason?: string
  }>
  exchange_items?: Array<{
    product_id: string
    quantity: number
    current_price: number
  }>
  refund_method: string // Cash, Card, Store Credit, Exchange
  user_name: string
  reason?: string
}

export interface SaleForReturnDetails {
  sale_id: string
  receipt_code: string
  created_at: number
  payment_method: string
  subtotal: number
  tax_total: number
  net_total: number
  items: Array<{
    sale_item_id: string
    product_id: string
    product_name: string
    product_barcode: string
    qty_purchased: number
    old_unit_price: number
    qty_already_returned: number
    qty_available_to_return: number
  }>
}

// Search Sales Orders for Return
export async function searchSalesForReturn(queryStr: string): Promise<SaleForReturnDetails[]> {
  try {
    const allSales = await db.select().from(schema.sales).orderBy(desc(schema.sales.created_at))
    const allSaleItems = await db.select().from(schema.sale_items)
    const allProducts = await db.select().from(schema.products)
    const allReturnItems = await db.select().from(schema.sales_return_items)

    const prodMap = new Map<string, any>(allProducts.map((p: any) => [p.product_id, p]))

    // Map already returned quantities by sale_item_id
    const returnedQtyMap = new Map<string, number>()
    allReturnItems.forEach((ri: any) => {
      if (ri.sale_item_id) {
        const cur = returnedQtyMap.get(ri.sale_item_id) || 0
        returnedQtyMap.set(ri.sale_item_id, cur + Number(ri.quantity_returned))
      }
    })

    const q = queryStr.trim().toLowerCase()

    const results: SaleForReturnDetails[] = []

    for (const sale of allSales) {
      const receiptCode = `POS-${sale.sale_id.substr(0, 8).toUpperCase()}`
      const saleLines = allSaleItems.filter((si: any) => si.sale_id === sale.sale_id)

      const lineDetails = saleLines.map((si: any) => {
        const prod = prodMap.get(si.product_id)
        const paidQty = Number(si.quantity || 1)
        const returnedQty = returnedQtyMap.get(si.sale_item_id) || 0
        const availQty = Math.max(0, paidQty - returnedQty)

        return {
          sale_item_id: si.sale_item_id,
          product_id: si.product_id,
          product_name: prod ? prod.name : 'Product #' + si.product_id.substr(0, 6),
          product_barcode: prod ? prod.barcode || '' : '',
          qty_purchased: paidQty,
          old_unit_price: Number(si.unit_price || 0),
          qty_already_returned: returnedQty,
          qty_available_to_return: availQty
        }
      })

      const matchesSearch = !q || 
        receiptCode.toLowerCase().includes(q) ||
        sale.sale_id.toLowerCase().includes(q) ||
        lineDetails.some((l: any) => l.product_name.toLowerCase().includes(q) || l.product_barcode.toLowerCase().includes(q))

      if (matchesSearch) {
        results.push({
          sale_id: sale.sale_id,
          receipt_code: receiptCode,
          created_at: Number(sale.created_at || Date.now()),
          payment_method: sale.payment_method,
          subtotal: Number(sale.subtotal || 0),
          tax_total: Number(sale.tax_total || 0),
          net_total: Number(sale.net_total || 0),
          items: lineDetails
        })
      }
    }

    return results
  } catch (e) {
    console.warn('Failed to search sales for return:', e)
    return []
  }
}

// Process Standalone Sales Return & Exchange Transaction
export async function processSalesReturnExchange(payload: ReturnExchangePayload): Promise<string> {
  const returnId = uuidv4()
  const nowMs = Date.now()
  const returnRefCode = `RET-${returnId.substr(0, 8).toUpperCase()}`
  const targetNodeId = payload.node_id || 'NODE_POS_001'

  try {
    // 1. Calculate Refund Credit (OLD prices) & New Exchange Charges (NEW rates)
    let totalRefundCredit = 0
    for (const rItem of payload.returned_items) {
      totalRefundCredit += Math.abs(rItem.quantity_returned) * Number(rItem.old_unit_price)
    }

    let totalNewCharges = 0
    if (payload.exchange_items && payload.exchange_items.length > 0) {
      for (const eItem of payload.exchange_items) {
        totalNewCharges += Math.abs(eItem.quantity) * Number(eItem.current_price)
      }
    }

    const netSettlement = totalNewCharges - totalRefundCredit
    const returnType = (payload.exchange_items && payload.exchange_items.length > 0)
      ? 'EXCHANGE'
      : (totalRefundCredit > 0 ? 'PARTIAL' : 'FULL')

    // 2. Insert Standalone Sales Return Record (Original Sale Record remains 100% untouched)
    await db.insert(schema.sales_returns).values({
      return_id: returnId,
      origin_sale_id: payload.origin_sale_id,
      session_id: payload.session_id || 'session-live-001',
      node_id: targetNodeId,
      return_type: returnType,
      total_refund_credit: totalRefundCredit,
      total_new_charges: totalNewCharges,
      net_settlement: netSettlement,
      refund_method: payload.refund_method || 'Cash',
      user_name: payload.user_name || 'Store Manager',
      reason: payload.reason || `Customer Return / Exchange (${returnRefCode})`,
      created_at: nowMs
    })

    // 3. Insert Sales Return Line Items & Apply Condition-Based Inventory Logic
    for (const rItem of payload.returned_items) {
      const returnItemId = uuidv4()
      const retQty = Math.abs(rItem.quantity_returned)
      const oldPrice = Number(rItem.old_unit_price)

      await db.insert(schema.sales_return_items).values({
        return_item_id: returnItemId,
        return_id: returnId,
        sale_item_id: rItem.sale_item_id || null,
        product_id: rItem.product_id,
        quantity_returned: retQty,
        old_unit_price: oldPrice,
        item_condition: rItem.item_condition || 'RESTOCKABLE',
        refund_subtotal: retQty * oldPrice
      })

      // Inventory Logic Based on Item Condition
      const currentStock = await db.select()
        .from(schema.inventory)
        .where(eq(schema.inventory.product_id, rItem.product_id))
        .get()

      const currentQty = currentStock ? Number(currentStock.quantity) : 0

      if (rItem.item_condition === 'RESTOCKABLE') {
        // Good Condition -> Add Stock Back
        const newQty = currentQty + retQty
        if (currentStock) {
          await db.update(schema.inventory)
            .set({ quantity: newQty, last_updated: nowMs })
            .where(eq(schema.inventory.inventory_id, currentStock.inventory_id))
        } else {
          await db.insert(schema.inventory).values({
            inventory_id: uuidv4(),
            node_id: targetNodeId,
            product_id: rItem.product_id,
            quantity: newQty,
            min_stock_alert: 10,
            last_updated: nowMs
          })
        }

        await db.insert(schema.inventory_logs).values({
          log_id: uuidv4(),
          node_id: targetNodeId,
          product_id: rItem.product_id,
          movement_type: 'RESTOCK',
          quantity_change: retQty,
          quantity_after: newQty,
          reference_note: `[Return #${returnRefCode}] Customer Return - Good Condition (Restocked @ Rs ${oldPrice})`,
          user_name: payload.user_name,
          created_at: nowMs
        })
      } else if (rItem.item_condition === 'DAMAGED' || rItem.item_condition === 'EXPIRED') {
        // Damaged / Expired -> Log directly into Damaged/Expired Hold Queue (PENDING_CLAIM)
        const holdCond = rItem.item_condition === 'EXPIRED' ? 'EXPIRED_HOLD' : 'DAMAGED_HOLD'
        
        await db.insert(schema.damaged_expired_hold).values({
          hold_id: uuidv4(),
          sale_return_id: returnId,
          product_id: rItem.product_id,
          quantity: retQty,
          cost_price: oldPrice,
          condition: holdCond,
          status: 'PENDING_CLAIM',
          reclaimed_vendor_id: null,
          debit_note_id: null,
          created_at: nowMs
        })

        // Audit Log Entry
        await db.insert(schema.inventory_logs).values({
          log_id: uuidv4(),
          node_id: targetNodeId,
          product_id: rItem.product_id,
          movement_type: 'CUSTOMER_RETURN',
          quantity_change: retQty,
          quantity_after: currentQty,
          reference_note: `[Return #${returnRefCode}] Logged ${retQty} Pcs to Damaged/Expired Hold Queue (Pending Vendor Debit Note Claim)`,
          user_name: payload.user_name,
          created_at: nowMs
        })
      }
    }

    // 4. Handle Exchange Items Stock Deduction
    if (payload.exchange_items && payload.exchange_items.length > 0) {
      for (const eItem of payload.exchange_items) {
        const exchQty = Math.abs(eItem.quantity)
        const currentStock = await db.select()
          .from(schema.inventory)
          .where(eq(schema.inventory.product_id, eItem.product_id))
          .get()

        const currentQty = currentStock ? Number(currentStock.quantity) : 0
        const newQty = Math.max(0, currentQty - exchQty)

        if (currentStock) {
          await db.update(schema.inventory)
            .set({ quantity: newQty, last_updated: nowMs })
            .where(eq(schema.inventory.inventory_id, currentStock.inventory_id))
        }

        await db.insert(schema.inventory_logs).values({
          log_id: uuidv4(),
          node_id: targetNodeId,
          product_id: eItem.product_id,
          movement_type: 'POS_SALE',
          quantity_change: -exchQty,
          quantity_after: newQty,
          reference_note: `[Return #${returnRefCode}] Exchange Item Issued @ Rs ${eItem.current_price}`,
          user_name: payload.user_name,
          created_at: nowMs
        })
      }
    }

    // 5. Update Cash Session if Refund Method is Cash
    if (payload.refund_method === 'Cash' && payload.session_id && netSettlement !== 0) {
      try {
        const cashDropId = uuidv4()
        const isRefundToCust = netSettlement < 0
        await db.insert(schema.cash_drops).values({
          drop_id: cashDropId,
          session_id: payload.session_id,
          type: isRefundToCust ? 'CASH_OUT_SAFE' : 'CASH_IN',
          amount: Math.abs(netSettlement),
          reason: `[Return #${returnRefCode}] ${isRefundToCust ? 'Customer Refund Paid' : 'Exchange Balance Received'}`,
          created_at: nowMs
        })
      } catch (cErr) {
        console.warn('Could not insert cash drop for return:', cErr)
      }
    }

    // Reload Pinia product store
    const productStore = useProductStore()
    await productStore.loadFromDb()

    return returnId
  } catch (e) {
    console.error('Failed to process sales return exchange:', e)
    throw e
  }
}
