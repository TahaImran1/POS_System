import { defineStore } from 'pinia'
import type { Product } from './useProductStore'
import { useSessionStore } from './useSessionStore'
import { processSale } from '../services/bomService'
import { useProductStore } from './useProductStore'

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
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    tickets: [
      { id: 'table-1', name: '1', items: [], selectedItemId: null }
    ] as Ticket[],
    activeTicketId: 'table-1',
    numpadMode: 'qty' as 'qty' | 'disc' | 'price',
    isCheckoutOpen: false,
    nextTicketNumber: 2
  }),
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
    taxes(): number {
      return this.items.reduce((sum: number, item: CartItem) => {
        const t = Number(item.tax) || 0
        const q = Number(item.quantity) || 1
        return sum + (t * q)
      }, 0)
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
    createNewTicket(customName?: string) {
      const newName = customName || this.nextTicketNumber.toString()
      const newTicket: Ticket = {
        id: Math.random().toString(36).substr(2, 9),
        name: newName,
        items: [],
        selectedItemId: null
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

    addProduct(product: Product) {
      if (this.tickets.length === 0 || !this.activeTicketId) {
        this.createNewTicket()
      }
      let ticket = this.tickets.find(t => t.id === this.activeTicketId)
      if (!ticket) {
        this.createNewTicket()
        ticket = this.tickets.find(t => t.id === this.activeTicketId)!
      }

      const existing = ticket.items.find(i => i.product.id === product.id)
      if (existing) {
        existing.quantity += 1
        ticket.selectedItemId = existing.id
      } else {
        const newItem: CartItem = {
          id: Math.random().toString(36).substr(2, 9),
          product,
          quantity: 1,
          price: Number(product.price) || 0,
          discount: 0,
          tax: Number(product.taxAmount) || (Number(product.price) * 0.1),
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
      if (!ticket || !ticket.selectedItemId) return
      
      const item = ticket.items.find(i => i.id === ticket.selectedItemId)
      if (!item) return

      if (val === 'backspace') {
        if (this.numpadMode === 'qty') item.quantity = Math.floor(item.quantity / 10)
        if (item.quantity === 0) {
          ticket.items = ticket.items.filter(i => i.id !== ticket.selectedItemId)
          ticket.selectedItemId = null
        }
        return
      }

      const num = parseInt(val)
      if (isNaN(num) && val !== '.') return

      if (this.numpadMode === 'qty') {
        item.quantity = item.quantity === 1 ? num : parseInt(item.quantity.toString() + val)
      } else if (this.numpadMode === 'disc') {
        item.discount = parseInt(item.discount.toString() + val)
      } else if (this.numpadMode === 'price') {
        item.price = parseFloat(item.price.toString() + val)
      }
    },

    fireCourse(courseName: string = 'Course 1') {
      const ticket = this.tickets.find(t => t.id === this.activeTicketId)
      if (ticket && ticket.items.length > 0) {
        alert(`🔥 Order (${ticket.name}) items under ${courseName} sent to kitchen!`)
      } else {
        alert('Cart is empty. Add products before firing course.')
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
      if (!sessionStore.isOpen) throw new Error("No active session!")
      
      if (this.items.length === 0) return null

      const payload = this.items.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.price,
        tax: item.tax
      }))

      const finalTotal = this.total
      const activeName = this.activeTicket?.name || 'Order'

      await processSale(
        payload, 
        paymentMethod, 
        finalTotal, 
        this.subtotal, 
        this.taxes, 
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
        total: finalTotal,
        method: paymentMethod,
        ticketName: activeName
      }
    }
  }
})
