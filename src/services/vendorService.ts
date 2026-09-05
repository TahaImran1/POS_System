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
