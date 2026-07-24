# Development Milestones & Roadmap
## Enterprise Universal Multi-Branch Point of Sale (POS) System

This roadmap breaks down the development of the Enterprise Universal POS System into **7 structured phases**, incorporating Bill of Materials (BOM) Auto-Deduction, Multi-Tax Engine, Strict Cash Sessions (Z-Report), Multi-Tier Pricelists, and Event-Sourcing Synchronization.

---

## 🚩 Milestone 1: Core POS Engine & Odoo 18 Dual-Pane UI Prototype
> **Goal**: Build a high-fidelity, responsive frontend prototype with Cashier Sessions and Multi-Mode Numpad.

- [ ] **Vue 3 + Vite Project Setup**: Configure TypeScript, Pinia state management, and CSS design system.
- [ ] **Dual-Pane Layout**:
  - Left pane: Selected customer, itemized order ticket with tax breakdown, live summary footer.
  - Right pane: Searchable product catalog, horizontal category chips, stock level indicators.
- [ ] **Multi-Mode Numpad Logic**: State transitions for `Qty`, `% Disc`, `Price`, `+/-`, and `Backspace`.
- [ ] **Cash Session Open / Close Modal**: PIN login, Opening Float entry (`opening_balance`), and blind Cash Count for Z-Report shift close.
- [ ] **Concurrent Held Orders & Tables**: Ability to open, switch, and hold active transaction tabs or restaurant table tabs.
- [ ] **Checkout Modal & Split Tender**: Support Cash, Bank/Card Terminal, Customer Credit Account, and change calculation.

---

## 🚩 Milestone 2: Local SQL Storage, Recipe BOM & Tax Engine (SQLite)
> **Goal**: Implement zero-latency local SQL database operations, BOM raw ingredient auto-deduction, and compound tax calculations.

- [ ] **SQLite WASM + OPFS Integration**: Embed official SQLite engine in browser/PWA with disk persistence.
- [ ] **Drizzle ORM Schema Setup**: Create local tables for `NODES`, `POS_CONFIG`, `PRODUCTS`, `PRODUCT_BOM`, `TAX_GROUPS`, `PRODUCT_TAXES`, `PRICELISTS`, `CUSTOMERS`, `CUSTOMER_LEDGER`, `CASH_SESSIONS`, `SALES`, `SALE_ITEMS`, and `SYNC_EVENTS`.
- [ ] **Real-Time Recipe BOM Auto-Deduction Engine**: Automatically deduct raw ingredient quantities from local SQLite `INVENTORY` upon checkout.
- [ ] **Multi-Tax Engine**: Implement Tax-Inclusive vs. Tax-Exclusive logic and compound tax group calculations (`GST`, `VAT`, `Municipal`).
- [ ] **Hardware Interceptors**:
  - Global keystroke listener (<35ms interval) for auto-detecting USB barcode scanners.
  - Thermal receipt printer formatting engine (80mm & 58mm ESC/POS layout with fiscal tax breakdown).
- [ ] **DBeaver Verification**: Verify local `.sqlite` files can be opened and queried directly in DBeaver.

---

## 🚩 Milestone 3: Multi-Industry Verticals (Retail, Restaurant, Services, Wholesale)
> **Goal**: Enable dynamic mode switching via `POS_CONFIG`, multi-tier pricelists, and extensible JSON metadata.

- [ ] **Multi-Tier Pricelist & Promotion Engine**: Apply branch-specific prices, customer group discounts (Retail, VIP 10%, Wholesale), and timed Happy Hour promotions.
- [ ] **Customer Credit & Ledger Account System**: Charge sales to customer credit ledger, enforce credit limits, and record partial balance repayments.
- [ ] **Industry Configuration Engine**: Toggle UI and features based on `pos_mode`:
  - **Retail Mode**: Fast barcode scanning, variant selectors, serial number tracking.
  - **Restaurant / Bar Mode**: Visual floor/table map, KDS order routing (Grill, Bar, Cold Prep), item modifier & flavor pickers.
  - **Services Mode**: Staff assignment and appointment duration inputs.
- [ ] **Supervisor PIN Manager Overrides**: Require supervisor authorization PIN for item line voids, price overrides, cart discount applications, and register float edits.

---

## 🚩 Milestone 4: Backend Server & Regional Database Architecture (PostgreSQL)
> **Goal**: Build the central/intermediate server stack and relational database schemas.

- [ ] **Fastify / Node.js Backend API**: Build lightweight REST & WebSocket server engine.
- [ ] **PostgreSQL Enterprise Server Schema**: Deploy full enterprise database schema on central/intermediate nodes.
- [ ] **Dynamic Node Topology Engine**: API for registering nodes using `parent_node_id` to build dynamic tree hierarchies.
- [ ] **Multi-Branch Analytics & Reporting**: Server endpoints for querying branch sales, inventory totals, BOM raw material usage, and node health.

---

## 🚩 Milestone 5: Event-Sourcing Synchronization Engine (`SYNC_EVENTS`)
> **Goal**: Achieve automatic bi-directional data replication between child nodes and parent servers.

- [ ] **Event Sourcing Recorder**: Capture `INSERT`, `UPDATE`, and `DELETE` deltas in the `SYNC_EVENTS` table.
- [ ] **Real-Time WebSocket Transport**: Establish WebSocket connections between client `SyncEngine` and server `SyncAPI`.
- [ ] **Offline-to-Online Reconnection Handler**: Automatically detect network restoration and push pending local events (sales, BOM ingredient deductions, cash drops) sequentially.
- [ ] **Inventory Conflict Resolution**: Apply delta adjustments (e.g., `qty_change = -X`) to prevent overwrite conflicts during concurrent branch sales.

---

## 🚩 Milestone 6: Cross-Platform Packaging & Peripheral Hardening
> **Goal**: Package the application for Desktop, Mobile, and Web deployment.

- [ ] **Tauri Desktop Build**: Package native desktop executable (~15MB RAM footprint) for Windows, macOS, and Linux terminals.
- [ ] **PWA Deployment Optimization**: Service Worker caching for instant offline app loading.
- [ ] **Cashier Security & PIN Switching**: Fast 4-digit PIN lock screen (`1234`) for cashier shift handovers.
- [ ] **Hardware Bridge Testing**: Verify USB barcode scanners, serial cash drawers, and network thermal printers across Windows & Android/iPadOS.

---

## 🚩 Milestone 7: Multi-Node Simulation & Enterprise Stress Testing
> **Goal**: Validate data consistency and resilience across a simulated multi-city company hierarchy.

- [ ] **Multi-Node Testbed**: Simulate 1 Root Server, 2 Branch Servers, and 6 POS Terminals operating simultaneously.
- [ ] **Network Disruption & BOM Sync Testing**: Force network disconnects on 3 terminals, process 100+ composite item sales (triggering raw ingredient auto-deduction offline), reconnect, and verify 100% data convergence across all database nodes.
- [ ] **Final UAT & Handover**: Complete user acceptance testing.

---

## Roadmap Summary Matrix

| Milestone | Key Deliverable | Tech Stack Component |
| :--- | :--- | :--- |
| **M1: UI & Sessions** | Dual-pane Odoo-like UI, Numpad, & Cash Session Open/Close | Vue 3, Vite, TypeScript |
| **M2: Edge SQL & BOM** | Offline SQLite DB, Recipe BOM Auto-Deduction, & Multi-Tax | SQLite WASM, OPFS, Drizzle ORM |
| **M3: Pricelists & Verticals** | Pricelists, Customer Credit Ledger, Retail/Restaurant/KDS | Vue 3, Extensible JSON Attributes |
| **M4: Server DB** | PostgreSQL & Central Node API | Fastify / Node.js, PostgreSQL |
| **M5: Sync Engine** | Bi-directional `SYNC_EVENTS` replication | WebSockets, Event Sourcing Engine |
| **M6: Packaging** | Desktop & PWA binaries | Tauri, PWA Service Worker |
| **M7: Stress Test** | Hierarchy simulation & network recovery | Node Cluster Testbed |
