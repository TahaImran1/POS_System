// ============================================================================
// ENTERPRISE POS CONTROLLER & STATE MACHINE
// ============================================================================

import { 
  STORE_INFO, 
  TAX_GROUPS, 
  PRICELISTS, 
  POS_CATEGORIES, 
  RAW_INGREDIENTS, 
  POS_PRODUCTS, 
  POS_CUSTOMERS, 
  RESTAURANT_TABLES 
} from './mockData.js';

import { sounds } from './soundEffects.js';
import {
  renderOrderTabs,
  renderCustomerBar,
  renderCategoryChips,
  renderProductGrid,
  renderOrderLines,
  renderOrderSummary,
  renderThermalReceipt,
  renderZReportReceipt,
  formatCurrency,
  showToast
} from './uiRenderer.js';

export class PosController {
  constructor() {
    this.storeInfo = { ...STORE_INFO };
    this.taxGroups = TAX_GROUPS;
    this.pricelists = PRICELISTS;
    this.categories = POS_CATEGORIES;
    this.rawIngredients = { ...RAW_INGREDIENTS };
    this.products = POS_PRODUCTS;
    this.customers = POS_CUSTOMERS;
    this.tables = RESTAURANT_TABLES;

    // Active Pricelist & Tax Setting
    this.activePricelistId = "standard";

    // Cash Register Session State
    this.session = {
      status: "OPEN", // "OPEN" | "CLOSED"
      sessionNumber: "POS/2026/0089",
      openedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      openingBalance: 1000.00,
      cashSalesTotal: 0.00,
      bankSalesTotal: 0.00,
      creditSalesTotal: 0.00,
      cashDrops: []
    };

    // Active Orders (Concurrent & Tables)
    this.orders = [
      {
        id: 1,
        name: "Order 1 (Table 1)",
        tableId: "T1",
        lines: [],
        customer: this.customers[2], // Walk-in
        paymentMethod: "Cash",
        tenderedAmount: 0
      }
    ];
    this.activeOrderIndex = 0;
    this.selectedLineIndex = -1;

    // Numpad state
    this.numpadMode = 'qty'; // 'qty' | 'disc' | 'price'
    this.numpadBuffer = "";

    // Search & Filter
    this.activeCategory = "all";
    this.searchQuery = "";

    // Hardware Scanner Listener
    this.lastKeyTime = 0;
    this.barcodeBuffer = "";
  }

  init() {
    this.bindGlobalEvents();
    this.bindBarcodeScanner();
    this.renderAll();
    
    // Add default initial demo item with BOM
    this.addProductToOrder(this.products[0], false); // Double Bacon Cheeseburger
  }

  getActiveOrder() {
    return this.orders[this.activeOrderIndex];
  }

  getActivePricelist() {
    return this.pricelists.find(p => p.id === this.activePricelistId) || this.pricelists[0];
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

  // --- PRICELIST & CUSTOMER MANAGEMENT ---
  setPricelist(pricelistId) {
    this.activePricelistId = pricelistId;
    const pricelist = this.getActivePricelist();
    showToast(`Pricelist updated: ${pricelist.name}`, 'info');
    this.renderCart();
  }

  setCustomer(customer) {
    const order = this.getActiveOrder();
    order.customer = customer;
    if (customer.pricelistId) {
      this.activePricelistId = customer.pricelistId;
    }
    sounds.playClick();
    showToast(`Attached Customer: ${customer.name}`, 'success');
    this.renderAll();
  }

  // --- PRODUCT SELECTION & BOM AUTO-DEDUCTION ---
  addProductToOrder(product, playSound = true) {
    if (this.session.status === "CLOSED") {
      showToast("Cannot add items. Cash Session is CLOSED! Please Open Session.", "warning");
      return;
    }

    const order = this.getActiveOrder();
    const existingIndex = order.lines.findIndex(line => line.product.id === product.id);

    // Apply pricelist factor
    const factor = this.getActivePricelist().discountFactor;
    const effectivePrice = product.price * factor;

    if (existingIndex >= 0) {
      order.lines[existingIndex].quantity += 1;
      this.selectedLineIndex = existingIndex;
    } else {
      order.lines.push({
        product: product,
        unitPrice: effectivePrice,
        quantity: 1,
        discountPerc: 0,
        taxGroupId: product.taxGroupId || "vat10_inc"
      });
      this.selectedLineIndex = order.lines.length - 1;
    }

    this.numpadBuffer = "";
    if (playSound) sounds.playBeep();
    this.renderCart();
  }

  // --- NUMPAD OPERATIONS ---
  setNumpadMode(mode) {
    this.numpadMode = mode;
    this.numpadBuffer = "";
    sounds.playClick();
    this.renderCart();
  }

  handleNumpadDigit(digit) {
    const order = this.getActiveOrder();
    if (this.selectedLineIndex < 0 || this.selectedLineIndex >= order.lines.length) return;

    const line = order.lines[this.selectedLineIndex];

    if (digit === '+/-') {
      if (this.numpadMode === 'disc') {
        line.discountPerc = line.discountPerc ? 0 : 10;
      } else {
        line.quantity = -line.quantity;
      }
      sounds.playClick();
      this.renderCart();
      return;
    }

    if (digit === '.') {
      if (!this.numpadBuffer.includes('.')) {
        this.numpadBuffer += '.';
      }
    } else {
      this.numpadBuffer += digit;
    }

    const value = parseFloat(this.numpadBuffer) || 0;

    if (this.numpadMode === 'qty') {
      line.quantity = Math.max(1, value);
    } else if (this.numpadMode === 'disc') {
      if (value > 20) {
        // Prompt for Manager PIN on high discounts
        const pin = prompt("Discounts over 20% require Manager PIN (Default: 9999):");
        if (pin !== this.storeInfo.managerPin) {
          showToast("Invalid Manager PIN. Discount rejected.", "warning");
          this.numpadBuffer = "";
          return;
        }
      }
      line.discountPerc = Math.min(100, Math.max(0, value));
    } else if (this.numpadMode === 'price') {
      line.unitPrice = Math.max(0, value);
    }

    sounds.playClick();
    this.renderCart();
  }

  handleNumpadBackspace() {
    const order = this.getActiveOrder();
    if (this.selectedLineIndex < 0 || this.selectedLineIndex >= order.lines.length) return;

    if (this.numpadBuffer.length > 0) {
      this.numpadBuffer = this.numpadBuffer.slice(0, -1);
      const val = parseFloat(this.numpadBuffer) || 0;
      const line = order.lines[this.selectedLineIndex];
      if (this.numpadMode === 'qty') line.quantity = Math.max(1, val);
      else if (this.numpadMode === 'disc') line.discountPerc = val;
      else if (this.numpadMode === 'price') line.unitPrice = val;
    } else {
      // Remove line item
      order.lines.splice(this.selectedLineIndex, 1);
      this.selectedLineIndex = order.lines.length - 1;
    }

    sounds.playClick();
    this.renderCart();
  }

  // --- CHECKOUT & BOM INGREDIENT AUTO-DEDUCTION ---
  processCheckout(paymentMethod, tenderedAmount) {
    const order = this.getActiveOrder();
    if (order.lines.length === 0) {
      showToast("Order ticket is empty!", "warning");
      return;
    }

    // Auto-deduct Recipe Ingredients (BOM)
    const deductedItems = [];
    order.lines.forEach(line => {
      if (line.product.bom) {
        line.product.bom.forEach(bomEntry => {
          const raw = this.rawIngredients[bomEntry.ingredientId];
          if (raw) {
            const consumed = bomEntry.qty * line.quantity;
            raw.stock = Math.max(0, raw.stock - consumed);
            deductedItems.push(`${consumed}${raw.uom} ${raw.name}`);
          }
        });
      }
    });

    // Record financial session totals
    const grandTotal = this.calculateOrderTotals(order).total;
    if (paymentMethod === "Cash") this.session.cashSalesTotal += grandTotal;
    else if (paymentMethod === "Bank") this.session.bankSalesTotal += grandTotal;
    else if (paymentMethod === "Credit") this.session.creditSalesTotal += grandTotal;

    sounds.playSuccess();
    if (deductedItems.length > 0) {
      showToast(`BOM Auto-Deducted: ${deductedItems.join(', ')}`, 'info');
    }
    showToast(`Order Completed via ${paymentMethod}!`, 'success');

    // Show thermal receipt
    renderThermalReceipt(order, paymentMethod, tenderedAmount, this.storeInfo);

    // Clear completed order tab
    order.lines = [];
    this.selectedLineIndex = -1;
    this.renderCart();
  }

  // --- CASH SESSION OPEN / CLOSE (Z-REPORT) ---
  openSession(floatAmount) {
    this.session.status = "OPEN";
    this.session.openingBalance = floatAmount;
    this.session.cashSalesTotal = 0;
    this.session.bankSalesTotal = 0;
    this.session.creditSalesTotal = 0;
    showToast(`Cash Session Opened with ${formatCurrency(floatAmount)} Float`, 'success');
  }

  closeSessionBlindCount(actualCashCounted) {
    const expectedCash = this.session.openingBalance + this.session.cashSalesTotal;
    const variance = actualCashCounted - expectedCash;

    this.session.status = "CLOSED";
    showToast(`Session Closed. Cash Variance: ${formatCurrency(variance)}`, variance === 0 ? 'success' : 'warning');
    
    // Render Z-Report
    renderZReportReceipt(this.session, actualCashCounted, expectedCash, variance, this.storeInfo);
  }

  // --- ORDER TOTALS & TAX ENGINE ---
  calculateOrderTotals(order) {
    let subtotal = 0;
    let taxTotal = 0;

    order.lines.forEach(line => {
      const lineSubtotal = line.unitPrice * line.quantity * (1 - line.discountPerc / 100);
      const taxGroup = TAX_GROUPS.find(t => t.id === line.taxGroupId) || TAX_GROUPS[0];
      
      if (taxGroup.isInclusive) {
        const base = lineSubtotal / (1 + taxGroup.rate);
        const tax = lineSubtotal - base;
        subtotal += base;
        taxTotal += tax;
      } else {
        const tax = lineSubtotal * taxGroup.rate;
        subtotal += lineSubtotal;
        taxTotal += tax;
      }
    });

    return {
      subtotal,
      taxTotal,
      total: subtotal + taxTotal
    };
  }

  // --- SEARCH & FILTER ---
  setCategory(catId) {
    this.activeCategory = catId;
    sounds.playClick();
    this.renderAll();
  }

  filterAndRenderProducts() {
    let filtered = this.products;
    if (this.activeCategory !== 'all') {
      filtered = filtered.filter(p => p.category === this.activeCategory);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.sku.toLowerCase().includes(q));
    }
    renderProductGrid(filtered, (product) => this.addProductToOrder(product));
  }

  // --- HARDWARE BARCODE SCANNER & PHYSICAL KEYBOARD LISTENER ---
  bindBarcodeScanner() {
    window.addEventListener('keydown', (e) => {
      // Ignore if typing inside input text fields or modals
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (document.querySelector('.odoo-modal-overlay[style*="display: flex"]')) return;

      const currentTime = Date.now();
      const char = e.key;

      // Handle physical keyboard shortcuts for instant cart editing
      if (char >= '0' && char <= '9') {
        this.handleNumpadDigit(char);
      } else if (char === '.' || char === ',') {
        this.handleNumpadDigit('.');
      } else if (char === 'Backspace' || char === 'Delete') {
        e.preventDefault();
        this.handleNumpadBackspace();
      } else if (char === '+' || char === '=') {
        e.preventDefault();
        const order = this.getActiveOrder();
        if (this.selectedLineIndex >= 0 && this.selectedLineIndex < order.lines.length) {
          order.lines[this.selectedLineIndex].quantity += 1;
          this.renderCart();
        }
      } else if (char === '-') {
        e.preventDefault();
        const order = this.getActiveOrder();
        if (this.selectedLineIndex >= 0 && this.selectedLineIndex < order.lines.length) {
          if (order.lines[this.selectedLineIndex].quantity > 1) {
            order.lines[this.selectedLineIndex].quantity -= 1;
          } else {
            order.lines.splice(this.selectedLineIndex, 1);
            this.selectedLineIndex = order.lines.length - 1;
          }
          this.renderCart();
        }
      }

      // Barcode Scanner Timing Interceptor
      if (currentTime - this.lastKeyTime > 35) {
        this.barcodeBuffer = "";
      }
      this.lastKeyTime = currentTime;

      if (char === 'Enter') {
        if (this.barcodeBuffer.length >= 3) {
          const match = this.products.find(p => p.barcode === this.barcodeBuffer || p.sku === this.barcodeBuffer);
          if (match) {
            this.addProductToOrder(match);
            showToast(`Scanned Barcode: ${match.name}`, 'success');
          }
        }
        this.barcodeBuffer = "";
      } else if (char.length === 1 && char >= '0' && char <= '9') {
        this.barcodeBuffer += char;
      }
    });
  }

  bindGlobalEvents() {
    const searchInput = document.getElementById('catalog-search-input') || document.getElementById('search-products');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.filterAndRenderProducts();
      });
    }

    const demoBtn = document.getElementById('btn-demo-barcode');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        const match = this.products.find(p => p.barcode === '8801001' || p.id === 'PROD_BURGER');
        if (match) {
          this.addProductToOrder(match);
          showToast(`Simulated Barcode Scan: ${match.name}`, 'success');
        } else if (this.products.length > 0) {
          this.addProductToOrder(this.products[0]);
          showToast(`Simulated Barcode Scan: ${this.products[0].name}`, 'success');
        }
      });
    }
  }

  switchOrderTab(idx) {
    this.activeOrderIndex = idx;
    this.selectedLineIndex = this.orders[idx].lines.length - 1;
    this.renderAll();
  }

  createNewOrder() {
    const id = this.orders.length + 1;
    this.orders.push({
      id: id,
      name: `Order ${id}`,
      tableId: `T${id}`,
      lines: [],
      customer: this.customers[2],
      paymentMethod: "Cash",
      tenderedAmount: 0
    });
    this.activeOrderIndex = this.orders.length - 1;
    this.renderAll();
  }

  selectLine(idx) {
    this.selectedLineIndex = idx;
    this.numpadBuffer = "";
    this.renderCart();
  }
}
