// ============================================================================
// ODOO POS DOM UI RENDERER
// ============================================================================

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
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

  // New Order '+' button
  const newBtn = document.createElement('button');
  newBtn.className = 'new-order-tab-btn';
  newBtn.title = 'New Concurrent Order (Hold/Switch)';
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
      <div class="customer-info-badge">
        <div class="customer-avatar">${initials}</div>
        <div>
          <div style="font-weight:600; line-height:1.1;">${customer.name}</div>
          <div style="font-size:11px; color:var(--text-muted);">${customer.tier || 'Regular'}</div>
        </div>
      </div>
      <div class="customer-loyalty-pill">
        <i class="fas fa-award"></i> ${customer.loyaltyPoints || 0} pts
      </div>
    `;
  }

  btn.onclick = onOpenModal;
}

// Render Category Filter Chips
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

  if (products.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding: 60px 20px; color: var(--text-muted);">
        <i class="fas fa-search" style="font-size: 38px; opacity:0.4; margin-bottom:12px;"></i>
        <p style="font-size: 15px; font-weight: 500;">No products match your search or category filter.</p>
      </div>
    `;
    return;
  }

  products.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('data-id', product.id);

    card.innerHTML = `
      <div class="product-image-box">
        <img src="${product.image}" alt="${product.name}" />
        <span class="product-sku-badge">${product.barcode}</span>
        <span class="product-price-pill">${formatCurrency(product.price)}</span>
      </div>
      <div class="product-info-box">
        <div class="product-card-title">${product.name}</div>
        <div class="product-card-meta">
          <span>${product.stock > 10 ? 'In Stock' : `${product.stock} left`}</span>
          <span>VAT 10%</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      // micro animation
      card.classList.remove('animate-click');
      void card.offsetWidth; // trigger reflow
      card.classList.add('animate-click');
      onSelectProduct(product);
    });

    grid.appendChild(card);
  });
}

// Render Order Lines
export function renderOrderLines(order, selectedLineIndex, onSelectLine) {
  const container = document.getElementById('order-lines-container');
  if (!container) return;

  container.innerHTML = '';

  if (!order || order.lines.length === 0) {
    container.innerHTML = `
      <div class="empty-cart-state">
        <i class="fas fa-shopping-basket"></i>
        <p>Order is empty</p>
        <span style="font-size:12px; margin-top:4px;">Select products from catalog or scan barcode</span>
      </div>
    `;
    return;
  }

  order.lines.forEach((line, index) => {
    const el = document.createElement('div');
    el.className = `order-line ${index === selectedLineIndex ? 'selected' : ''}`;

    const subtotal = line.price * line.quantity * (1 - (line.discount || 0) / 100);

    el.innerHTML = `
      <div class="order-line-header">
        <span class="order-line-title">${line.product.name}</span>
        <span class="order-line-subtotal">${formatCurrency(subtotal)}</span>
      </div>
      <div class="order-line-details">
        <div class="line-qty-unit">
          <span style="font-weight:600; color:var(--text-main);">${line.quantity} Unit(s)</span>
          <span>x ${formatCurrency(line.price)}</span>
        </div>
        <div>
          ${line.discount > 0 ? `<span class="line-discount-pill">-${line.discount}% Disc</span>` : ''}
        </div>
      </div>
      ${line.note ? `<div class="line-note"><i class="fas fa-comment-alt"></i> "${line.note}"</div>` : ''}
    `;

    el.addEventListener('click', () => onSelectLine(index));
    container.appendChild(el);
  });

  // Auto scroll to bottom / selected
  container.scrollTop = container.scrollHeight;
}

// Render Order Summary Footer & Huge Pay Button
export function renderOrderSummary(order) {
  const subtotalEl = document.getElementById('summary-subtotal');
  const taxesEl = document.getElementById('summary-taxes');
  const totalEl = document.getElementById('summary-total');
  const payBtnBadge = document.getElementById('pay-btn-total-badge');

  if (!order) return;

  let subtotal = 0;
  order.lines.forEach(line => {
    subtotal += line.price * line.quantity * (1 - (line.discount || 0) / 100);
  });

  const taxes = subtotal * 0.10; // 10% VAT
  const total = subtotal + taxes;

  if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
  if (taxesEl) taxesEl.textContent = formatCurrency(taxes);
  if (totalEl) totalEl.textContent = formatCurrency(total);
  if (payBtnBadge) payBtnBadge.textContent = formatCurrency(total);
}

// Render Customer Modal List
export function renderCustomerModalList(customers, activeCustomer, onSelectCustomer) {
  const grid = document.getElementById('customer-modal-grid');
  if (!grid) return;

  grid.innerHTML = '';

  customers.forEach(cust => {
    const card = document.createElement('div');
    card.className = 'customer-card-item';

    const isSelected = activeCustomer && activeCustomer.id === cust.id;

    card.innerHTML = `
      <div>
        <div style="font-weight:600; font-size:14.5px; color:var(--text-main);">
          ${cust.name}
          ${isSelected ? `<span style="background:var(--odoo-teal); color:#fff; font-size:11px; padding:2px 6px; border-radius:4px; margin-left:6px;">Selected</span>` : ''}
        </div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
          <i class="fas fa-map-marker-alt" style="width:14px;"></i> ${cust.address} | ${cust.phone}
        </div>
      </div>
      <div style="text-align:right;">
        <span class="customer-loyalty-pill">${cust.loyaltyPoints || 0} pts</span>
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${cust.tier}</div>
      </div>
    `;

    card.addEventListener('click', () => onSelectCustomer(cust));
    grid.appendChild(card);
  });
}

// Render Thermal Receipt
export function renderThermalReceipt(order, storeInfo) {
  const container = document.getElementById('thermal-receipt-content');
  if (!container || !order) return;

  let subtotal = 0;
  order.lines.forEach(line => {
    subtotal += line.price * line.quantity * (1 - (line.discount || 0) / 100);
  });

  const taxes = subtotal * storeInfo.taxRate;
  const total = subtotal + taxes;
  const tendered = order.tenderedAmount || total;
  const change = Math.max(0, tendered - total);
  const now = new Date();

  container.innerHTML = `
    <div class="receipt-header-text">
      <div class="receipt-store-title">${storeInfo.storeName}</div>
      <div>${storeInfo.companyName}</div>
      <div>${storeInfo.address}</div>
      <div>Tel: ${storeInfo.phone}</div>
      <div style="margin-top:6px; font-weight:600;">VAT: ${storeInfo.taxId}</div>
    </div>

    <div class="receipt-divider"></div>

    <div style="display:flex; justify-content:space-between; font-size:11.5px;">
      <span>Order: <b>${order.name}</b></span>
      <span>Ref: ${storeInfo.sessionName}</span>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:11.5px; margin-top:2px;">
      <span>Cashier: ${storeInfo.cashier}</span>
      <span>${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
    </div>
    ${order.customer ? `<div style="font-size:11.5px; margin-top:2px;">Customer: <b>${order.customer.name}</b> (${order.customer.loyaltyPoints} pts)</div>` : ''}

    <div class="receipt-divider"></div>

    <div style="margin-bottom:8px;">
      ${order.lines.map(line => {
        const itemSubtotal = line.price * line.quantity * (1 - (line.discount || 0) / 100);
        return `
          <div class="receipt-item-row">
            <span>${line.quantity}x ${line.product.name} ${line.discount > 0 ? `(-${line.discount}%)` : ''}</span>
            <span>${formatCurrency(itemSubtotal)}</span>
          </div>
          <div style="font-size:11px; color:#6b7280; margin-top:-4px; margin-bottom:4px;">
            Unit: ${formatCurrency(line.price)}
          </div>
        `;
      }).join('')}
    </div>

    <div class="receipt-divider"></div>

    <div class="receipt-totals-area">
      <div class="summary-row">
        <span>Subtotal (excl. tax):</span>
        <span>${formatCurrency(subtotal)}</span>
      </div>
      <div class="summary-row">
        <span>Taxes (VAT 10%):</span>
        <span>${formatCurrency(taxes)}</span>
      </div>
      <div class="summary-row total" style="font-size:15px; font-weight:700;">
        <span>TOTAL:</span>
        <span>${formatCurrency(total)}</span>
      </div>
      <div class="summary-row" style="margin-top:8px;">
        <span>Paid (${order.paymentMethod || 'Cash'}):</span>
        <span>${formatCurrency(tendered)}</span>
      </div>
      <div class="summary-row">
        <span>Change Returned:</span>
        <span>${formatCurrency(change)}</span>
      </div>
    </div>

    <div class="receipt-barcode-box">
      <div style="font-size:11px; color:#4b5563;">Thank you for shopping with us!</div>
      <div class="receipt-barcode-visual">*POS20260042*</div>
      <div style="font-size:10.5px;">www.odoo.com/pos</div>
    </div>
  `;
}

// Show Toast feedback
export function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('odoo-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'odoo-toast-container';
    toastContainer.className = 'odoo-toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'odoo-toast';
  toast.style.borderLeftColor = type === 'error' ? 'var(--odoo-accent)' : 'var(--odoo-teal)';

  toast.innerHTML = `
    <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}" style="color:${type === 'error' ? 'var(--odoo-accent)' : 'var(--odoo-teal)'}"></i>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 250ms ease';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}
