// ============================================================================
// ODOO 18 INVENTORY & RECIPE BOM CONTROLLER
// ============================================================================

import { RAW_INGREDIENTS, POS_PRODUCTS } from './mockData.js';
import { sounds } from './soundEffects.js';
import { renderInventoryTable, renderBomModal } from './inventoryRenderer.js';
import { showToast } from './uiRenderer.js';

export class InventoryController {
  constructor(posApp) {
    this.posApp = posApp;
    this.ingredients = { ...RAW_INGREDIENTS };
    this.products = POS_PRODUCTS;
    this.filterType = 'ALL';
  }

  setFilter(type) {
    this.filterType = type;
    sounds.playClick();
    this.render();
  }

  adjustStock(ingredientId, delta) {
    if (this.ingredients[ingredientId]) {
      this.ingredients[ingredientId].stock += delta;
      sounds.playClick();
      showToast(`Updated stock for ${this.ingredients[ingredientId].name}: ${this.ingredients[ingredientId].stock} ${this.ingredients[ingredientId].uom}`, 'info');
      this.render();
    }
  }

  inspectBom(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product || !product.bom) {
      showToast('Selected item has no composite BOM recipe.', 'warning');
      return;
    }
    renderBomModal(product, this.ingredients);
  }

  render() {
    renderInventoryTable(this.ingredients, this.products, (id, delta) => this.adjustStock(id, delta), (pId) => this.inspectBom(pId));
  }
}
