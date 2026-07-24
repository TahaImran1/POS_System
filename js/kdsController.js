// ============================================================================
// ODOO 18 KITCHEN DISPLAY SYSTEM (KDS) CONTROLLER
// ============================================================================

import { sounds } from './soundEffects.js';
import { renderKdsBoard, renderKdsStats } from './kdsRenderer.js';
import { showToast } from './uiRenderer.js';

export class KdsController {
  constructor(posApp) {
    this.posApp = posApp;
    this.activeStation = 'ALL';
    this.tickets = [];
    this.initMockTickets();
  }

  initMockTickets() {
    this.tickets = [
      {
        ticketId: 'KDS-101',
        orderNo: 'Ord #101',
        table: 'Table 4 (Patio)',
        server: 'Mitchell Admin',
        orderType: 'DINE_IN',
        timeAgo: '4 min ago',
        status: 'PREPARING', // 'PENDING', 'PREPARING', 'READY', 'SERVED'
        station: 'Grill',
        items: [
          { name: 'Double Bacon Cheeseburger', qty: 2, notes: 'Medium rare, no onions', bomDeducted: true },
          { name: 'Crispy French Fries', qty: 2, notes: 'Extra crispy', bomDeducted: false }
        ]
      },
      {
        ticketId: 'KDS-102',
        orderNo: 'Ord #102',
        table: 'Table 1 (Main Hall)',
        server: 'Anita Oliver',
        orderType: 'DINE_IN',
        timeAgo: '2 min ago',
        status: 'PENDING',
        station: 'Bar',
        items: [
          { name: 'Espresso Macchiato', qty: 3, notes: 'Oat milk substitution', bomDeducted: true },
          { name: 'Iced Matcha Latte', qty: 1, notes: 'Less ice', bomDeducted: false }
        ]
      },
      {
        ticketId: 'KDS-103',
        orderNo: 'Ord #103',
        table: 'Takeaway #12',
        server: 'Online API',
        orderType: 'TAKEAWAY',
        timeAgo: '8 min ago',
        status: 'READY',
        station: 'Kitchen',
        items: [
          { name: 'On-Site Hardware Installation', qty: 1, notes: 'Service job', bomDeducted: false }
        ]
      }
    ];
  }

  setStation(station) {
    this.activeStation = station;
    sounds.playClick();
    this.render();
  }

  bumpTicketStatus(ticketId) {
    const ticket = this.tickets.find(t => t.ticketId === ticketId);
    if (!ticket) return;

    if (ticket.status === 'PENDING') {
      ticket.status = 'PREPARING';
      showToast(`${ticket.orderNo} moved to PREPARING`, 'info');
    } else if (ticket.status === 'PREPARING') {
      ticket.status = 'READY';
      sounds.playSuccess();
      showToast(`${ticket.orderNo} is READY!`, 'success');
    } else if (ticket.status === 'READY') {
      ticket.status = 'SERVED';
      showToast(`${ticket.orderNo} marked as SERVED`, 'info');
    }

    this.render();
  }

  addTicketFromOrder(order) {
    const newTicket = {
      ticketId: `KDS-${Date.now().toString().slice(-4)}`,
      orderNo: `Ord #${order.id || Math.floor(Math.random()*1000)}`,
      table: order.tableName || 'Dine-In',
      server: 'Cashier',
      orderType: order.orderType || 'TAKEAWAY',
      timeAgo: 'Just now',
      status: 'PENDING',
      station: 'Grill',
      items: order.lines.map(l => ({
        name: l.product.name,
        qty: l.quantity,
        notes: l.notes || '',
        bomDeducted: !!l.product.bom
      }))
    };

    this.tickets.unshift(newTicket);
    this.render();
  }

  render() {
    let filtered = this.tickets.filter(t => t.status !== 'SERVED');
    if (this.activeStation !== 'ALL') {
      filtered = filtered.filter(t => t.station.toUpperCase() === this.activeStation.toUpperCase());
    }

    renderKdsBoard(filtered, (ticketId) => this.bumpTicketStatus(ticketId));
    renderKdsStats(this.tickets);
  }
}
