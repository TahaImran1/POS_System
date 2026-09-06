import { defineStore } from 'pinia'
import type { Product } from './useProductStore'
import { getProductUOMs, type ProductUOM } from '../services/uomService'
import { getVendors, getVendorProductPrice, type Vendor } from '../services/vendorService'
import { db } from '../db/client'
import * as schema from '../db/schema'

export interface POCartItem {
  id: string
  product: Product
  quantity: number
  unitMode: string // e.g. 'PCS', 'PACK', 'CARTON'
  uom_id?: string
  uom_name: string
  uom_multiplier: number
  costPrice: number // Purchasing buying rate per UOM
  newPrice: number // Customer selling rate per UOM
  direction: '+' | '-' // '+' = Restock, '-' = Return / Reduction
  vendor_id: string | null
  vendor_name: string | null
  note?: string
}

export const usePurchaseOrderStore = defineStore('purchaseOrder', {
  state: () => ({
    items: [] as POCartItem[],
    selectedItemId: null as string | null,
    numpadMode: 'qty' as 'qty' | 'cost' | 'price',
    selectedVendorId: '' as string,
    invoiceRef: 'Supplier Delivery & Restock' as string,
    vendors: [] as Vendor[],
    // Product ID -> Array of UOM tiers cached for fast hover selection
    uomCache: {} as Record<string, ProductUOM[]>,
    isLoadingVendors: false
  }),

  getters: {
    activeItem: (state): POCartItem | null => {
      if (!state.selectedItemId) return null
      return state.items.find(i => i.id === state.selectedItemId) || null
    },

    // Total purchasing cost for all items (Bill total)
    totalCost: (state): number => {
      return state.items.reduce((sum, item) => {
        const lineTotal = item.quantity * item.costPrice
        return item.direction === '+' ? sum + lineTotal : sum - lineTotal
      }, 0)
    },

    // Total retail revenue value of the items in cart
    totalSellingValue: (state): number => {
      return state.items.reduce((sum, item) => {
        const lineVal = item.quantity * item.newPrice
        return item.direction === '+' ? sum + lineVal : sum - lineVal
      }, 0)
    },

    // Total base pieces restocked
    totalBasePieces: (state): number => {
      return state.items.reduce((sum, item) => {
        const pieces = item.quantity * (item.uom_multiplier || 1)
        return item.direction === '+' ? sum + pieces : sum - pieces
      }, 0)
    },

    // Estimated profit margin percentage
    estimatedMarginPercent: (state): number => {
      let cost = 0
      let sell = 0
      state.items.forEach(item => {
        cost += item.quantity * item.costPrice
        sell += item.quantity * item.newPrice
      })
      if (sell <= 0) return 0
      return Math.round(((sell - cost) / sell) * 100)
    }
  },

  actions: {
    async initStore() {
      await this.loadVendors()
      await this.preloadAllUOMs()
    },

    async loadVendors() {
      this.isLoadingVendors = true
      try {
        this.vendors = await getVendors()
        if (this.vendors.length > 0 && !this.selectedVendorId) {
          this.selectedVendorId = this.vendors[0].vendor_id
        }
      } catch (e) {
        console.warn('Could not load vendors:', e)
      } finally {
        this.isLoadingVendors = false
      }
    },

    async preloadAllUOMs() {
      try {
        const rawUoms = await db.select().from(schema.product_uom)
        const map: Record<string, ProductUOM[]> = {}
        for (const u of rawUoms) {
          const item: ProductUOM = {
            uom_id: u.uom_id,
            product_id: u.product_id,
            uom_name: u.uom_name,
            multiplier_to_base: Number(u.multiplier_to_base || 1),
            cost_price: Number(u.cost_price || 0),
            selling_price: Number(u.selling_price || 0),
            is_base_uom: Boolean(u.is_base_uom),
            created_at: Number(u.created_at || Date.now())
          }
          if (!map[u.product_id]) map[u.product_id] = []
          map[u.product_id].push(item)
        }
        this.uomCache = map
      } catch (e) {
        console.warn('Could not preload UOMs:', e)
      }
    },

    async getProductUomsFromCache(productId: string): Promise<ProductUOM[]> {
      if (this.uomCache[productId] && this.uomCache[productId].length > 0) {
        return this.uomCache[productId]
      }
      const uoms = await getProductUOMs(productId)
      this.uomCache[productId] = uoms
      return uoms
    },

    async addProduct(product: Product, specificUom?: ProductUOM) {
      const uoms = await this.getProductUomsFromCache(product.id)
      const chosenUom = specificUom || uoms.find(u => u.is_base_uom) || uoms[0] || {
        uom_id: '',
        product_id: product.id,
        uom_name: product.uom || 'PCS',
        multiplier_to_base: 1,
        cost_price: Number(product.cost_price || (product.price * 0.8)),
        selling_price: Number(product.price || 0),
        is_base_uom: true,
        created_at: Date.now()
      }

      // Check if product with SAME UOM tier already exists in cart
      const existing = this.items.find(
        i => i.product.id === product.id && i.uom_name.toUpperCase() === chosenUom.uom_name.toUpperCase()
      )

      if (existing) {
        existing.quantity += 1
        this.selectedItemId = existing.id
        return
      }

      // Determine initial vendor and buying rate
      const activeVendor = this.vendors.find(v => v.vendor_id === this.selectedVendorId)
      let initialCost = chosenUom.cost_price > 0 ? chosenUom.cost_price : (Number(product.cost_price) || Number(product.price) * 0.8)

      // Query vendor agreement price if vendor is selected
      if (this.selectedVendorId) {
        const vendorAgreed = await getVendorProductPrice(this.selectedVendorId, product.id, chosenUom.uom_name)
        if (vendorAgreed !== null && vendorAgreed > 0) {
          initialCost = vendorAgreed
        }
      }

      const initialSelling = chosenUom.selling_price > 0 ? chosenUom.selling_price : Number(product.price)

      const newItem: POCartItem = {
        id: Math.random().toString(36).substr(2, 9),
        product,
        quantity: 1,
        unitMode: chosenUom.uom_name,
        uom_id: chosenUom.uom_id,
        uom_name: chosenUom.uom_name,
        uom_multiplier: chosenUom.multiplier_to_base || 1,
        costPrice: Number(initialCost.toFixed(2)),
        newPrice: Number(initialSelling.toFixed(2)),
        direction: '+',
        vendor_id: activeVendor ? activeVendor.vendor_id : (this.selectedVendorId || null),
        vendor_name: activeVendor ? activeVendor.name : (this.selectedVendorId ? 'Assigned Vendor' : null),
        note: 'Purchase Order Restock'
      }

      this.items.push(newItem)
      this.selectedItemId = newItem.id
    },

    selectItem(id: string | null) {
      this.selectedItemId = id
    },

    setNumpadMode(mode: 'qty' | 'cost' | 'price') {
      this.numpadMode = mode
    },

    toggleItemDirection(item?: POCartItem) {
      const target = item || this.activeItem
      if (target) {
        target.direction = target.direction === '+' ? '-' : '+'
      }
    },

    removeItem(id: string) {
      this.items = this.items.filter(i => i.id !== id)
      if (this.selectedItemId === id) {
        this.selectedItemId = this.items.length > 0 ? this.items[this.items.length - 1].id : null
      }
    },

    clearCart() {
      this.items = []
      this.selectedItemId = null
    },

    clearActiveTarget() {
      if (!this.selectedItemId && this.items.length > 0) {
        this.selectedItemId = this.items[this.items.length - 1].id
      }
      const item = this.activeItem
      if (!item) return

      if (this.numpadMode === 'cost') {
        item.costPrice = 0
      } else if (this.numpadMode === 'price') {
        item.newPrice = 0
      } else if (this.numpadMode === 'qty') {
        if (item.quantity === 0) {
          this.removeItem(item.id)
        } else {
          item.quantity = Math.floor(item.quantity / 10)
        }
      }
    },

    async setItemUom(item: POCartItem, uom: ProductUOM) {
      item.uom_id = uom.uom_id
      item.uom_name = uom.uom_name
      item.unitMode = uom.uom_name
      item.uom_multiplier = uom.multiplier_to_base || 1
      
      // Update rates according to UOM tier
      let cost = uom.cost_price > 0 ? uom.cost_price : (item.product.cost_price ? item.product.cost_price * (uom.multiplier_to_base || 1) : item.costPrice)
      if (item.vendor_id) {
        const vendorAgreed = await getVendorProductPrice(item.vendor_id, item.product.id, uom.uom_name)
        if (vendorAgreed !== null && vendorAgreed > 0) {
          cost = vendorAgreed
        }
      }
      item.costPrice = Number(cost.toFixed(2))
      item.newPrice = uom.selling_price > 0 ? uom.selling_price : Number(item.product.price) * (uom.multiplier_to_base || 1)
    },

    async assignVendorToAll(vendorId: string) {
      this.selectedVendorId = vendorId
      const v = this.vendors.find(x => x.vendor_id === vendorId)
      const vName = v ? v.name : 'Assigned Vendor'

      for (const item of this.items) {
        item.vendor_id = vendorId
        item.vendor_name = vName
        // Look up vendor agreed price for this product and UOM
        const agreedRate = await getVendorProductPrice(vendorId, item.product.id, item.uom_name)
        if (agreedRate !== null && agreedRate > 0) {
          item.costPrice = agreedRate
        }
      }
    },

    async assignVendorToItem(itemId: string, vendorId: string) {
      const item = this.items.find(i => i.id === itemId)
      if (!item) return
      const v = this.vendors.find(x => x.vendor_id === vendorId)
      if (!v) {
        item.vendor_id = null
        item.vendor_name = null
        return
      }

      item.vendor_id = v.vendor_id
      item.vendor_name = v.name

      // Look up vendor agreed price
      const agreedRate = await getVendorProductPrice(v.vendor_id, item.product.id, item.uom_name)
      if (agreedRate !== null && agreedRate > 0) {
        item.costPrice = agreedRate
      }
    },

    handleNumpadInput(val: string) {
      // If no item selected, select the latest one
      if (!this.selectedItemId && this.items.length > 0) {
        this.selectedItemId = this.items[this.items.length - 1].id
      }
      const item = this.activeItem
      if (!item) return

      if (val === 'backspace') {
        if (this.numpadMode === 'qty') {
          if (item.quantity === 0) {
            // Already 0 on this backspace press -> remove item from cart
            this.removeItem(item.id)
          } else {
            // Reduce quantity (single digits like 1 or 7 become 0 first and stay in cart)
            item.quantity = Math.floor(item.quantity / 10)
          }
        } else if (this.numpadMode === 'cost') {
          const str = item.costPrice.toString()
          const newStr = str.slice(0, -1)
          item.costPrice = newStr && !isNaN(parseFloat(newStr)) ? parseFloat(newStr) : 0
        } else if (this.numpadMode === 'price') {
          const str = item.newPrice.toString()
          const newStr = str.slice(0, -1)
          item.newPrice = newStr && !isNaN(parseFloat(newStr)) ? parseFloat(newStr) : 0
        }
        return
      }

      if (val === '.') {
        if (this.numpadMode === 'cost') {
          const str = item.costPrice.toString()
          if (!str.includes('.')) {
            // Track decimal input in store state or handle via string concatenation
            item.costPrice = parseFloat(str) || 0
          }
        } else if (this.numpadMode === 'price') {
          const str = item.newPrice.toString()
          if (!str.includes('.')) {
            item.newPrice = parseFloat(str) || 0
          }
        }
        return
      }

      const num = parseInt(val)
      if (isNaN(num)) return

      if (this.numpadMode === 'qty') {
        item.quantity = item.quantity === 0 || item.quantity === 1 ? num : parseInt(item.quantity.toString() + val)
      } else if (this.numpadMode === 'cost') {
        const str = item.costPrice === 0 ? '' : item.costPrice.toString()
        item.costPrice = parseFloat(str + val) || 0
      } else if (this.numpadMode === 'price') {
        const str = item.newPrice === 0 ? '' : item.newPrice.toString()
        item.newPrice = parseFloat(str + val) || 0
      }
    }
  }
})
