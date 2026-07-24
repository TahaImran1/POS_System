import { sqlite } from '../db/client.js';

export class SessionManager {
  // Open Cash Register Session
  static openSession(nodeId: string, cashierUserId: string, openingFloat: number) {
    const sessionId = `SESS_${Date.now()}`;
    const openedAt = new Date().toISOString();

    const stmt = sqlite.prepare(`
      INSERT INTO cash_sessions (session_id, node_id, cashier_user_id, opening_balance, cash_sales_total, bank_sales_total, credit_sales_total, status, opened_at)
      VALUES (?, ?, ?, ?, 0, 0, 0, 'OPEN', ?)
    `);
    stmt.run(sessionId, nodeId, cashierUserId, openingFloat, openedAt);

    return sessionId;
  }

  // Get Active Open Session
  static getActiveSession(nodeId: string): any {
    const stmt = sqlite.prepare(`SELECT * FROM cash_sessions WHERE node_id = ? AND status = 'OPEN'`);
    return stmt.get(nodeId);
  }

  // Close Session with Blind Count & Generate Z-Report Summary
  static closeSessionWithBlindCount(sessionId: string, actualCashCounted: number) {
    const stmt = sqlite.prepare(`SELECT * FROM cash_sessions WHERE session_id = ?`);
    const session: any = stmt.get(sessionId);

    if (!session) throw new Error('Session not found');

    const expectedCash = session.opening_balance + (session.cash_sales_total || 0);
    const cashVariance = actualCashCounted - expectedCash;
    const closedAt = new Date().toISOString();

    const updateStmt = sqlite.prepare(`
      UPDATE cash_sessions 
      SET closing_cash_counted = ?, cash_variance = ?, status = 'CLOSED', closed_at = ?
      WHERE session_id = ?
    `);
    updateStmt.run(actualCashCounted, cashVariance, closedAt, sessionId);

    return {
      sessionNumber: session.session_id,
      openedAt: session.opened_at,
      closedAt,
      openingFloat: session.opening_balance,
      cashSales: session.cash_sales_total || 0,
      bankSales: session.bank_sales_total || 0,
      creditSales: session.credit_sales_total || 0,
      expectedCash,
      actualCashCounted,
      cashVariance
    };
  }
}
