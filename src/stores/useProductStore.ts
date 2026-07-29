import { defineStore } from 'pinia'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { eq } from 'drizzle-orm'
import { calculateTaxesForProduct } from '../services/taxService'

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
  type: string
  stock?: number
  taxGroupId: string
  image: string
  description: string
  taxAmount: number
}

const defaultOdooProducts: Product[] = [
  { id: '1', sku: 'OD001', barcode: 'OD001', name: 'Office Chair', category: 'chairs', price: 81.90, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Office+Chair&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 8.19 },
  { id: '2', sku: 'OD002', barcode: 'OD002', name: 'Office Lamp', category: 'misc', price: 35.00, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Office+Lamp&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 3.50 },
  { id: '3', sku: 'OD003', barcode: 'OD003', name: 'Office Design Software', category: 'misc', price: 327.60, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Office+Design+Software&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 32.76 },
  { id: '4', sku: 'OD004', barcode: 'OD004', name: 'Desk Combination', category: 'desks', price: 450.00, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Desk+Combination&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 45.00 },
  { id: '5', sku: 'OD005', barcode: 'OD005', name: 'Customizable Desk', category: 'desks', price: 650.00, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Customizable+Desk&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 65.00 },
  { id: '6', sku: 'OD006', barcode: 'OD006', name: 'Corner Desk Right Sit', category: 'desks', price: 540.00, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Corner+Desk+Right+Sit&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 54.00 },
  { id: '7', sku: 'OD007', barcode: 'OD007', name: 'Large Cabinet', category: 'misc', price: 320.00, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Large+Cabinet&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 32.00 },
  { id: '8', sku: 'OD008', barcode: 'OD008', name: 'Storage Box', category: 'misc', price: 15.00, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Storage+Box&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 1.50 },
  { id: '9', sku: 'OD009', barcode: 'OD009', name: 'Virtual Interior Design', category: 'misc', price: 35.98, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Virtual+Interior+Design&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 3.60 },
  { id: '10', sku: 'OD010', barcode: 'OD010', name: 'Virtual Home Staging', category: 'misc', price: 44.75, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Virtual+Home+Staging&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 4.48 },
  { id: '11', sku: 'OD011', barcode: 'OD011', name: 'Pedal Bin', category: 'misc', price: 18.00, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Pedal+Bin&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 1.80 },
  { id: '12', sku: 'OD012', barcode: 'OD012', name: 'Cabinet with Doors', category: 'misc', price: 140.00, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Cabinet+with+Doors&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 14.00 },
  { id: '13', sku: 'OD013', barcode: 'OD013', name: 'Conference Chair', category: 'chairs', price: 165.00, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Conference+Chair&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 16.50 },
  { id: '14', sku: 'OD014', barcode: 'OD014', name: 'Corner Desk Left Sit', category: 'desks', price: 540.00, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Corner+Desk+Left+Sit&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 54.00 },
  { id: '15', sku: 'OD015', barcode: 'OD015', name: 'Drawer Black', category: 'desks', price: 129.29, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Drawer+Black&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 12.93 },
  { id: '16', sku: 'OD016', barcode: 'OD016', name: 'Flipover', category: 'misc', price: 85.00, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Flipover&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 8.50 },
  { id: '17', sku: 'OD017', barcode: 'OD017', name: 'Desk Stand with Screen', category: 'desks', price: 210.00, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Desk+Stand+with+Screen&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 21.00 },
  { id: '18', sku: 'OD018', barcode: 'OD018', name: 'Individual Workplace', category: 'desks', price: 890.00, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Individual+Workplace&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 89.00 },
  { id: '19', sku: 'OD019', barcode: 'OD019', name: 'Drawer', category: 'desks', price: 129.29, type: 'RETAIL_GOOD', image: 'https://ui-avatars.com/api/?name=Drawer&background=f1f3f5&color=495057&size=128', description: '', taxGroupId: '', taxAmount: 12.93 }
]

export const useProductStore = defineStore('product', {
  state: () => ({
    categories: [
      { id: "misc", name: "Misc", icon: "fa-box", color: "bg-[#f783ac] text-gray-900 font-bold" },
      { id: "desks", name: "Desks", icon: "fa-[#f783ac]", color: "bg-[#f783ac] text-gray-900 font-bold" },
      { id: "chairs", name: "Chairs", icon: "fa-chair", color: "bg-[#66d9e8] text-gray-900 font-bold" }
    ] as Category[],
    products: defaultOdooProducts as Product[],
    selectedCategoryId: 'all'
  }),
  getters: {
    filteredProducts: (state) => {
      if (state.selectedCategoryId === 'all') return state.products
      return state.products.filter(p => p.category === state.selectedCategoryId)
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
          this.products = await Promise.all(records.map(async (r: any) => {
            const inv = await db.select().from(schema.inventory).where(eq(schema.inventory.product_id, r.product_id)).get()
            const taxes = await calculateTaxesForProduct(r.product_id, r.default_price)
            
            return {
              id: r.product_id,
              sku: r.barcode || '',
              barcode: r.barcode || '',
              name: r.name,
              category: r.name.toLowerCase().includes('chair') ? 'chairs' : r.name.toLowerCase().includes('desk') ? 'desks' : 'misc',
              price: r.default_price,
              type: r.product_type,
              stock: inv?.quantity,
              taxGroupId: '',
              image: r.image || 'https://ui-avatars.com/api/?name=' + (r.name ? r.name[0] : 'U'),
              description: r.description || '',
              taxAmount: taxes.taxAmount
            }
          }))
        }
      } catch (e) {
        console.warn('Could not load products from SQLite, using defaults:', e)
      }
    }
  }
})
