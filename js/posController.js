// ============================================================================
// ODOO POS CONTROLLER & STATE MACHINE
// ============================================================================

import { STORE_INFO, POS_CATEGORIES, POS_PRODUCTS, POS_CUSTOMERS } from './mockData.js';
import { sounds } from './soundEffects.js';
import {
  renderOrderTabs,
  renderCustomerBar,
  renderCategoryChips,
  renderProductGrid,
  renderOrderLines,
  renderOrderSummary,
  renderCustomerModalList,
  renderThermalReceipt,
  formatCurrency,
  showToast
} from './uiRenderer.js';

export class PosController {
  constructor() {
    this.storeInfo = { ...STORE_INFO };
    this.categories = POS_CATEGORIES;
    this.products = POS_PRODUCTS;
    this.customers = POS_CUSTOMERS;

    // Concurrent orders state
    this.orders = [
      {
        id: 1,
        name: "Order 1",
        lines: [],
        customer: null,
        paymentMethod: "Cash",
        tenderedAmount: 0,
        note: ""
      }
    ];
    this.activeOrderIndex = 0;
    this.selectedLineIndex = -1;

    // Numpad state
    this.numpadMode = 'qty'; // 'qty' | 'disc' | 'price'
    this.numpadBuffer = ""; // stores string digits while typing

    // Catalog search & filter state
    this.activeCategory = "all";
    this.searchQuery = "";

    // Payment state
    this.paymentMethod = "Cash";
    this.tenderedAmount = 0;
    this.invoiceRequested = false;

    // Cash Control state
    this.cashSales = 0;
  }

  init() {
    this.bindEvents();
    this.renderAll();
    // Default select first product demo line for immediate wow factor
    this.addProductToOrder(this.products[0], false);
    this.addProductToOrder(this.products[10], false); // Espresso
  }

  getActiveOrder() {
    return this.orders[this.activeOrderIndex];
  }

  renderAll() {
    renderOrderTabs(this.orders, this.activeOrderIndex, (idx) => this.switchOrderTab(idx), () => this.createNewOrder());
    renderCustomerBar(this.getActiveOrder().customer, () => this.openCustomerModal());
    renderCategoryChips(this.categories, this.activeCategory, (catId) => this.setCategory(catId));
    this.filterAndRenderProducts();
    this.renderCart();
  }

  renderCart() {
    const order = this.getActiveOrder();
    renderOrderLines(order, this.selectedLineIndex, (idx) => this.selectLine(idx));
    renderOrderSummary(order);
  }

  // --- CONCURRENT ORDERS MANAGEMENT ---
  switchOrderTab(index) {
    if (index >= 0 && index < this.orders.length) {
      this.activeOrderIndex = index;
      this.selectedLineIndex = this.getActiveOrder().lines.length - 1;
      this.numpadBuffer = "";
      sounds.playClick();
      this.renderAll();
    }
  }

  createNewOrder() {
    const newId = this.orders.length + 1;
    this.orders.push({
      id: newId,
      name: `Order ${newId}`,
      lines: [],
      customer: null,
      paymentMethod: "Cash",
      tenderedAmount: 0,
      note: ""
    });
    this.switchOrderTab(this.orders.length - 1);
    showToast(`Started ${this.getActiveOrder().name}`, 'success');
  }

  // --- CATALOG SEARCH & FILTERING ---
  setCategory(categoryId) {
    this.activeCategory = categoryId;
    sounds.playClick();
    renderCategoryChips(this.categories, this.activeCategory, (catId) => this.setCategory(catId));
    this.filterAndRenderProducts();
  }

  handleSearch(query) {
    this.searchQuery = query.trim().toLowerCase();
    this.filterAndRenderProducts();
  }

  filterAndRenderProducts() {
    let filtered = this.products;

    if (this.activeCategory !== "all") {
      filtered = filtered.filter(p => p.category === this.activeCategory);
    }

    if (this.searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(this.searchQuery) ||
        p.sku.toLowerCase().includes(this.searchQuery) ||
        p.barcode.includes(this.searchQuery)
      );
    }

    renderProductGrid(filtered, (product) => this.addProductToOrder(product, true));
  }

  // --- ORDER LINE MANAGEMENT ---
  addProductToOrder(product, playSound = true) {
    const order = this.getActiveOrder();

    // Check if product already exists in lines
    const existingIndex = order.lines.findIndex(l => l.product.id === product.id && !l.note);

    if (existingIndex !== -1) {
      order.lines[existingIndex].quantity += 1;
      this.selectedLineIndex = existingIndex;
    } else {
      order.lines.push({
        product: product,
        quantity: 1,
        price: product.price,
        discount: 0,
        note: ""
      });
      this.selectedLineIndex = order.lines.length - 1;
    }

    if (playSound) {
      sounds.playBeep();
    }

    this.numpadBuffer = "";
    this.renderAll();
  }

  selectLine(index) {
    this.selectedLineIndex = index;
    this.numpadBuffer = "";
    sounds.playClick();
    this.renderCart();
  }

  // --- EXACT ODOO NUMPAD & MODES ENGINE ---
  setNumpadMode(mode) {
    this.numpadMode = mode;
    this.numpadBuffer = "";
    sounds.playClick();

    // Update active mode UI styles
    document.querySelectorAll('.numpad-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });
  }

  handleNumpadInput(val) {
    const order = this.getActiveOrder();
    if (order.lines.length === 0 || this.selectedLineIndex === -1) {
      sounds.playError();
      showToast("Please select or add a product line first", 'error');
      return;
    }

    const currentLine = order.lines[this.selectedLineIndex];

    if (val === 'backspace') {
      sounds.playClick();
      if (this.numpadBuffer.length > 0) {
        this.numpadBuffer = this.numpadBuffer.slice(0, -1);
      } else {
        // If buffer empty, remove item or drop by 1
        if (currentLine.quantity > 1) {
          currentLine.quantity -= 1;
        } else {
          order.lines.splice(this.selectedLineIndex, 1);
          this.selectedLineIndex = order.lines.length - 1;
        }
        this.renderAll();
        return;
      }
    } else if (val === '+/-') {
      sounds.playClick();
      currentLine.quantity *= -1;
      this.renderCart();
      return;
    } else {
      sounds.playClick();
      this.numpadBuffer += val;
    }

    const parsedVal = parseFloat(this.numpadBuffer);
    if (isNaN(parsedVal)) {
      this.renderCart();
      return;
    }

    if (this.numpadMode === 'qty') {
      currentLine.quantity = parsedVal;
    } else if (this.numpadMode === 'disc') {
      currentLine.discount = Math.min(100, Math.max(0, parsedVal));
    } else if (this.numpadMode === 'price') {
      currentLine.price = parsedVal;
    }

    this.renderCart();
  }

  // --- ACTION BUTTONS (Customer, Note, Refund, Info) ---
  handleNoteAction() {
    const order = this.getActiveOrder();
    if (this.selectedLineIndex === -1 || !order.lines[this.selectedLineIndex]) {
      showToast("Select a line item to attach a note", 'error');
      return;
    }
    const currentLine = order.lines[this.selectedLineIndex];
    const noteInput = prompt("Enter kitchen/internal note for line item:", currentLine.note || "");
    if (noteInput !== null) {
      currentLine.note = noteInput.trim();
      sounds.playClick();
      this.renderCart();
    }
  }

  handleRefundAction() {
    const order = this.getActiveOrder();
    if (this.selectedLineIndex === -1 || !order.lines[this.selectedLineIndex]) {
      showToast("Select an item to refund", 'error');
      return;
    }
    const currentLine = order.lines[this.selectedLineIndex];
    currentLine.quantity = -Math.abs(currentLine.quantity);
    sounds.playClick();
    this.renderCart();
    showToast("Switched line to refund mode (-qty)", 'success');
  }

  handleInfoAction() {
    const order = this.getActiveOrder();
    if (this.selectedLineIndex === -1 || !order.lines[this.selectedLineIndex]) {
      showToast("Select an item to view details", 'error');
      return;
    }
    const item = order.lines[this.selectedLineIndex].product;
    this.openProductDetailsModal(item);
  }

  // --- DEMO BARCODE SCANNER SIMULATION ---
  simulateBarcodeScan() {
    const randomProduct = this.products[Math.floor(Math.random() * this.products.length)];
    this.addProductToOrder(randomProduct, true);
    showToast(`Scanned SKU ${randomProduct.barcode}: ${randomProduct.name}`, 'success');
  }

  // --- CUSTOMER MODAL MANAGEMENT ---
  openCustomerModal() {
    sounds.playClick();
    const modalOverlay = document.getElementById('customer-modal-overlay');
    const searchInput = document.getElementById('customer-search-input');
    if (modalOverlay) {
      modalOverlay.classList.add('active');
      renderCustomerModalList(this.customers, this.getActiveOrder().customer, (cust) => this.selectCustomer(cust));
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
    }
  }

  closeCustomerModal() {
    const modalOverlay = document.getElementById('customer-modal-overlay');
    if (modalOverlay) modalOverlay.classList.remove('active');
  }

  selectCustomer(customer) {
    this.getActiveOrder().customer = customer;
    sounds.playClick();
    this.closeCustomerModal();
    this.renderAll();
    showToast(`Assigned customer: ${customer.name}`, 'success');
  }

  filterCustomerModal(query) {
    const q = query.trim().toLowerCase();
    const filtered = this.customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
    renderCustomerModalList(filtered, this.getActiveOrder().customer, (cust) => this.selectCustomer(cust));
  }

  // --- PRODUCT DETAILS MODAL ---
  openProductDetailsModal(product) {
    const modalOverlay = document.getElementById('product-info-modal-overlay');
    const content = document.getElementById('product-info-modal-content');
    if (!modalOverlay || !content) return;

    content.innerHTML = `
      <div style="display:flex; gap:20px; align-items:center;">
        <div style="width:140px; height:140px; background:var(--bg-surface-subtle); border-radius:12px; display:flex; align-items:center; justify-content:center;">
          <img src="${product.image}" alt="${product.name}" style="max-width:110px; max-height:110px;" />
        </div>
        <div>
          <div style="font-family:var(--font-heading); font-size:18px; font-weight:700;">${product.name}</div>
          <div style="font-family:var(--font-mono); font-size:13px; color:var(--text-muted); margin:4px 0;">SKU: ${product.sku} | Barcode: ${product.barcode}</div>
          <div style="font-size:20px; font-weight:700; color:var(--odoo-teal); margin-top:8px;">${formatCurrency(product.price)}</div>
          <div style="font-size:13px; color:var(--text-muted); margin-top:8px;">${product.description}</div>
          <div style="margin-top:12px; display:inline-block; padding:4px 10px; border-radius:6px; background:var(--odoo-teal-light); color:var(--odoo-teal); font-weight:600; font-size:12px;">
            Stock Available: ${product.stock} units
          </div>
        </div>
      </div>
    `;

    modalOverlay.classList.add('active');
  }

  closeProductDetailsModal() {
    const modalOverlay = document.getElementById('product-info-modal-overlay');
    if (modalOverlay) modalOverlay.classList.remove('active');
  }

  // --- SCREEN SWITCHING & PAYMENT WORKFLOW ---
  switchScreen(screenId) {
    document.querySelectorAll('.pos-screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
  }

  goToPaymentScreen() {
    const order = this.getActiveOrder();
    if (order.lines.length === 0) {
      sounds.playError();
      showToast("Order is empty! Please add products before payment.", 'error');
      return;
    }

    sounds.playClick();
    let total = this.calculateOrderTotal(order);
    this.tenderedAmount = total; // default exact tender
    order.tenderedAmount = total;
    order.paymentMethod = this.paymentMethod;

    this.updatePaymentScreenUI();
    this.switchScreen('screen-payment');
  }

  calculateOrderTotal(order) {
    let subtotal = 0;
    order.lines.forEach(line => {
      subtotal += line.price * line.quantity * (1 - (line.discount || 0) / 100);
    });
    return subtotal * 1.10; // +10% VAT
  }

  setPaymentMethod(methodName) {
    this.paymentMethod = methodName;
    this.getActiveOrder().paymentMethod = methodName;
    sounds.playClick();

    document.querySelectorAll('.payment-method-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-method') === methodName);
    });
    this.updatePaymentScreenUI();
  }

  addQuickTender(amount) {
    sounds.playClick();
    if (amount === 'exact') {
      this.tenderedAmount = this.calculateOrderTotal(this.getActiveOrder());
    } else {
      this.tenderedAmount += amount;
    }
    this.getActiveOrder().tenderedAmount = this.tenderedAmount;
    this.updatePaymentScreenUI();
  }

  handlePaymentNumpad(char) {
    sounds.playClick();
    let str = this.tenderedAmount.toString();

    if (char === 'backspace') {
      str = str.slice(0, -1) || "0";
    } else {
      if (str === "0") str = char;
      else str += char;
    }

    this.tenderedAmount = parseFloat(str) || 0;
    this.getActiveOrder().tenderedAmount = this.tenderedAmount;
    this.updatePaymentScreenUI();
  }

  updatePaymentScreenUI() {
    const order = this.getActiveOrder();
    const total = this.calculateOrderTotal(order);
    const change = Math.max(0, this.tenderedAmount - total);

    const totalEl = document.getElementById('pay-screen-total');
    const tenderedEl = document.getElementById('pay-screen-tendered');
    const changeEl = document.getElementById('pay-screen-change');
    const validateBtn = document.getElementById('btn-validate-order');

    if (totalEl) totalEl.textContent = formatCurrency(total);
    if (tenderedEl) tenderedEl.textContent = formatCurrency(this.tenderedAmount);
    if (changeEl) changeEl.textContent = formatCurrency(change);

    if (validateBtn) {
      // Odoo POS allows validation when tendered >= total (or customer credit)
      const canValidate = this.tenderedAmount >= total - 0.001 || this.paymentMethod === 'Customer Account';
      validateBtn.disabled = !canValidate;
    }
  }

  validateAndPrintReceipt() {
    const order = this.getActiveOrder();
    const total = this.calculateOrderTotal(order);

    sounds.playSuccess();
    this.cashSales += total;

    renderThermalReceipt(order, this.storeInfo);
    this.switchScreen('screen-receipt');
  }

  startNextOrder() {
    sounds.playClick();
    // Clear current order lines
    const order = this.getActiveOrder();
    order.lines = [];
    order.customer = null;
    order.note = "";
    this.selectedLineIndex = -1;

    this.switchScreen('screen-order');
    this.renderAll();
    showToast("Ready for next order!", 'success');
  }

  // --- SESSION & CASH CONTROL MODAL ---
  openCashControlModal() {
    sounds.playClick();
    const modalOverlay = document.getElementById('cash-control-modal-overlay');
    if (!modalOverlay) return;

    const openBalEl = document.getElementById('cash-open-balance');
    const salesEl = document.getElementById('cash-sales-total');
    const expectedEl = document.getElementById('cash-expected-total');
    const actualInput = document.getElementById('cash-actual-input');
    const diffEl = document.getElementById('cash-diff-display');

    const expected = this.storeInfo.openingBalance + this.cashSales;

    if (openBalEl) openBalEl.textContent = formatCurrency(this.storeInfo.openingBalance);
    if (salesEl) salesEl.textContent = formatCurrency(this.cashSales);
    if (expectedEl) expectedEl.textContent = formatCurrency(expected);
    if (actualInput) actualInput.value = expected.toFixed(2);
    if (diffEl) diffEl.textContent = "$0.00";

    modalOverlay.classList.add('active');
  }

  closeCashControlModal() {
    const modalOverlay = document.getElementById('cash-control-modal-overlay');
    if (modalOverlay) modalOverlay.classList.remove('active');
  }

  // --- THEME TOGGLE (LIGHT / DARK) ---
  toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    sounds.playClick();
    showToast(`Switched to ${newTheme.toUpperCase()} mode`, 'success');
  }

  // --- EVENT LISTENERS BINDING ---
  bindEvents() {
    // Search bar
    const searchInput = document.getElementById('catalog-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Barcode scan demo button
    const barcodeBtn = document.getElementById('btn-demo-barcode');
    if (barcodeBtn) {
      barcodeBtn.addEventListener('click', () => this.simulateBarcodeScan());
    }

    // Numpad Mode Buttons
    document.querySelectorAll('.numpad-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setNumpadMode(btn.getAttribute('data-mode')));
    });

    // Numpad Digit / Backspace Buttons
    document.querySelectorAll('.numpad-digit-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handleNumpadInput(btn.getAttribute('data-val')));
    });

    // Action bar buttons
    const btnNote = document.getElementById('btn-action-note');
    const btnRefund = document.getElementById('btn-action-refund');
    const btnInfo = document.getElementById('btn-action-info');
    const btnCustomer = document.getElementById('btn-action-customer');

    if (btnNote) btnNote.addEventListener('click', () => this.handleNoteAction());
    if (btnRefund) btnRefund.addEventListener('click', () => this.handleRefundAction());
    if (btnInfo) btnInfo.addEventListener('click', () => this.handleInfoAction());
    if (btnCustomer) btnCustomer.addEventListener('click', () => this.openCustomerModal());

    // Big Payment Button
    const btnPay = document.getElementById('btn-pay-huge');
    if (btnPay) btnPay.addEventListener('click', () => this.goToPaymentScreen());

    // Payment screen back button
    const btnBackOrder = document.getElementById('btn-back-to-order');
    if (btnBackOrder) btnBackOrder.addEventListener('click', () => {
      sounds.playClick();
      this.switchScreen('screen-order');
    });

    // Payment methods
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setPaymentMethod(btn.getAttribute('data-method')));
    });

    // Payment quick cash
    document.querySelectorAll('.btn-quick-cash').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-amount');
        this.addQuickTender(val === 'exact' ? 'exact' : parseFloat(val));
      });
    });

    // Payment Numpad
    document.querySelectorAll('.pay-numpad-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handlePaymentNumpad(btn.getAttribute('data-val')));
    });

    // Validate Order button
    const btnValidate = document.getElementById('btn-validate-order');
    if (btnValidate) btnValidate.addEventListener('click', () => this.validateAndPrintReceipt());

    // Receipt screen buttons
    const btnNext = document.getElementById('btn-next-order');
    if (btnNext) btnNext.addEventListener('click', () => this.startNextOrder());

    const btnPrint = document.getElementById('btn-print-receipt');
    if (btnPrint) btnPrint.addEventListener('click', () => {
      sounds.playClick();
      window.print();
    });

    // Topbar actions
    const btnCloseSession = document.getElementById('btn-close-session');
    if (btnCloseSession) btnCloseSession.addEventListener('click', () => this.openCashControlModal());

    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    if (btnThemeToggle) btnThemeToggle.addEventListener('click', () => this.toggleDarkMode());

    // Modal close buttons
    document.querySelectorAll('.btn-modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        sounds.playClick();
        this.closeCustomerModal();
        this.closeProductDetailsModal();
        this.closeCashControlModal();
      });
    });

    // Customer search inside modal
    const custSearch = document.getElementById('customer-search-input');
    if (custSearch) {
      custSearch.addEventListener('input', (e) => this.filterCustomerModal(e.target.value));
    }

    // Keyboard shortcuts support (Odoo POS hotkeys)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeCustomerModal();
        this.closeProductDetailsModal();
        this.closeCashControlModal();
      }
    });
  }
}
