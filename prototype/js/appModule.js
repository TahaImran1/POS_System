// ============================================================================
// ODOO 18 ENTERPRISE MULTI-MODULE APPLICATION LAUNCHER
// ============================================================================

import { PosController } from './posController.js';
import { KdsController } from './kdsController.js';
import { TableMapController } from './tableMapController.js';
import { InventoryController } from './inventoryController.js';
import { sounds } from './soundEffects.js';

export class AppModule {
  constructor() {
    this.posApp = new PosController();
    this.kdsApp = new KdsController(this.posApp);
    this.tableMapApp = new TableMapController(this.posApp);
    this.inventoryApp = new InventoryController(this.posApp);
    this.activeView = 'pos'; // 'pos', 'kds', 'tables', 'inventory'
  }

  init() {
    console.log('🚀 Launching Odoo 18 Enterprise POS System Application...');

    // Initialize POS
    this.posApp.init();
    window.posApp = this.posApp;
    window.kdsApp = this.kdsApp;
    window.inventoryApp = this.inventoryApp;

    // Bind Module Switcher Navigation
    this.bindNavigation();
  }

  bindNavigation() {
    document.querySelectorAll('.app-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        this.switchView(view);
      });
    });
  }

  switchView(viewName) {
    this.activeView = viewName;
    sounds.playClick();

    // Update nav tabs UI
    document.querySelectorAll('.app-nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewName);
    });

    // Update screen visibility
    document.querySelectorAll('.app-view-screen').forEach(screen => {
      if (screen.id === `view-${viewName}-screen`) {
        screen.style.display = 'flex';
        screen.classList.add('active');
      } else {
        screen.style.display = 'none';
        screen.classList.remove('active');
      }
    });

    // Trigger module render
    if (viewName === 'pos') {
      this.posApp.renderAll();
    } else if (viewName === 'kds') {
      this.kdsApp.render();
    } else if (viewName === 'tables') {
      this.tableMapApp.render();
    } else if (viewName === 'inventory') {
      this.inventoryApp.render();
    }
  }
}
