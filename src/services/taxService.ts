import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { v4 as uuidv4 } from 'uuid'

export interface TaxGroup {
  tax_group_id: string
  name: string
  rate_percentage: number
  is_inclusive: boolean
}

export async function getTaxGroups(): Promise<TaxGroup[]> {
  try {
    const groups = await db.select().from(schema.tax_groups)
    return groups as TaxGroup[]
  } catch (e) {
    console.warn('Failed to load tax groups:', e)
    return []
  }
}

export async function createTaxGroup(taxGroup: Omit<TaxGroup, 'tax_group_id'>): Promise<TaxGroup> {
  const newTax: TaxGroup = {
    ...taxGroup,
    tax_group_id: uuidv4()
  }
  await db.insert(schema.tax_groups).values(newTax as any)
  return newTax
}

export async function calculateTaxesForProduct(productId: string, price: number): Promise<{ taxAmount: number, isInclusive: boolean }> {
  const productTaxes = await db.select().from(schema.product_taxes).where(eq(schema.product_taxes.product_id, productId))
  
  if (productTaxes.length === 0) return { taxAmount: 0, isInclusive: false }

  let totalTax = 0
  let isInclusive = false

  for (const pt of productTaxes) {
    const group = await db.select().from(schema.tax_groups).where(eq(schema.tax_groups.tax_group_id, pt.tax_group_id)).get()
    if (group) {
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
  calculateTaxesForProduct
}
