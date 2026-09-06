import { db } from '../db/client'
import * as schema from '../db/schema'
import { v4 as uuidv4 } from 'uuid'
import { eq, desc, and } from 'drizzle-orm'
import { useProductStore } from '../stores/useProductStore'

export interface VendorProductPrice {
  id: string
  vendor_id: string
  product_id: string
  uom_name: string
  last_buying_price: number
  updated_at: number
}

export interface Vendor {
  vendor_id: string
  name: string
  company_name: string
  phone: string
  email: string
  address: string
  balance: number // + We owe vendor (Payable), - Vendor owes us (Credit/Advance)
  created_at: number
}

export interface DamagedExpiredHoldItem {
  hold_id: string
  sale_return_id: string | null
  product_id: string
  product_name: string
  product_barcode: string
  quantity: number
  cost_price: number
  condition: 'DAMAGED_HOLD' | 'EXPIRED_HOLD'
  status: 'PENDING_CLAIM' | 'VENDOR_RECLAIMED' | 'SCRAPPED'
  reclaimed_vendor_id: string | null
  debit_note_id: string | null
  created_at: number
}

export interface VendorPaymentPayload {
  vendor_id: string
  po_id?: string
  session_id?: string
  amount_paid: number
  payment_method: string // Cash, Bank, Cheque, Debit Note Credit
  selected_hold_ids?: string[]
  user_name?: string
  notes?: string
}

// Fetch all vendors (seed defaults if empty)
export async function getVendors(): Promise<Vendor[]> {
  try {
    let list = await db.select().from(schema.vendors).orderBy(desc(schema.vendors.created_at))
    if (list.length === 0) {
      const defaultVendors = [
        { vendor_id: uuidv4(), name: 'Nestle Wholesale Supplies', company_name: 'Nestle Pakistan', phone: '+92 300 1234567', email: 'orders@nestle.com', address: 'Lahore Industrial Estate', balance: 0, created_at: Date.now() },
        { vendor_id: uuidv4(), name: 'National Foods Distributor', company_name: 'National Foods Ltd', phone: '+92 321 9876543', email: 'supply@nationalfoods.com', address: 'Karachi Supply Hub', balance: 0, created_at: Date.now() },
        { vendor_id: uuidv4(), name: 'Local Dairy & General Wholesaler', company_name: 'City Wholesalers', phone: '+92 333 5556677', email: 'city@wholesalers.pk', address: 'Main Market Depot', balance: 0, created_at: Date.now() }
      ]
      for (const v of defaultVendors) {
        await db.insert(schema.vendors).values(v).catch(() => {})
      }
      list = await db.select().from(schema.vendors).orderBy(desc(schema.vendors.created_at))
    }
    return list.map((v: any) => ({
      vendor_id: v.vendor_id,
      name: v.name,
      company_name: v.company_name || '',
      phone: v.phone || '',
      email: v.email || '',
      address: v.address || '',
      balance: Number(v.balance || 0),
      created_at: Number(v.created_at || Date.now())
    }))
  } catch (e) {
    console.warn('Failed to fetch vendors:', e)
    return []
  }
}

// Create new Vendor
export async function createVendor(data: { name: string; company_name?: string; phone?: string; email?: string; address?: string; opening_balance?: number }): Promise<Vendor> {
  const vendorId = uuidv4()
  const nowMs = Date.now()
  const val = {
    vendor_id: vendorId,
    name: data.name.trim(),
    company_name: data.company_name?.trim() || '',
    phone: data.phone?.trim() || '',
    email: data.email?.trim() || '',
    address: data.address?.trim() || '',
    balance: Number(data.opening_balance || 0),
    created_at: nowMs
  }
  await db.insert(schema.vendors).values(val)
  return val
}

// Fetch pending Damaged / Expired Hold Queue for Debit Note Claims
export async function getDamagedExpiredHoldQueue(statusFilter: string = 'PENDING_CLAIM'): Promise<DamagedExpiredHoldItem[]> {
  try {
    const rawHolds = await db.select().from(schema.damaged_expired_hold).orderBy(desc(schema.damaged_expired_hold.created_at))
    const prods = await db.select().from(schema.products)
    const prodMap = new Map<string, any>(prods.map((p: any) => [p.product_id, p]))

    let filtered = rawHolds
    if (statusFilter !== 'ALL') {
      filtered = rawHolds.filter((h: any) => h.status === statusFilter)
    }

    return filtered.map((h: any) => {
      const prod = prodMap.get(h.product_id)
      return {
        hold_id: h.hold_id,
        sale_return_id: h.sale_return_id,
        product_id: h.product_id,
        product_name: prod ? prod.name : 'Product #' + h.product_id.substr(0, 6),
        product_barcode: prod ? prod.barcode || '' : '',
        quantity: Number(h.quantity || 0),
        cost_price: Number(h.cost_price || (prod ? prod.price * 0.8 : 0)),
        condition: h.condition,
        status: h.status,
        reclaimed_vendor_id: h.reclaimed_vendor_id,
        debit_note_id: h.debit_note_id,
        created_at: Number(h.created_at || Date.now())
      }
    })
  } catch (e) {
    console.warn('Failed to load damaged/expired hold queue:', e)
    return []
  }
}

// Process Vendor Payment & Debit Note Claims (VENDOR_RECLAIMED)
export async function processVendorPaymentWithDebitNote(payload: VendorPaymentPayload): Promise<string> {
  const paymentId = uuidv4()
  const nowMs = Date.now()
  const payRefCode = `PAY-${paymentId.substr(0, 8).toUpperCase()}`

  try {
    // 1. Process Selected Debit Note Hold Items
    let debitNoteTotal = 0
    if (payload.selected_hold_ids && payload.selected_hold_ids.length > 0) {
      for (const holdId of payload.selected_hold_ids) {
        const holdRecord = await db.select()
          .from(schema.damaged_expired_hold)
          .where(eq(schema.damaged_expired_hold.hold_id, holdId))
          .get()

        if (holdRecord && holdRecord.status === 'PENDING_CLAIM') {
          const lineCost = Number(holdRecord.quantity) * Number(holdRecord.cost_price)
          debitNoteTotal += lineCost

          // Mark status as VENDOR_RECLAIMED
          await db.update(schema.damaged_expired_hold)
            .set({
              status: 'VENDOR_RECLAIMED',
              reclaimed_vendor_id: payload.vendor_id,
              debit_note_id: paymentId
            })
            .where(eq(schema.damaged_expired_hold.hold_id, holdId))
        }
      }
    }

    const totalSettlementReduction = payload.amount_paid + debitNoteTotal

    // 2. Update Vendor Balance in DB
    const targetVendor = await db.select()
      .from(schema.vendors)
      .where(eq(schema.vendors.vendor_id, payload.vendor_id))
      .get()

    if (targetVendor) {
      const currentBal = Number(targetVendor.balance || 0)
      const newBal = currentBal - totalSettlementReduction
      await db.update(schema.vendors)
        .set({ balance: newBal })
        .where(eq(schema.vendors.vendor_id, payload.vendor_id))
    }

    // 3. Insert Vendor Payment Record
    await db.insert(schema.vendor_payments).values({
      payment_id: paymentId,
      vendor_id: payload.vendor_id,
      po_id: payload.po_id || null,
      session_id: payload.session_id || 'session-live-001',
      amount: payload.amount_paid,
      debit_note_amount: debitNoteTotal,
      payment_method: payload.payment_method || 'Cash',
      user_name: payload.user_name || 'Store Manager',
      notes: payload.notes || `Vendor Settlement (${payRefCode}) - Debit Note: Rs ${debitNoteTotal.toFixed(2)}`,
      created_at: nowMs
    })

    // 4. Log Cash Drop if Paid in Cash
    if (payload.payment_method === 'Cash' && payload.amount_paid > 0 && payload.session_id) {
      try {
        await db.insert(schema.cash_drops).values({
          drop_id: uuidv4(),
          session_id: payload.session_id,
          type: 'CASH_OUT_SAFE',
          amount: payload.amount_paid,
          reason: `[Vendor Payment #${payRefCode}] Paid to ${targetVendor?.name || 'Vendor'}`,
          created_at: nowMs
        })
      } catch (cErr) {
        console.warn('Could not insert cash drop for vendor payment:', cErr)
      }
    }

    return paymentId
  } catch (e) {
    console.error('Failed to process vendor payment with debit note:', e)
    throw e
  }
}

// Get last agreed buying price for a specific vendor & product
export async function getVendorProductPrice(
  vendorId: string, 
  productId: string, 
  uomName: string = 'PCS'
): Promise<number | null> {
  try {
    const record = await db.select()
      .from(schema.vendor_product_prices)
      .where(
        and(
          eq(schema.vendor_product_prices.vendor_id, vendorId),
          eq(schema.vendor_product_prices.product_id, productId),
          eq(schema.vendor_product_prices.uom_name, uomName)
        )
      )
      .get()
    
    return record ? Number(record.last_buying_price) : null
  } catch (e) {
    console.warn('Could not query vendor product price:', e)
    return null
  }
}

// Record/update agreed buying price when a PO is placed with a vendor
export async function recordVendorProductPrice(
  vendorId: string, 
  productId: string, 
  uomName: string, 
  costPrice: number
): Promise<void> {
  if (!vendorId || !productId || costPrice <= 0) return
  const nowMs = Date.now()

  try {
    const existing = await db.select()
      .from(schema.vendor_product_prices)
      .where(
        and(
          eq(schema.vendor_product_prices.vendor_id, vendorId),
          eq(schema.vendor_product_prices.product_id, productId),
          eq(schema.vendor_product_prices.uom_name, uomName)
        )
      )
      .get()

    if (existing) {
      await db.update(schema.vendor_product_prices)
        .set({
          last_buying_price: costPrice,
          updated_at: nowMs
        })
        .where(eq(schema.vendor_product_prices.id, existing.id))
    } else {
      await db.insert(schema.vendor_product_prices).values({
        id: uuidv4(),
        vendor_id: vendorId,
        product_id: productId,
        uom_name: uomName,
        last_buying_price: costPrice,
        updated_at: nowMs
      })
    }
  } catch (e) {
    console.warn('Could not record vendor product price:', e)
  }
}

export interface VendorPaymentRecord {
  payment_id: string
  vendor_id: string
  vendor_name: string
  po_id: string | null
  amount: number
  debit_note_amount: number
  payment_method: string
  user_name: string | null
  notes: string | null
  created_at: number
}

// Fetch all vendor payments for the accounts payable ledger
export async function getVendorPayments(): Promise<VendorPaymentRecord[]> {
  try {
    const rawPayments = await db.select().from(schema.vendor_payments).orderBy(desc(schema.vendor_payments.created_at))
    const vList = await db.select().from(schema.vendors)
    const vMap = new Map<string, string>(vList.map((v: any) => [v.vendor_id, v.name]))

    return rawPayments.map((p: any) => ({
      payment_id: p.payment_id,
      vendor_id: p.vendor_id,
      vendor_name: vMap.get(p.vendor_id) || 'Unknown Vendor',
      po_id: p.po_id,
      amount: Number(p.amount || 0),
      debit_note_amount: Number(p.debit_note_amount || 0),
      payment_method: p.payment_method || 'Cash',
      user_name: p.user_name,
      notes: p.notes,
      created_at: Number(p.created_at || Date.now())
    }))
  } catch (e) {
    console.warn('Could not fetch vendor payments:', e)
    return []
  }
}

export interface VendorPurchaseRecord {
  purchase_id: string
  vendor_id: string
  po_id: string
  product_id: string
  product_name: string
  product_barcode: string
  quantity: number
  uom_name: string
  uom_multiplier: number
  unit_cost: number
  total_cost: number
  reference_note: string | null
  user_name: string | null
  created_at: number
}

// Automatic backfill helper: migrate historic restocks from inventory_logs into vendor_purchases
let hasCheckedBackfill = false

export async function backfillVendorPurchasesFromInventoryLogs(): Promise<void> {
  if (hasCheckedBackfill) return
  hasCheckedBackfill = true

  try {
    const logs = await db.select().from(schema.inventory_logs)
    const restockLogs = logs.filter((l: any) => 
      l.movement_type === 'RESTOCK' || 
      (l.reference_note && (l.reference_note.includes('[PO') || l.reference_note.toLowerCase().includes('restock'))) ||
      Number(l.quantity_change) > 0
    )

    if (restockLogs.length === 0) return

    const existingPurchases = await db.select().from(schema.vendor_purchases)
    const existingIds = new Set(existingPurchases.map((p: any) => p.purchase_id))
    const existingPoProductKeys = new Set(existingPurchases.map((p: any) => `${p.po_id}_${p.product_id}`))

    const vendors = await db.select().from(schema.vendors)
    if (vendors.length === 0) return

    const products = await db.select().from(schema.products)
    const prodMap = new Map<string, any>(products.map((p: any) => [p.product_id, p]))

    let priceAgreements: any[] = []
    try {
      priceAgreements = await db.select().from(schema.vendor_product_prices)
    } catch (_) {}

    for (const log of restockLogs) {
      if (existingIds.has(log.log_id)) continue

      const refNote: string = log.reference_note || ''
      const prod = prodMap.get(log.product_id)

      // Extract PO ID: e.g. [PO #PO-123456] or [PO-123456]
      const poMatch = refNote.match(/\[(?:PO\s*#)?(PO-[A-Za-z0-9_\-]+)\]/i)
      const poId = poMatch ? poMatch[1] : `PO-${new Date(Number(log.created_at || Date.now())).toISOString().slice(2, 10).replace(/-/g, '')}`

      if (existingPoProductKeys.has(`${poId}_${log.product_id}`)) continue

      // Determine Vendor ID
      let matchedVendorId: string | null = null

      // 1. Check if price agreements map this product to a vendor
      const agreed = priceAgreements.find((a: any) => a.product_id === log.product_id)
      if (agreed) {
        matchedVendorId = agreed.vendor_id
      }

      // 2. Check if reference note mentions any vendor name
      if (!matchedVendorId) {
        for (const v of vendors) {
          if (refNote.toLowerCase().includes(v.name.toLowerCase())) {
            matchedVendorId = v.vendor_id
            break
          }
        }
      }

      // 3. Check if only one vendor has a positive balance
      if (!matchedVendorId) {
        const activeVendors = vendors.filter((v: any) => Number(v.balance || 0) > 0)
        if (activeVendors.length === 1) {
          matchedVendorId = activeVendors[0].vendor_id
        }
      }

      // 4. Default to first active vendor if none matched
      if (!matchedVendorId && vendors.length > 0) {
        matchedVendorId = vendors[0].vendor_id
      }

      if (!matchedVendorId) continue

      // Parse quantity, UOM, and unit cost from reference note
      // Format: "PO Restock (10 Box @ Rs 150.00)"
      const detailsMatch = refNote.match(/\((\d+(?:\.\d+)?)\s+([A-Za-z0-9_\-]+)\s+@\s+Rs\s+(\d+(?:\.\d+)?)\)/i)
      let quantity = Math.abs(Number(log.quantity_change) || 1)
      let uomName = prod?.uom || 'PCS'
      let unitCost = Number(prod?.cost_price) || (prod ? Number(prod.default_price || 0) * 0.8 : 0)

      if (detailsMatch) {
        quantity = parseFloat(detailsMatch[1])
        uomName = detailsMatch[2]
        unitCost = parseFloat(detailsMatch[3])
      }

      const totalCost = Number((quantity * unitCost).toFixed(2))

      await db.insert(schema.vendor_purchases).values({
        purchase_id: log.log_id,
        vendor_id: matchedVendorId,
        po_id: poId,
        product_id: log.product_id,
        product_name: prod ? prod.name : 'Stock Item #' + log.product_id.substr(0, 6),
        product_barcode: prod?.barcode || '',
        quantity: quantity,
        uom_name: uomName,
        uom_multiplier: 1,
        unit_cost: unitCost,
        total_cost: totalCost,
        reference_note: refNote || `[PO #${poId}] Historic inventory restock`,
        user_name: log.user_name || 'Store Manager',
        created_at: Number(log.created_at || Date.now())
      }).catch((err: any) => {
        console.warn('Backfill insert skipped:', err)
      })

      existingIds.add(log.log_id)
      existingPoProductKeys.add(`${poId}_${log.product_id}`)
    }
  } catch (e) {
    console.warn('Error during vendor purchase backfill:', e)
  }
}

// Fetch all vendor purchases / restock logs for accounts payable detail
export async function getVendorPurchases(vendorId?: string): Promise<VendorPurchaseRecord[]> {
  try {
    // Run safe backfill once so historic restocks in inventory_logs appear as vendor purchases
    await backfillVendorPurchasesFromInventoryLogs()

    let rows: any[] = []
    if (vendorId) {
      rows = await db.select().from(schema.vendor_purchases)
        .where(eq(schema.vendor_purchases.vendor_id, vendorId))
        .orderBy(desc(schema.vendor_purchases.created_at))
    } else {
      rows = await db.select().from(schema.vendor_purchases)
        .orderBy(desc(schema.vendor_purchases.created_at))
    }

    return rows.map((r: any) => ({
      purchase_id: r.purchase_id,
      vendor_id: r.vendor_id,
      po_id: r.po_id,
      product_id: r.product_id,
      product_name: r.product_name,
      product_barcode: r.product_barcode || '',
      quantity: Number(r.quantity || 0),
      uom_name: r.uom_name || 'PCS',
      uom_multiplier: Number(r.uom_multiplier || 1),
      unit_cost: Number(r.unit_cost || 0),
      total_cost: Number(r.total_cost || 0),
      reference_note: r.reference_note || '',
      user_name: r.user_name || 'Store Manager',
      created_at: Number(r.created_at || Date.now())
    }))
  } catch (e) {
    console.warn('Could not fetch vendor purchases:', e)
    return []
  }
}


