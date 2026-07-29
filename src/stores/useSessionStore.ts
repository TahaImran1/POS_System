import { defineStore } from 'pinia'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { v4 as uuidv4 } from 'uuid'
import { desc, eq } from 'drizzle-orm'

export const useSessionStore = defineStore('session', {
  state: () => ({
    isOpen: true,
    sessionId: 'session-live-001',
    nodeId: 'NODE_POS_001',
    cashierName: 'Mitchell Admin',
    openingBalance: 1000,
    cashSalesTotal: 0,
    completedSalesTotal: 0,
    completedSalesCount: 0,
    lastClosedDate: 'Jul 25',
    lastClosedBalance: 0
  }),
  actions: {
    async loadLatestSession() {
      try {
        const posNode = await db.select().from(schema.nodes).where(eq(schema.nodes.node_type, 'POS')).limit(1).get()
        if (posNode) this.nodeId = posNode.node_id

        // Load all sales to calculate total sales & count
        const allSales = await db.select().from(schema.sales)
        this.completedSalesCount = allSales.length
        this.completedSalesTotal = allSales.reduce((sum: number, s: any) => sum + (s.net_total || 0), 0)

        const latest = await db.select().from(schema.cash_sessions)
          .orderBy(desc(schema.cash_sessions.opened_at))
          .limit(1)
          .get()

        if (latest && latest.status === 'OPEN') {
          this.isOpen = true
          this.sessionId = latest.session_id
          this.openingBalance = latest.opening_balance
          const sessionSales = allSales.filter((s: any) => s.session_id === this.sessionId)
          
          this.cashSalesTotal = sessionSales
            .filter((s: any) => s.payment_method === 'Cash')
            .reduce((sum: number, s: any) => sum + (s.net_total || 0), 0)
        } else if (latest && latest.status === 'CLOSED') {
          this.isOpen = false
          this.lastClosedBalance = latest.closing_cash_counted || 0
          if (latest.closed_at) {
            const d = new Date(latest.closed_at)
            this.lastClosedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }
        }
      } catch (e) {
        console.warn('Session load warning, defaulting to open session:', e)
        this.isOpen = true
      }
    },
    async openSession(float: number) {
      try {
        if (!this.nodeId) {
          const posNode = await db.select().from(schema.nodes).where(eq(schema.nodes.node_type, 'POS')).limit(1).get()
          if (posNode) this.nodeId = posNode.node_id
        }

        this.sessionId = uuidv4()
        await db.insert(schema.cash_sessions).values({
          session_id: this.sessionId,
          node_id: this.nodeId || 'NODE_POS_001',
          cashier_name: this.cashierName,
          opening_balance: float,
          status: 'OPEN',
          opened_at: Date.now()
        })

        this.openingBalance = float
        this.cashSalesTotal = 0
        this.completedSalesTotal = 0
        this.completedSalesCount = 0
        this.isOpen = true
      } catch (e) {
        console.warn('DB session save warning:', e)
        this.isOpen = true
      }
    },
    async closeSession(countedCash: number) {
      try {
        const expected = this.openingBalance + this.cashSalesTotal
        const variance = countedCash - expected

        await db.update(schema.cash_sessions).set({
          expected_closing_balance: expected,
          closing_cash_counted: countedCash,
          cash_variance: variance,
          status: 'CLOSED',
          closed_at: Date.now()
        }).where(eq(schema.cash_sessions.session_id, this.sessionId))

        this.lastClosedBalance = countedCash
        const d = new Date()
        this.lastClosedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      } catch (e) {
        console.warn('DB session close warning:', e)
      }

      this.isOpen = false
    },
    addCashSale(amount: number) {
      this.cashSalesTotal += amount
      this.completedSalesTotal += amount
      this.completedSalesCount += 1
    }
  }
})
