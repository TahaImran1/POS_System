import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { v4 as uuidv4 } from 'uuid'

export interface TaxGroup {
  tax_group_id: string
  name: string
  rate_percentage: number
  is_inclusive: boolean
  tax_type: 'ITEM' | 'BILL'
  is_active: boolean
  parent_tax_id?: string | null
}

export async function getTaxGroups(): Promise<TaxGroup[]> {
  try {
    const groups = await db.select().from(schema.tax_groups).where(eq(schema.tax_groups.is_active, true))
    return groups as TaxGroup[]
  } catch (e) {
    console.warn('Failed to load tax groups:', e)
    return []
  }
}

export async function createTaxGroup(taxGroup: Omit<TaxGroup, 'tax_group_id' | 'is_active' | 'parent_tax_id'>): Promise<TaxGroup> {
  const newTax: TaxGroup = {
    ...taxGroup,
    tax_group_id: uuidv4(),
    is_active: true,
    parent_tax_id: null
  }
  await db.insert(schema.tax_groups).values(newTax as any)
  return newTax
}

export async function updateTaxGroup(id: string, taxGroup: Omit<TaxGroup, 'tax_group_id' | 'is_active' | 'parent_tax_id'>): Promise<void> {
  // 1. Deactivate old tax group
  await db.update(schema.tax_groups)
    .set({ is_active: false })
    .where(eq(schema.tax_groups.tax_group_id, id))

  // 2. Create new version
  const newTaxId = uuidv4()
  const newTax: TaxGroup = {
    ...taxGroup,
    tax_group_id: newTaxId,
    is_active: true,
    parent_tax_id: id
  }
  await db.insert(schema.tax_groups).values(newTax as any)

  // 3. Migrate product associations to the new version
  await db.update(schema.product_taxes)
    .set({ tax_group_id: newTaxId })
    .where(eq(schema.product_taxes.tax_group_id, id))
}

export async function deleteTaxGroup(id: string): Promise<void> {
  // Remove associations from products so it no longer applies to future sales
  await db.delete(schema.product_taxes).where(eq(schema.product_taxes.tax_group_id, id))
  // Soft delete the tax group itself
  await db.update(schema.tax_groups).set({ is_active: false }).where(eq(schema.tax_groups.tax_group_id, id))
}

export async function calculateTaxesForProduct(productId: string, price: number): Promise<{ taxAmount: number, isInclusive: boolean }> {
  const productTaxes = await db.select().from(schema.product_taxes).where(eq(schema.product_taxes.product_id, productId))
  
  if (productTaxes.length === 0) return { taxAmount: 0, isInclusive: false }

  let totalTax = 0
  let isInclusive = false

  for (const pt of productTaxes) {
    const group = await db.select().from(schema.tax_groups).where(eq(schema.tax_groups.tax_group_id, pt.tax_group_id)).get()
    if (group && group.is_active) {
      if (group.is_inclusive) {
        const rate = group.rate_percentage / 100
        const base = price / (1 + rate)
        totalTax += price - base
        isInclusive = true
      } else {
        totalTax += price * (group.rate_percentage / 100)
      }
    }
  }

  return { taxAmount: totalTax, isInclusive }
}

export const taxService = {
  getTaxGroups,
  createTaxGroup,
  updateTaxGroup,
  deleteTaxGroup,
  calculateTaxesForProduct
}
