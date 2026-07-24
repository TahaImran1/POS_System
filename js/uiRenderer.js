// ============================================================================
// ENTERPRISE POS DOM UI RENDERER & THERMAL RECEIPT GENERATOR
// ============================================================================

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
}

export function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      display: flex; flex-direction: column; gap: 8px; pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bgColor = type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6';
  toast.style.cssText = `
    background: ${bgColor}; color: white; padding: 12px 18px; border-radius: 8px;
    font-family: system-ui, sans-serif; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); opacity: 0; transform: translateY(10px);
    transition: all 0.25s ease; pointer-events: auto;
  `;
  toast.innerText = message;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// Render Topbar Order Tabs
export function renderOrderTabs(orders, activeIndex, onSelectTab, onNewOrder) {
  const container = document.getElementById('topbar-order-tabs');
  if (!container) return;

  container.innerHTML = '';

  orders.forEach((order, idx) => {
    const tab = document.createElement('button');
    tab.className = `order-tab ${idx === activeIndex ? 'active' : ''}`;
    const itemCount = order.lines.reduce((sum, item) => sum + item.quantity, 0);
    
    tab.innerHTML = `
      <span>${order.name}</span>
      <span class="order-tab-badge">${itemCount}</span>
    `;

    tab.addEventListener('click', () => onSelectTab(idx));
    container.appendChild(tab);
  });

  const newBtn = document.createElement('button');
  newBtn.className = 'new-order-tab-btn';
  newBtn.title = 'New Order Tab';
  newBtn.innerHTML = '<i class="fas fa-plus"></i>';
  newBtn.addEventListener('click', onNewOrder);
  container.appendChild(newBtn);
}

// Render Customer Selector Bar
export function renderCustomerBar(customer, onOpenModal) {
  const btn = document.getElementById('btn-select-customer');
  if (!btn) return;

  if (!customer) {
    btn.innerHTML = `
      <span style="display:flex; align-items:center; gap:8px;">
        <i class="far fa-user"></i>
        <span>Customer</span>
      </span>
      <span style="color:var(--text-light); font-size:12px;">+ Set Customer</span>
    `;
  } else {
    const initials = customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    btn.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="width:32px; height:32px; border-radius:50%; background:#8b5cf6; color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px;">${initials}</div>
        <div style="text-align:left;">
          <div style="font-weight:600; font-size:13px; line-height:1.1;">${customer.name}</div>
          <div style="font-size:11px; color:#6b7280;">${customer.tier || 'Regular'} (${formatCurrency(customer.currentBalance)} Credit)</div>
        </div>
      </div>
      <div style="background:#f3e8ff; color:#7e22ce; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:600;">
        <i class="fas fa-award"></i> ${customer.loyaltyPoints || 0} pts
      </div>
    `;
  }

  btn.onclick = onOpenModal;
}

// Render Category Chips
export function renderCategoryChips(categories, activeCategoryId, onSelectCategory) {
  const container = document.getElementById('category-chips-bar');
  if (!container) return;

  container.innerHTML = '';

  categories.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = `category-chip ${cat.id === activeCategoryId ? 'active' : ''}`;
    chip.innerHTML = `
      ${cat.icon ? `<i class="fas ${cat.icon}"></i>` : ''}
      <span>${cat.name}</span>
    `;
    chip.addEventListener('click', () => onSelectCategory(cat.id));
    container.appendChild(chip);
  });
}

// Render Product Grid
export function renderProductGrid(products, onSelectProduct) {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  grid.innerHTML = '';

  products.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('data-id', product.id);

    const hasBOM = product.bom && product.bom.length > 0;

    card.innerHTML = `
      <div class="product-img-wrapper">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        <span class="product-price-tag">${formatCurrency(product.price)}</span>
        ${hasBOM ? `<span style="position:absolute; top:6px; left:6px; background:#10b981; color:white; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">BOM RECIPE</span>` : ''}
      </div>
      <div class="product-info">
        <div class="product-name">${product.name}</div>
        <div style="font-size:11px; color:#6b7280; margin-top:2px;">SKU: ${product.sku}</div>
      </div>
    `;

    card.addEventListener('click', () => onSelectProduct(product));
    grid.appendChild(card);
  });
}

// Render Order Ticket Lines
export function renderOrderLines(order, selectedIndex, onSelectLine) {
  const container = document.getElementById('order-lines-container');
  if (!container) return;

  container.innerHTML = '';

  if (!order || order.lines.length === 0) {
    container.innerHTML = `
      <div class="empty-cart-state">
        <i class="fas fa-shopping-basket"></i>
        <div style="font-weight:600; color:var(--text-muted);">Cart is empty</div>
        <div style="font-size:12px; color:var(--text-light); margin-top:4px;">Scan barcode or select items from catalog</div>
      </div>
    `;
    return;
  }

  order.lines.forEach((line, idx) => {
    const isSelected = idx === selectedIndex;
    const lineTotal = line.unitPrice * line.quantity * (1 - line.discountPerc / 100);

    const row = document.createElement('div');
    row.className = `order-line ${isSelected ? 'selected' : ''}`;

    const numpadMode = window.posApp?.numpadMode || 'qty';
    const numpadBuffer = window.posApp?.numpadBuffer || '';

    const isQtyActive = isSelected && numpadMode === 'qty';
    const isPriceActive = isSelected && numpadMode === 'price';
    const isDiscActive = isSelected && numpadMode === 'disc';

    row.innerHTML = `
      <div class="order-line-header">
        <span class="order-line-title">${line.product.name}</span>
        <span class="order-line-subtotal line-total-display">${formatCurrency(lineTotal)}</span>
      </div>

      <div class="order-line-details">
        <div class="line-qty-unit">
          <span style="font-weight:${isQtyActive ? '700' : '500'}; color:${isQtyActive ? 'var(--odoo-teal)' : 'inherit'};">
            ${line.quantity} Units
          </span>
          <span style="font-weight:${isPriceActive ? '700' : '400'}; color:${isPriceActive ? 'var(--odoo-teal)' : 'inherit'};">
            x ${formatCurrency(line.unitPrice)}
          </span>
          ${line.discountPerc > 0 ? `<span class="line-discount-pill">-${line.discountPerc}%</span>` : ''}
          ${isSelected && numpadBuffer ? `<span style="background:var(--odoo-teal); color:#fff; padding:1px 7px; border-radius:4px; font-size:10px; font-weight:700; font-family:var(--font-mono);">Typing: ${numpadBuffer}</span>` : ''}
        </div>

        <button class="btn-line-delete" style="border:none; background:transparent; color:#ef4444; cursor:pointer; opacity:${isSelected ? 1 : 0.4}; font-size:12px;" title="Remove Line" onclick="event.stopPropagation()">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
      ${line.product.bom ? `<div class="line-note"><i class="fas fa-cubes"></i> Recipe BOM Auto-Deducts</div>` : ''}
    `;

    row.addEventListener('click', () => onSelectLine(idx));

    const deleteBtn = row.querySelector('.btn-line-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        order.lines.splice(idx, 1);
        if (window.posApp) {
          window.posApp.selectedLineIndex = Math.max(-1, order.lines.length - 1);
          window.posApp.renderCart();
        }
      });
    }

    container.appendChild(row);
  });
}

// Render Order Summary Footer
export function renderOrderSummary(order) {
  const subtotalEl = document.getElementById('summary-subtotal');
  const taxesEl = document.getElementById('summary-taxes');
  const totalEl = document.getElementById('summary-total');
  const payBadgeEl = document.getElementById('pay-btn-total-badge');

  if (!order) return;

  let subtotal = 0;
  let taxTotal = 0;

  order.lines.forEach(line => {
    const lineNet = line.unitPrice * line.quantity * (1 - line.discountPerc / 100);
    const base = lineNet / 1.10;
    const tax = lineNet - base;
    subtotal += base;
    taxTotal += tax;
  });

  const grandTotal = subtotal + taxTotal;

  if (subtotalEl) subtotalEl.innerText = formatCurrency(subtotal);
  if (taxesEl) taxesEl.innerText = formatCurrency(taxTotal);
  if (totalEl) totalEl.innerText = formatCurrency(grandTotal);
  if (payBadgeEl) payBadgeEl.innerText = formatCurrency(grandTotal);
}

// Render Customer Receipt
export function renderThermalReceipt(order, paymentMethod, tenderedAmount, storeInfo) {
  let modal = document.getElementById('modal-receipt');
  if (!modal) return;

  let subtotal = 0;
  let taxTotal = 0;

  let itemsHtml = order.lines.map(line => {
    const lineTotal = line.unitPrice * line.quantity * (1 - line.discountPerc / 100);
    const base = lineTotal / 1.10;
    subtotal += base;
    taxTotal += (lineTotal - base);

    return `
      <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:12px;">
        <span>${line.quantity}x ${line.product.name}</span>
        <span style="font-family:monospace;">${formatCurrency(lineTotal)}</span>
      </div>
    `;
  }).join('');

  const grandTotal = subtotal + taxTotal;
  const change = Math.max(0, tenderedAmount - grandTotal);

  const receiptBody = document.getElementById('receipt-body-content');
  if (receiptBody) {
    receiptBody.innerHTML = `
      <div style="text-align:center; margin-bottom:12px;">
        <h3 style="margin:0; font-size:16px;">${storeInfo.storeName}</h3>
        <div style="font-size:11px; color:#6b7280;">${storeInfo.branchName}</div>
        <div style="font-size:11px; color:#6b7280;">Tax ID: ${storeInfo.taxId}</div>
      </div>
      <hr style="border:none; border-top:1px dashed #cbd5e1; margin:10px 0;">
      ${itemsHtml}
      <hr style="border:none; border-top:1px dashed #cbd5e1; margin:10px 0;">
      <div style="display:flex; justify-content:space-between; font-size:12px;">
        <span>Subtotal:</span><span>${formatCurrency(subtotal)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:12px;">
        <span>VAT (10% Inc.):</span><span>${formatCurrency(taxTotal)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold; margin-top:6px;">
        <span>Total Net:</span><span>${formatCurrency(grandTotal)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:12px; margin-top:6px; color:#6b7280;">
        <span>Payment Method:</span><span>${paymentMethod}</span>
      </div>
      ${paymentMethod === 'Cash' ? `
        <div style="display:flex; justify-content:space-between; font-size:12px; color:#6b7280;">
          <span>Tendered:</span><span>${formatCurrency(tenderedAmount)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:12px; color:#10b981; font-weight:bold;">
          <span>Change Returned:</span><span>${formatCurrency(change)}</span>
        </div>
      ` : ''}
    `;
  }

  modal.style.display = 'flex';
}

// Render Z-Report Shift Close Financial Summary Receipt
export function renderZReportReceipt(session, actualCounted, expectedCash, variance, storeInfo) {
  let modal = document.getElementById('modal-receipt');
  if (!modal) return;

  const receiptBody = document.getElementById('receipt-body-content');
  if (receiptBody) {
    receiptBody.innerHTML = `
      <div style="text-align:center; margin-bottom:12px;">
        <h3 style="margin:0; font-size:16px; color:#7e22ce;">Z-REPORT FINANCIAL SHIFT CLOSE</h3>
        <div style="font-size:11px; color:#6b7280;">Session: ${session.sessionNumber}</div>
        <div style="font-size:11px; color:#6b7280;">Cashier: ${storeInfo.currentCashier}</div>
      </div>
      <hr style="border:none; border-top:1px dashed #cbd5e1; margin:10px 0;">
      <div style="display:flex; justify-content:space-between; font-size:12px;">
        <span>Opening Float:</span><span>${formatCurrency(session.openingBalance)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:12px;">
        <span>Total Cash Sales:</span><span>${formatCurrency(session.cashSalesTotal)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:12px;">
        <span>Total Bank/Card Sales:</span><span>${formatCurrency(session.bankSalesTotal)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:12px;">
        <span>Total Credit Sales:</span><span>${formatCurrency(session.creditSalesTotal)}</span>
      </div>
      <hr style="border:none; border-top:1px dashed #cbd5e1; margin:10px 0;">
      <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold;">
        <span>Expected Cash Drawer:</span><span>${formatCurrency(expectedCash)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; color:#3b82f6;">
        <span>Actual Cash Counted:</span><span>${formatCurrency(actualCounted)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; color:${variance === 0 ? '#10b981' : '#ef4444'}; margin-top:4px;">
        <span>Cash Variance:</span><span>${formatCurrency(variance)}</span>
      </div>
    `;
  }

  modal.style.display = 'flex';
}
