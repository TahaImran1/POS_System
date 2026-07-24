// ============================================================================
// ODOO 18 RESTAURANT TABLE & FLOOR MAP CONTROLLER
// ============================================================================

import { RESTAURANT_TABLES } from './mockData.js';
import { sounds } from './soundEffects.js';
import { showToast } from './uiRenderer.js';

export class TableMapController {
  constructor(posApp) {
    this.posApp = posApp;
    this.tables = [...RESTAURANT_TABLES];
    this.activeFloor = 'Main Dining';
  }

  setFloor(floorName) {
    this.activeFloor = floorName;
    sounds.playClick();
    this.render();
  }

  selectTable(tableId) {
    const table = this.tables.find(t => t.id === tableId);
    if (!table) return;

    sounds.playClick();
    showToast(`Selected ${table.name} (${table.seats} Seats)`, 'info');

    // Attach table to active POS order
    const order = this.posApp.getActiveOrder();
    order.tableName = table.name;
    table.status = 'OCCUPIED';

    // Switch back to POS terminal view
    document.querySelectorAll('.app-nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector('.app-nav-item[data-view="pos"]').classList.add('active');

    document.querySelectorAll('.app-view-screen').forEach(s => s.classList.remove('active'));
    document.getElementById('view-pos-screen').classList.add('active');

    this.posApp.renderAll();
  }

  render() {
    const container = document.getElementById('table-map-grid');
    if (!container) return;

    container.innerHTML = '';

    const filtered = this.tables.filter(t => t.floor === this.activeFloor);

    filtered.forEach(t => {
      const card = document.createElement('div');
      card.className = `table-card status-${t.status.toLowerCase()}`;
      card.style.cssText = `
        padding:20px; border-radius:12px; background:var(--bg-surface); border:2px solid var(--border-color);
        display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer;
        transition:all 200ms ease; box-shadow:var(--shadow-sm); position:relative; min-height:120px;
      `;

      let badgeBg = '#10b981';
      if (t.status === 'OCCUPIED') badgeBg = '#017E84';

      card.innerHTML = `
        <div style="position:absolute; top:10px; right:10px; background:${badgeBg}; color:#fff; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700;">${t.status}</div>
        <i class="fas fa-utensils" style="font-size:28px; color:var(--odoo-purple); margin-bottom:8px;"></i>
        <div style="font-weight:700; font-size:16px; color:var(--text-main);">${t.name}</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${t.seats} Seats</div>
      `;

      card.addEventListener('click', () => this.selectTable(t.id));
      container.appendChild(card);
    });
  }
}
