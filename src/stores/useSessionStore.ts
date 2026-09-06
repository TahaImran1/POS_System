import { defineStore } from 'pinia'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { v4 as uuidv4 } from 'uuid'
import { desc, eq } from 'drizzle-orm'

export interface SessionEndReportData {
  sessionId: string
  nodeId: string
  cashierName: string
  status: string
  openedAt: number | null
  closedAt: number | null
  // 1) Opening Cash
  openingCash: number
  // 2) Total Sales
  grossSalesTotal: number
  netSalesTotal: number
  cashSalesTotal: number // i) Cash Sales
  creditSalesTotal: number // ii) Credit Sales
  cardSalesTotal: number // iii) Card Sales
  salesReturnsTotal: number // iv) Sales Return (Negative)
  // Counts
  cashSalesCount: number
  creditSalesCount: number
  cardSalesCount: number
  salesReturnsCount: number
  totalSalesCount: number
  // 3) Payments
  vendorPaymentsTotal: number // i) Vendors Payments
  vendorPaymentsCount: number
  vendorNonCashPaymentsTotal: number
  cashDropsTotal: number
  cashDropsCount: number
  // 4) Total closing cash that should be there
  expectedClosingCash: number
  // 5) Reconciliation
  closingCashCounted: number
  cashVariance: number
  // 6) Cash Denominations / Notes Breakdown
  closingNotesBreakdown?: Record<number, number> | null
  // 7) Closing Note
  closingNote?: string | null
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    isOpen: false,
    sessionId: '',
    nodeId: 'NODE_POS_001',
    cashierName: 'Store Manager',
    openingBalance: 0,
    cashSalesTotal: 0,
    creditSalesTotal: 0,
    cardSalesTotal: 0,
    salesReturnsTotal: 0,
    vendorPaymentsTotal: 0,
    completedSalesTotal: 0,
    completedSalesCount: 0,
    lastClosedDate: '',
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
          this.openingBalance = Number(latest.opening_balance || 0)
          const sessionSales = allSales.filter((s: any) => s.session_id === this.sessionId)
          
          this.cashSalesTotal = sessionSales
            .filter((s: any) => (s.payment_method || '').toLowerCase().includes('cash'))
            .reduce((sum: number, s: any) => sum + (s.net_total || 0), 0)

          this.creditSalesTotal = sessionSales
            .filter((s: any) => (s.payment_method || '').toLowerCase().includes('credit'))
            .reduce((sum: number, s: any) => sum + (s.net_total || 0), 0)

          this.cardSalesTotal = sessionSales
            .filter((s: any) => (s.payment_method || '').toLowerCase().includes('card') || (s.payment_method || '').toLowerCase().includes('bank'))
            .reduce((sum: number, s: any) => sum + (s.net_total || 0), 0)
        } else if (latest && latest.status === 'CLOSED') {
          this.isOpen = false
          this.lastClosedBalance = latest.closing_cash_counted || 0
          if (latest.closed_at) {
            const d = new Date(latest.closed_at)
            this.lastClosedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }
        } else {
          this.isOpen = false
          this.openingBalance = 0
        }
      } catch (e) {
        console.warn('Session load warning, defaulting to closed session:', e)
        this.isOpen = false
        this.openingBalance = 0
      }
    },

    async loadSessionReport(targetSessionId?: string): Promise<SessionEndReportData> {
      const sid = targetSessionId || this.sessionId
      let sessionRecord: any = null
      if (sid) {
        try {
          sessionRecord = await db.select().from(schema.cash_sessions)
            .where(eq(schema.cash_sessions.session_id, sid))
            .limit(1)
            .get()
        } catch (_) {}
      }
      if (!sessionRecord) {
        try {
          sessionRecord = await db.select().from(schema.cash_sessions)
            .orderBy(desc(schema.cash_sessions.opened_at))
            .limit(1)
            .get()
        } catch (_) {}
      }

      const activeSid = sessionRecord?.session_id || sid || 'session-live-001'
      const openingCash = Number(sessionRecord?.opening_balance || this.openingBalance || 0)

      // 1. Fetch sales for this session
      let sessionSales: any[] = []
      try {
        const allSales = await db.select().from(schema.sales)
        sessionSales = allSales.filter((s: any) => s.session_id === activeSid)
      } catch (_) {}

      let cashSalesTotal = 0
      let cashSalesCount = 0
      let creditSalesTotal = 0
      let creditSalesCount = 0
      let cardSalesTotal = 0
      let cardSalesCount = 0

      for (const s of sessionSales) {
        const amt = Number(s.net_total || 0)
        const method = (s.payment_method || 'Cash').toLowerCase()

        if (method.includes('cash')) {
          cashSalesTotal += amt
          cashSalesCount++
        } else if (method.includes('credit') || method.includes('account')) {
          creditSalesTotal += amt
          creditSalesCount++
        } else if (method.includes('card') || method.includes('bank')) {
          cardSalesTotal += amt
          cardSalesCount++
        } else {
          cashSalesTotal += amt
          cashSalesCount++
        }
      }

      const grossSalesTotal = Number((cashSalesTotal + creditSalesTotal + cardSalesTotal).toFixed(2))
      const totalSalesCount = sessionSales.length

      // 2. Fetch sales returns for this session
      let salesReturnsTotal = 0
      let salesReturnsCount = 0
      let cashSalesReturns = 0
      try {
        const returns = await db.select().from(schema.sales_returns)
        const sessionReturns = returns.filter((r: any) => r.session_id === activeSid)
        for (const r of sessionReturns) {
          const refundAmt = Math.abs(Number(r.total_refund_credit || Math.abs(r.net_settlement) || 0))
          salesReturnsTotal += refundAmt
          salesReturnsCount++
          const refMethod = (r.refund_method || 'Cash').toLowerCase()
          if (refMethod.includes('cash')) {
            cashSalesReturns += refundAmt
          }
        }
      } catch (e) {
        console.warn('Could not query sales returns for session report:', e)
      }

      const netSalesTotal = Number((grossSalesTotal - salesReturnsTotal).toFixed(2))

      // 3. Fetch vendor payments for this session
      let vendorPaymentsTotal = 0
      let vendorPaymentsCount = 0
      let vendorNonCashPaymentsTotal = 0
      try {
        const vPayments = await db.select().from(schema.vendor_payments)
        const sessionVPayments = vPayments.filter((p: any) => p.session_id === activeSid)
        for (const vp of sessionVPayments) {
          const amt = Number(vp.amount || 0)
          const payMethod = (vp.payment_method || 'Cash').toLowerCase()
          if (payMethod.includes('cash')) {
            vendorPaymentsTotal += amt
            vendorPaymentsCount++
          } else {
            vendorNonCashPaymentsTotal += amt
          }
        }
      } catch (e) {
        console.warn('Could not query vendor payments for session report:', e)
      }

      // 4. Fetch cash drops / expenses for this session
      let cashDropsTotal = 0
      let cashDropsCount = 0
      try {
        const drops = await db.select().from(schema.cash_drops)
        const sessionDrops = drops.filter((d: any) => d.session_id === activeSid)
        for (const cd of sessionDrops) {
          cashDropsTotal += Number(cd.amount || 0)
          cashDropsCount++
        }
      } catch (e) {
        console.warn('Could not query cash drops for session report:', e)
      }

      // 5. Total Closing Cash that should be there (physical drawer cash)
      // Opening Cash + Cash Sales - Cash Sales Returns - Vendor Cash Payments - Cash Drops
      const expectedClosingCash = Number((openingCash + cashSalesTotal - cashSalesReturns - vendorPaymentsTotal - cashDropsTotal).toFixed(2))
      const closingCounted = Number(sessionRecord?.closing_cash_counted !== null && sessionRecord?.closing_cash_counted !== undefined 
        ? sessionRecord.closing_cash_counted 
        : expectedClosingCash)
      const variance = Number((closingCounted - expectedClosingCash).toFixed(2))

      let closingNotesBreakdown: Record<number, number> | null = null
      if (sessionRecord?.closing_notes_breakdown) {
        try {
          closingNotesBreakdown = JSON.parse(sessionRecord.closing_notes_breakdown)
        } catch (_) {}
      }

      return {
        sessionId: activeSid,
        nodeId: sessionRecord?.node_id || this.nodeId,
        cashierName: sessionRecord?.cashier_name || this.cashierName,
        status: sessionRecord?.status || (this.isOpen ? 'OPEN' : 'CLOSED'),
        openedAt: sessionRecord?.opened_at ? Number(sessionRecord.opened_at) : null,
        closedAt: sessionRecord?.closed_at ? Number(sessionRecord.closed_at) : null,
        openingCash,
        grossSalesTotal,
        netSalesTotal,
        cashSalesTotal,
        creditSalesTotal,
        cardSalesTotal,
        salesReturnsTotal,
        cashSalesCount,
        creditSalesCount,
        cardSalesCount,
        salesReturnsCount,
        totalSalesCount,
        vendorPaymentsTotal,
        vendorPaymentsCount,
        vendorNonCashPaymentsTotal,
        cashDropsTotal,
        cashDropsCount,
        expectedClosingCash,
        closingCashCounted: closingCounted,
        cashVariance: variance,
        closingNotesBreakdown,
        closingNote: sessionRecord?.closing_note || ''
      }
    },

    async openSession(float: number) {
      try {
        const posNode = await db.select().from(schema.nodes).where(eq(schema.nodes.node_type, 'POS')).limit(1).get()
        if (posNode) {
          this.nodeId = posNode.node_id
        } else {
          this.nodeId = 'NODE_POS_001'
          await db.insert(schema.nodes).values({
            node_id: 'NODE_POS_001',
            node_type: 'POS',
            location_name: 'Main Store Register 1'
          }).catch(() => {})
        }

        this.sessionId = uuidv4()
        await db.insert(schema.cash_sessions).values({
          session_id: this.sessionId,
          node_id: this.nodeId,
          cashier_name: this.cashierName,
          opening_balance: float,
          status: 'OPEN',
          opened_at: Date.now()
        })

        this.openingBalance = float
        this.cashSalesTotal = 0
        this.creditSalesTotal = 0
        this.cardSalesTotal = 0
        this.salesReturnsTotal = 0
        this.vendorPaymentsTotal = 0
        this.completedSalesTotal = 0
        this.completedSalesCount = 0
        this.isOpen = true
      } catch (e) {
        console.warn('DB session save warning:', e)
        this.isOpen = true
      }
    },

    async closeSession(countedCash: number, reportData?: SessionEndReportData, breakdown?: Record<number, number> | null, closingNote?: string) {
      try {
        const expected = reportData ? reportData.expectedClosingCash : (this.openingBalance + this.cashSalesTotal)
        const variance = Number((countedCash - expected).toFixed(2))

        await db.update(schema.cash_sessions).set({
          expected_closing_balance: expected,
          closing_cash_counted: countedCash,
          cash_variance: variance,
          closing_notes_breakdown: breakdown ? JSON.stringify(breakdown) : null,
          closing_note: closingNote || null,
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

    async addCashDrop(type: 'CASH_IN' | 'CASH_OUT_SAFE' | 'EXPENSE', amount: number, reason: string) {
      if (!this.sessionId) return
      await db.insert(schema.cash_drops).values({
        drop_id: uuidv4(),
        session_id: this.sessionId,
        type,
        amount,
        reason,
        created_at: Date.now()
      })
    },

    resetSessionState() {
      this.isOpen = false
      this.sessionId = ''
      this.openingBalance = 0
      this.cashSalesTotal = 0
      this.creditSalesTotal = 0
      this.cardSalesTotal = 0
      this.salesReturnsTotal = 0
      this.vendorPaymentsTotal = 0
      this.completedSalesTotal = 0
      this.completedSalesCount = 0
    },

    addCashSale(amount: number) {
      this.cashSalesTotal += amount
      this.completedSalesTotal += amount
      this.completedSalesCount += 1
    }
  }
})

