import { defineStore } from 'pinia'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { eq } from 'drizzle-orm'
import { calculateTaxesForProduct } from '../services/taxService'

import { useSettingsStore } from './useSettingsStore'

export interface Category {
  id: string
  name: string
  icon: string
  color?: string
}

export interface Product {
  id: string
  sku: string
  barcode: string
  name: string
  category: string
  price: number
  cost_price?: number
  type: string
  stock?: number
  taxGroupId: string
  image?: string
  description?: string
  taxAmount: number
  uom?: string
}

export const useProductStore = defineStore('product', {
  state: () => ({
    categories: [
      { id: "all", name: "All Products", icon: "fa-th", color: "bg-gray-200 text-gray-900 font-bold" }
    ] as Category[],
    products: [] as Product[],
    selectedCategoryId: 'all'
  }),
  getters: {
    filteredProducts: (state) => {
      const settingsStore = useSettingsStore()
      let list = state.selectedCategoryId === 'all'
        ? state.products
        : state.products.filter(p => p.category === state.selectedCategoryId)

      // Raw products (RAW_MATERIAL) are strictly for restaurant POS (recipes/BOM), not store POS
      if (settingsStore.posMode === 'retail') {
        list = list.filter(p => p.type !== 'RAW_MATERIAL')
      }

      return list
    }
  },
  actions: {
    setCategory(id: string) {
      this.selectedCategoryId = id
    },
    async loadFromDb() {
      try {
        const records = await db.select().from(schema.products)
        if (records.length > 0) {
          const loaded = await Promise.all(records.map(async (r: any) => {
            try {
              let inv = await db.select().from(schema.inventory).where(eq(schema.inventory.product_id, r.product_id)).get()
              if (!inv) {
                try {
                  const newInvId = (await import('uuid')).v4()
                  await db.insert(schema.inventory).values({
                    inventory_id: newInvId,
                    node_id: 'NODE_POS_001',
                    product_id: r.product_id,
                    quantity: 100,
                    min_stock_alert: 10,
                    last_updated: Date.now()
                  })
                  inv = { inventory_id: newInvId, node_id: 'NODE_POS_001', product_id: r.product_id, quantity: 100, min_stock_alert: 10, last_updated: Date.now() } as any
                } catch (_) { /* fallback if insert fails */ }
              }

              const taxes = await calculateTaxesForProduct(r.product_id, r.default_price)
              
              // Use DB-stored category, fallback to 'general'
              const productCategory = r.category || 'general'

              // Auto-register category if it doesn't exist
              if (!this.categories.some(c => c.id === productCategory)) {
                this.categories.push({
                  id: productCategory,
                  name: productCategory.charAt(0).toUpperCase() + productCategory.slice(1),
                  icon: 'fa-tag',
                  color: 'bg-purple-200 text-purple-900 font-bold'
                })
              }

              return {
                id: r.product_id,
                sku: r.barcode || '',
                barcode: r.barcode || '',
                name: r.name,
                category: productCategory,
                price: r.default_price,
                cost_price: Number(r.cost_price) || 0,
                type: r.product_type,
                stock: inv ? Number(inv.quantity) : 100,
                taxGroupId: '',
                image: r.image || 'https://ui-avatars.com/api/?name=' + (r.name ? encodeURIComponent(r.name) : 'U'),
                description: r.description || '',
                taxAmount: taxes.taxAmount
              }
            } catch (err) {
              console.error(`Error loading details for product ${r.name || 'Unknown'}:`, err)
              return {
                id: r.product_id,
                sku: r.barcode || '',
                barcode: r.barcode || '',
                name: r.name || 'Unnamed Product',
                category: r.category || 'general',
                price: r.default_price || 0,
                cost_price: Number(r.cost_price) || 0,
                type: r.product_type || 'RETAIL_GOOD',
                stock: 100,
                taxGroupId: '',
                image: r.image || 'https://ui-avatars.com/api/?name=P',
                description: '',
                taxAmount: 0
              }
            }
          }))
          this.products = loaded
        } else {
          this.products = []
        }
      } catch (e) {
        console.warn('Could not load products from SQLite:', e)
        this.products = []
      }
    },

    async clearAllProductsAndReset() {
      try {
        await db.delete(schema.inventory_logs)
        await db.delete(schema.inventory)
        await db.delete(schema.product_bom)
        await db.delete(schema.product_taxes)
        await db.delete(schema.sale_items)
        await db.delete(schema.sales)
        await db.delete(schema.products)
        this.products = []
        console.log('Successfully cleared all products and reset inventory.')
      } catch (e) {
        console.error('Failed to clear products from SQLite:', e)
      }
    },

    addCategory(category: Category) {
      // Don't add duplicates
      if (this.categories.some(c => c.id === category.id)) return false
      this.categories.push(category)
      return true
    },

    removeCategory(categoryId: string) {
      // Protect the 'all' category from deletion
      if (categoryId === 'all') return false
      // Check if any products are using this category
      const productsInCategory = this.products.filter(p => p.category === categoryId)
      if (productsInCategory.length > 0) return false
      this.categories = this.categories.filter(c => c.id !== categoryId)
      // Reset selected category if the removed one was active
      if (this.selectedCategoryId === categoryId) {
        this.selectedCategoryId = 'all'
      }
      return true
    }
  }
})
