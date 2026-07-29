import { defineStore } from 'pinia'

export interface Table {
  id: number
  name: string
  seats: number
  occupied: boolean
  orderId?: string
  x: number
  y: number
  shape: 'square' | 'round'
}

export const useTableStore = defineStore('table', {
  state: () => ({
    floorName: 'pyora',
    activeTableId: null as number | null,
    tables: [
      { id: 1, name: '1', seats: 4, occupied: true, orderId: 'table-1-order', x: 92, y: 150, shape: 'square' },
      { id: 2, name: '2', seats: 2, occupied: false, x: 250, y: 150, shape: 'square' },
      { id: 3, name: '3', seats: 4, occupied: false, x: 410, y: 150, shape: 'round' },
      { id: 4, name: '4', seats: 6, occupied: false, x: 92, y: 320, shape: 'square' },
      { id: 5, name: '5', seats: 2, occupied: false, x: 270, y: 320, shape: 'round' },
      { id: 6, name: '6', seats: 8, occupied: false, x: 430, y: 320, shape: 'square' }
    ] as Table[]
  }),

  actions: {
    selectTable(tableId: number) {
      this.activeTableId = tableId
      const table = this.tables.find(t => t.id === tableId)
      if (table) {
        table.occupied = true
      }
    },
    clearTable(tableId: number) {
      const table = this.tables.find(t => t.id === tableId)
      if (table) {
        table.occupied = false
        table.orderId = undefined
      }
    }
  }
})
