import { defineStore } from 'pinia'
import type { Product } from './useProductStore'
import { useSessionStore } from './useSessionStore'
import { processSale } from '../services/bomService'
import { useProductStore } from './useProductStore'
import { useToast } from '../composables/useToast'
import { useSettingsStore } from './useSettingsStore'
import { taxService, type TaxGroup } from '../services/taxService'

export interface CartItem {
  id: string
  product: Product
  quantity: number
  price: number
  discount: number
  tax: number
  course?: string
}

export interface Ticket {
  id: string
  name: string
  items: CartItem[]
  selectedItemId: string | null
  billTaxesSnapshot: TaxGroup[]
}

export const useCartStore = defineStore('cart', {
  state: () => {
    const tickets: Ticket[] = [{
      id: 'table-1',
      name: 'Table 1',
      items: [],
      selectedItemId: null,
      billTaxesSnapshot: []
    }]
    
    return {
      tickets,
      activeTicketId: 'table-1',
      numpadMode: 'qty' as 'qty' | 'disc' | 'price',
      isCheckoutOpen: false,
      nextTicketNumber: 2,
      activeBillTaxes: [] as TaxGroup[]
    }
  },
  getters: {
    activeTicket: (state) => {
      return state.tickets.find(t => t.id === state.activeTicketId) || state.tickets[0]
    },
    items: (state): CartItem[] => {
      const ticket = state.tickets.find(t => t.id === state.activeTicketId)
      return ticket ? ticket.items : []
    },
    selectedItemId: (state): string | null => {
      const ticket = state.tickets.find(t => t.id === state.activeTicketId)
      return ticket ? ticket.selectedItemId : null
    },
    subtotal(): number {
      return this.items.reduce((sum: number, item: CartItem) => {
        const p = Number(item.price) || 0
        const q = Number(item.quantity) || 1
        const d = Number(item.discount) || 0
        return sum + (p * q * (1 - d / 100))
      }, 0)
    },
    itemTaxes(): number {
      return this.items.reduce((sum: number, item: CartItem) => {
        const t = Number(item.tax) || 0
        const q = Number(item.quantity) || 1
        return sum + (t * q)
      }, 0)
    },
    globalGstTax(): number {
      const ticket = this.activeTicket
      if (!ticket) return 0
      
      const billTaxes = (ticket.billTaxesSnapshot && ticket.billTaxesSnapshot.length > 0)
        ? ticket.billTaxesSnapshot
        : this.activeBillTaxes
      
      if (!billTaxes || billTaxes.length === 0) return 0

      let totalGlobalTax = 0
      for (const tax of billTaxes) {
        if (tax.is_inclusive) {
          const rate = tax.rate_percentage / 100
          const base = this.subtotal / (1 + rate)
          totalGlobalTax += this.subtotal - base
        } else {
          totalGlobalTax += this.subtotal * (tax.rate_percentage / 100)
        }
      }
      return totalGlobalTax
    },
    taxes(): number {
      return this.itemTaxes + this.globalGstTax
    },
    total(): number {
      const val = this.subtotal + this.taxes
      return isNaN(val) ? 0 : val
    },
    selectedItem(): CartItem | undefined {
      return this.items.find((i: CartItem) => i.id === this.selectedItemId)
    }
  },
  actions: {
    async fetchActiveBillTaxes() {
      try {
        const allTaxes = await taxService.getTaxGroups()
        this.activeBillTaxes = allTaxes.filter(t => t.tax_type === 'BILL' && t.is_active)
        for (const ticket of this.tickets) {
          if (!ticket.billTaxesSnapshot || ticket.billTaxesSnapshot.length === 0) {
            ticket.billTaxesSnapshot = [...this.activeBillTaxes]
          }
        }
      } catch (e) {
        console.warn('Could not fetch active bill taxes:', e)
      }
    },
    async createNewTicket(customName?: string) {
      const newName = customName || this.nextTicketNumber.toString()
      await this.fetchActiveBillTaxes()

      const newTicket: Ticket = {
        id: Math.random().toString(36).substr(2, 9),
        name: newName,
        items: [],
        selectedItemId: null,
        billTaxesSnapshot: [...this.activeBillTaxes]
      }
      this.tickets.push(newTicket)
      this.activeTicketId = newTicket.id
      if (!customName) this.nextTicketNumber++
    },
    switchTicket(id: string) {
      if (this.tickets.some(t => t.id === id)) {
        this.activeTicketId = id
      }
    },
    closeTicket(id: string) {
      this.tickets = this.tickets.filter(t => t.id !== id)
      if (this.tickets.length > 0) {
        if (this.activeTicketId === id) {
          this.activeTicketId = this.tickets[0].id
        }
      } else {
        this.activeTicketId = ''
      }
    },
    
    setSelectedItemId(id: string | null) {
      const ticket = this.tickets.find(t => t.id === this.activeTicketId)
      if (ticket) ticket.selectedItemId = id
    },

    async addProduct(product: Product) {
      if (this.activeBillTaxes.length === 0) {
        await this.fetchActiveBillTaxes()
      }
      if (this.tickets.length === 0 || !this.activeTicketId) {
        await this.createNewTicket()
      }
      let ticket = this.tickets.find(t => t.id === this.activeTicketId)
      if (!ticket) {
        await this.createNewTicket()
        ticket = this.tickets.find(t => t.id === this.activeTicketId)!
      }

      if (!ticket.billTaxesSnapshot || ticket.billTaxesSnapshot.length === 0) {
        ticket.billTaxesSnapshot = [...this.activeBillTaxes]
      }

      const existing = ticket.items.find(i => i.product.id === product.id)
      if (existing) {
        existing.quantity += 1
        ticket.selectedItemId = existing.id
      } else {
        const itemTax = Number(product.taxAmount) || 0
        const newItem: CartItem = {
          id: Math.random().toString(36).substr(2, 9),
          product,
          quantity: 1,
          price: Number(product.price) || 0,
          discount: 0,
          tax: itemTax,
          course: 'Course 1'
        }
        ticket.items.push(newItem)
        ticket.selectedItemId = newItem.id
      }
    },
    
    setNumpadMode(mode: 'qty' | 'disc' | 'price') {
      this.numpadMode = mode
    },
    
    handleNumpadInput(val: string) {
      const ticket = this.tickets.find(t => t.id === this.activeTicketId)
      if (!ticket) return
      
      // Auto-select latest item if no item selected
      if (!ticket.selectedItemId && ticket.items.length > 0) {
        ticket.selectedItemId = ticket.items[ticket.items.length - 1].id
      }
      if (!ticket.selectedItemId) return

      const item = ticket.items.find(i => i.id === ticket.selectedItemId)
      if (!item) return

      if (val === 'backspace') {
        if (this.numpadMode === 'qty') {
          item.quantity = Math.floor(item.quantity / 10)
          if (item.quantity === 0) {
            ticket.items = ticket.items.filter(i => i.id !== ticket.selectedItemId)
            ticket.selectedItemId = ticket.items.length > 0 ? ticket.items[ticket.items.length - 1].id : null
          }
        } else if (this.numpadMode === 'disc') {
          item.discount = Math.floor(item.discount / 10)
        } else if (this.numpadMode === 'price') {
          const str = item.price.toString()
          const newStr = str.slice(0, -1)
          item.price = newStr ? parseFloat(newStr) : 0
        }
        return
      }

      const num = parseInt(val)
      if (isNaN(num) && val !== '.') return

      if (this.numpadMode === 'qty') {
        item.quantity = item.quantity === 1 ? num : parseInt(item.quantity.toString() + val)
      } else if (this.numpadMode === 'disc') {
        const newDisc = parseInt(item.discount.toString() + val)
        item.discount = Math.min(100, isNaN(newDisc) ? 0 : newDisc)
      } else if (this.numpadMode === 'price') {
        item.price = parseFloat(item.price.toString() + val)
      }
    },

    fireCourse(courseName: string = 'Course 1') {
      const ticket = this.tickets.find(t => t.id === this.activeTicketId)
      const toast = useToast()
      if (ticket && ticket.items.length > 0) {
        toast.success(`🔥 Order (${ticket.name}) items under ${courseName} sent to kitchen!`)
      } else {
        toast.warning('Cart is empty. Add products before firing course.')
      }
    },
    
    clearActiveCart() {
      const ticket = this.tickets.find(t => t.id === this.activeTicketId)
      if (ticket) {
        ticket.items = []
        ticket.selectedItemId = null
      }
    },
    
    async checkout(paymentMethod: string) {
      const sessionStore = useSessionStore()
      if (!sessionStore.isOpen) {
        await sessionStore.openSession(100)
      }
      
      if (this.items.length === 0) return null

      const payload = this.items.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.price,
        tax: item.tax
      }))

      const finalTotal = this.total
      const currentSubtotal = this.subtotal
      const currentItemTaxes = this.itemTaxes
      const currentGlobalGst = this.globalGstTax
      const currentTotalTaxes = this.taxes
      const activeName = this.activeTicket?.name || 'Order'
      const checkoutItems = JSON.parse(JSON.stringify(this.items))

      const saleId = await processSale(
        payload, 
        paymentMethod, 
        finalTotal, 
        currentSubtotal, 
        currentTotalTaxes, 
        sessionStore.sessionId, 
        sessionStore.nodeId
      )

      if (paymentMethod === 'Cash') {
        sessionStore.addCashSale(finalTotal)
      }

      const productStore = useProductStore()
      await productStore.loadFromDb()

      this.clearActiveCart()
      this.isCheckoutOpen = false
      this.closeTicket(this.activeTicketId)
      
      return {
        saleId,
        total: finalTotal,
        subtotal: currentSubtotal,
        itemTaxes: currentItemTaxes,
        globalGst: currentGlobalGst,
        totalTaxes: currentTotalTaxes,
        items: checkoutItems,
        method: paymentMethod,
        ticketName: activeName
      }
    }
  }
})
