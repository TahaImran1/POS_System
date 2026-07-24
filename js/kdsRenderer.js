// ============================================================================
// ODOO 18 KITCHEN DISPLAY SYSTEM (KDS) RENDERER
// ============================================================================

export function renderKdsBoard(tickets, onBumpTicket) {
  const container = document.getElementById('kds-tickets-container');
  if (!container) return;

  container.innerHTML = '';

  if (!tickets || tickets.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80px 20px; color:var(--text-muted);">
        <i class="fas fa-check-circle" style="font-size:56px; color:var(--odoo-teal); margin-bottom:16px; opacity:0.8;"></i>
        <div style="font-size:18px; font-weight:700; color:var(--text-main);">Kitchen Board Clear!</div>
        <div style="font-size:13px; margin-top:4px;">No active orders pending in this station.</div>
      </div>
    `;
    return;
  }

  tickets.forEach(t => {
    const card = document.createElement('div');
    card.className = `kds-ticket-card status-${t.status.toLowerCase()}`;

    let statusColor = '#f59e0b';
    if (t.status === 'PREPARING') statusColor = '#017E84';
    if (t.status === 'READY') statusColor = '#10b981';

    card.innerHTML = `
      <div class="kds-ticket-header" style="border-left: 4px solid ${statusColor};">
        <div>
          <div style="font-weight:700; font-size:15px; color:var(--text-main);">${t.orderNo}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${t.table} &bull; ${t.orderType}</div>
        </div>
        <div style="text-align:right;">
          <span class="kds-status-badge" style="background:${statusColor}; color:#fff; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:700;">${t.status}</span>
          <div style="font-size:11px; color:var(--text-light); margin-top:4px;"><i class="far fa-clock"></i> ${t.timeAgo}</div>
        </div>
      </div>

      <div class="kds-ticket-body">
        ${t.items.map(item => `
          <div class="kds-item-row" style="display:flex; justify-content:space-between; align-items:flex-start; padding:8px 0; border-bottom:1px dashed var(--border-color);">
            <div>
              <span style="font-weight:700; color:var(--odoo-teal); font-size:14px; margin-right:8px;">${item.qty}x</span>
              <span style="font-weight:600; font-size:13.5px; color:var(--text-main);">${item.name}</span>
              ${item.notes ? `<div style="font-size:11px; color:#ef4444; margin-top:2px; font-style:italic;"><i class="fas fa-exclamation-circle"></i> ${item.notes}</div>` : ''}
            </div>
            ${item.bomDeducted ? `<span style="font-size:10px; background:rgba(16,185,129,0.15); color:#10b981; padding:2px 6px; border-radius:4px; font-weight:600;"><i class="fas fa-cubes"></i> BOM</span>` : ''}
          </div>
        `).join('')}
      </div>

      <div class="kds-ticket-footer" style="padding:10px 14px; background:var(--bg-surface-subtle); border-top:1px solid var(--border-color); display:flex; justify-content:flex-end;">
        <button class="btn-bump-ticket" style="width:100%; padding:8px 14px; background:${statusColor}; color:#fff; border:none; border-radius:6px; font-weight:700; font-size:13px; cursor:pointer;">
          ${t.status === 'PENDING' ? 'Start Preparing' : t.status === 'PREPARING' ? 'Mark as READY' : 'Mark as SERVED'}
        </button>
      </div>
    `;

    const bumpBtn = card.querySelector('.btn-bump-ticket');
    if (bumpBtn) {
      bumpBtn.addEventListener('click', () => onBumpTicket(t.ticketId));
    }

    container.appendChild(card);
  });
}

export function renderKdsStats(tickets) {
  const pendingEl = document.getElementById('kds-count-pending');
  const prepEl = document.getElementById('kds-count-preparing');
  const readyEl = document.getElementById('kds-count-ready');

  if (pendingEl) pendingEl.innerText = tickets.filter(t => t.status === 'PENDING').length;
  if (prepEl) prepEl.innerText = tickets.filter(t => t.status === 'PREPARING').length;
  if (readyEl) readyEl.innerText = tickets.filter(t => t.status === 'READY').length;
}
