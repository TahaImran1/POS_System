import { db } from '../db/client'
import * as schema from '../db/schema'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'

export interface ProductUOM {
  uom_id: string
  product_id: string
  uom_name: string
  multiplier_to_base: number
  cost_price: number
  selling_price: number
  is_base_uom: boolean
  created_at: number
}

export const UOM_CATEGORIES = [
  'Count / Packaging',
  'Weight / Mass',
  'Volume / Liquid',
  'Length / Area'
] as const

export type UomCategory = typeof UOM_CATEGORIES[number]

export interface StandardUOM {
  code: string
  name: string
  symbol: string
  category: UomCategory
}

export const RETAIL_UOM_PRESETS: StandardUOM[] = [
  // Count & Individual Units
  { code: 'PCS', name: 'Piece', symbol: 'pcs', category: 'Count / Packaging' },
  { code: 'PACK', name: 'Pack', symbol: 'pk', category: 'Count / Packaging' },
  { code: 'BOX', name: 'Box', symbol: 'bx', category: 'Count / Packaging' },
  { code: 'CARTON', name: 'Carton', symbol: 'ctn', category: 'Count / Packaging' },
  { code: 'DOZEN', name: 'Dozen (12 pcs)', symbol: 'dz', category: 'Count / Packaging' },
  { code: 'PAIR', name: 'Pair', symbol: 'pr', category: 'Count / Packaging' },
  { code: 'SET', name: 'Set', symbol: 'set', category: 'Count / Packaging' },
  { code: 'BOTTLE', name: 'Bottle', symbol: 'btl', category: 'Count / Packaging' },
  { code: 'CAN', name: 'Can', symbol: 'can', category: 'Count / Packaging' },
  { code: 'SACHET', name: 'Sachet / Pouch', symbol: 'sachet', category: 'Count / Packaging' },
  { code: 'BAG', name: 'Bag / Sack', symbol: 'bag', category: 'Count / Packaging' },
  { code: 'JAR', name: 'Jar / Tub', symbol: 'jar', category: 'Count / Packaging' },
  { code: 'STRIP', name: 'Strip / Blister', symbol: 'strip', category: 'Count / Packaging' },
  { code: 'ROLL', name: 'Roll', symbol: 'roll', category: 'Count / Packaging' },
  { code: 'BUNDLE', name: 'Bundle', symbol: 'bdl', category: 'Count / Packaging' },

  // Weight & Mass
  { code: 'KG', name: 'Kilogram', symbol: 'kg', category: 'Weight / Mass' },
  { code: 'G', name: 'Gram', symbol: 'g', category: 'Weight / Mass' },
  { code: 'MG', name: 'Milligram', symbol: 'mg', category: 'Weight / Mass' },
  { code: 'LB', name: 'Pound', symbol: 'lb', category: 'Weight / Mass' },
  { code: 'OZ', name: 'Ounce', symbol: 'oz', category: 'Weight / Mass' },
  { code: 'TON', name: 'Metric Ton', symbol: 't', category: 'Weight / Mass' },

  // Volume & Liquid
  { code: 'L', name: 'Liter', symbol: 'L', category: 'Volume / Liquid' },
  { code: 'ML', name: 'Milliliter', symbol: 'ml', category: 'Volume / Liquid' },
  { code: 'GAL', name: 'Gallon', symbol: 'gal', category: 'Volume / Liquid' },
  { code: 'FL_OZ', name: 'Fluid Ounce', symbol: 'fl oz', category: 'Volume / Liquid' },
  { code: 'PT', name: 'Pint', symbol: 'pt', category: 'Volume / Liquid' },

  // Length & Area
  { code: 'M', name: 'Meter', symbol: 'm', category: 'Length / Area' },
  { code: 'CM', name: 'Centimeter', symbol: 'cm', category: 'Length / Area' },
  { code: 'MM', name: 'Millimeter', symbol: 'mm', category: 'Length / Area' },
  { code: 'FT', name: 'Foot / Feet', symbol: 'ft', category: 'Length / Area' },
  { code: 'IN', name: 'Inch', symbol: 'in', category: 'Length / Area' },
  { code: 'YD', name: 'Yard', symbol: 'yd', category: 'Length / Area' },
  { code: 'SQM', name: 'Square Meter', symbol: 'm²', category: 'Length / Area' },
  { code: 'SQFT', name: 'Square Feet', symbol: 'sq ft', category: 'Length / Area' },
]

export function getUomsByCategory(category: string): StandardUOM[] {
  return RETAIL_UOM_PRESETS.filter(u => u.category === category)
}

export function getUomSymbol(codeOrName: string): string {
  if (!codeOrName) return 'pcs'
  const found = RETAIL_UOM_PRESETS.find(
    u => u.code.toUpperCase() === codeOrName.toUpperCase() || 
         u.name.toUpperCase() === codeOrName.toUpperCase() || 
         u.symbol.toUpperCase() === codeOrName.toUpperCase()
  )
  return found ? found.symbol : codeOrName
}

export interface BarcodeResolveResult {
  found: boolean
  product?: any
  uom?: ProductUOM
  multiplier_to_base: number
  selling_price: number
  cost_price: number
}

// Fetch all UOM tiers configured for a product
export async function getProductUOMs(productId: string): Promise<ProductUOM[]> {
  try {
    const list = await db.select()
      .from(schema.product_uom)
      .where(eq(schema.product_uom.product_id, productId))

    if (list.length === 0) {
      // Auto-fallback: fetch product and create base UOM tier
      const prod = await db.select()
        .from(schema.products)
        .where(eq(schema.products.product_id, productId))
        .get()

      if (prod) {
        const baseUom: ProductUOM = {
          uom_id: uuidv4(),
          product_id: productId,
          uom_name: prod.uom || 'PCS',
          multiplier_to_base: 1,
          cost_price: Number(prod.default_price || 0) * 0.8,
          selling_price: Number(prod.default_price || 0),
          is_base_uom: true,
          created_at: Date.now()
        }
        await db.insert(schema.product_uom).values({
          uom_id: baseUom.uom_id,
          product_id: baseUom.product_id,
          uom_name: baseUom.uom_name,
          multiplier_to_base: 1,
          cost_price: baseUom.cost_price,
          selling_price: baseUom.selling_price,
          is_base_uom: 1,
          created_at: baseUom.created_at
        }).catch(() => {})
        return [baseUom]
      }
    }

    return list.map((u: any) => ({
      uom_id: u.uom_id,
      product_id: u.product_id,
      uom_name: u.uom_name,
      multiplier_to_base: Number(u.multiplier_to_base || 1),
      cost_price: Number(u.cost_price || 0),
      selling_price: Number(u.selling_price || 0),
      is_base_uom: Boolean(u.is_base_uom),
      created_at: Number(u.created_at || Date.now())
    }))
  } catch (e) {
    console.warn('Failed to load product UOMs:', e)
    return []
  }
}

// Save/Update UOM Tiers for a Product (with Acyclic Multiplier Validation)
export async function saveProductUOMs(productId: string, uomList: Partial<ProductUOM>[]): Promise<ProductUOM[]> {
  const nowMs = Date.now()
  
  // 1. Validate multipliers > 0 to prevent circular / zero division
  for (const item of uomList) {
    if (!item.multiplier_to_base || item.multiplier_to_base <= 0) {
      throw new Error(`Invalid UOM multiplier for ${item.uom_name}. Multiplier must be greater than 0.`)
    }
  }

  // Delete existing UOMs for clean replace
  await db.delete(schema.product_uom).where(eq(schema.product_uom.product_id, productId))

  const savedUoms: ProductUOM[] = []
  for (const item of uomList) {
    const uomId = item.uom_id || uuidv4()
    const record: ProductUOM = {
      uom_id: uomId,
      product_id: productId,
      uom_name: item.uom_name?.trim() || 'Piece',
      multiplier_to_base: Math.max(0.001, Number(item.multiplier_to_base) || 1),
      cost_price: Number(item.cost_price || 0),
      selling_price: Number(item.selling_price || 0),
      is_base_uom: Boolean(item.is_base_uom),
      created_at: nowMs
    }

    await db.insert(schema.product_uom).values({
      uom_id: record.uom_id,
      product_id: record.product_id,
      uom_name: record.uom_name,
      multiplier_to_base: record.multiplier_to_base,
      cost_price: record.cost_price,
      selling_price: record.selling_price,
      is_base_uom: record.is_base_uom ? 1 : 0,
      created_at: record.created_at
    })

    savedUoms.push(record)
  }

  return savedUoms
}

// Resolve any Scanned Physical Barcode to Product + Specific UOM Tier
export async function resolveBarcode(scannedBarcode: string): Promise<BarcodeResolveResult> {
  const cleanBarcode = scannedBarcode.trim()
  if (!cleanBarcode) return { found: false, multiplier_to_base: 1, selling_price: 0, cost_price: 0 }

  try {
    // 1. Search product_barcodes table (UOM specific barcode mapping)
    const mapped = await db.select()
      .from(schema.product_barcodes)
      .where(eq(schema.product_barcodes.barcode, cleanBarcode))
      .get()

    if (mapped) {
      const prod = await db.select().from(schema.products).where(eq(schema.products.product_id, mapped.product_id)).get()
      let uomRecord: any = null
      if (mapped.uom_id) {
        uomRecord = await db.select().from(schema.product_uom).where(eq(schema.product_uom.uom_id, mapped.uom_id)).get()
      }

      if (prod) {
        const mult = uomRecord ? Number(uomRecord.multiplier_to_base || 1) : 1
        const sellP = uomRecord ? Number(uomRecord.selling_price || prod.default_price) : Number(prod.default_price)
        const costP = uomRecord ? Number(uomRecord.cost_price || (sellP * 0.8)) : Number(prod.default_price) * 0.8

        return {
          found: true,
          product: prod,
          uom: uomRecord ? {
            uom_id: uomRecord.uom_id,
            product_id: uomRecord.product_id,
            uom_name: uomRecord.uom_name,
            multiplier_to_base: mult,
            cost_price: costP,
            selling_price: sellP,
            is_base_uom: Boolean(uomRecord.is_base_uom),
            created_at: Number(uomRecord.created_at || Date.now())
          } : undefined,
          multiplier_to_base: mult,
          selling_price: sellP,
          cost_price: costP
        }
      }
    }

    // 2. Direct search on products.barcode
    const prodDirect = await db.select()
      .from(schema.products)
      .where(eq(schema.products.barcode, cleanBarcode))
      .get()

    if (prodDirect) {
      const uoms = await getProductUOMs(prodDirect.product_id)
      const baseUom = uoms.find(u => u.is_base_uom) || uoms[0]

      return {
        found: true,
        product: prodDirect,
        uom: baseUom,
        multiplier_to_base: baseUom ? baseUom.multiplier_to_base : 1,
        selling_price: baseUom ? baseUom.selling_price : Number(prodDirect.default_price || 0),
        cost_price: baseUom ? baseUom.cost_price : Number(prodDirect.default_price || 0) * 0.8
      }
    }

    return { found: false, multiplier_to_base: 1, selling_price: 0, cost_price: 0 }
  } catch (e) {
    console.warn('Barcode resolution failed:', e)
    return { found: false, multiplier_to_base: 1, selling_price: 0, cost_price: 0 }
  }
}
