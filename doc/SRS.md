# Software Requirements Specification (SRS)
## Enterprise Universal Multi-Branch Point of Sale (POS) System

**Document Version:** 3.0.0  
**Status:** Approved Enterprise Specification  

---

## 1. Executive Summary & Purpose

This document provides the complete, production-grade Software Requirements Specification (SRS) for the **Enterprise Universal Point of Sale (POS) System**. Built upon a dynamic N-tier SQL architecture (SQLite on Edge Terminals, PostgreSQL on Regional/Root Servers), this system provides an all-in-one retail, restaurant/HORECA, service, and wholesale solution with offline-first capabilities, real-time Bill of Materials (BOM) inventory consumption, multi-tax calculation, strict cash register session controls, and multi-tier pricing.

---

## 2. Comprehensive Domain Requirements

### 2.1 Bill of Materials (BOM) & Recipe Inventory Engine
- **FR-1.1 Composite Product Definition**: The system shall allow defining composite products (e.g. "Cheeseburger", "Cocktail", "Custom Furniture") linked to a Bill of Materials (`PRODUCT_BOM`). Each BOM entry specifies the child raw material (`ingredient_product_id`), quantity required, and unit of measure (UOM).
- **FR-1.2 Master Inventory & Local Auto-Deduction**: The Master DB is the authoritative source for inventory stocking. Edge terminals download the inventory state. Upon completing a sale, the POS terminal instantly deducts raw ingredient quantities from its local SQLite `INVENTORY` table.
- **FR-1.3 Waste & Production Adjustments**: Managers must be able to log inventory adjustments for raw material spoilage, expiration, or kitchen waste with audit notes.
- **FR-1.4 Low Stock & Reorder Triggers**: The system shall monitor raw material levels against configurable minimum thresholds (`min_stock_alert`), generating automated reorder requisitions to parent supply nodes.
- **FR-1.5 Inventory Tally & Sync**: The local sales and inventory deductions are synced and tallied with the Master DB to track exactly how much inventory was used, preventing data loss or duplication.

### 2.2 Multi-Tax & Fiscal Engine
- **FR-2.1 Tax-Inclusive & Tax-Exclusive Pricing**: Products can be configured as Tax-Inclusive (retail price includes tax) or Tax-Exclusive (tax added at cart checkout).
- **FR-2.2 Multi-Jurisdiction & Branch Tax Rules**: Each branch node (`NODES`) can map to specific `TAX_GROUPS` (e.g., State GST 9% + Central GST 9%, Municipal Hospitality Tax 2%, VAT 15%).
- **FR-2.3 Compound Tax Calculation**: Support sequence-based compound tax calculations (e.g. Tax B calculated on `Subtotal + Tax A`).
- **FR-2.4 Fiscal Receipts**: Print itemized tax breakdown on customer receipts with store Tax ID / VAT Registration numbers.

### 2.3 Strict Cash Register Session Management & Auditing
- **FR-3.1 Session Lifecycle Enforcement**: A terminal cannot process sales until a cashier opens a formal `CASH_SESSION` by entering their PIN and verifying the Opening Cash Float (`opening_balance`).
- **FR-3.2 Mid-Shift Cash Drops & Paid-Outs**: Cashiers and managers can log mid-shift cash transfers (e.g., safe drops or petty cash expenses) with mandatory reason codes.
- **FR-3.3 Blind Count & Shift Reconciliation**: Upon session close, the cashier performs a "Blind Cash Count" without seeing expected totals. The system compares actual cash counted against calculated totals (`Opening + Cash Sales + Cash In - Cash Out`) to report variances.
- **FR-3.4 Z-Report & X-Report Generation**: 
  - **X-Report**: Mid-shift snapshot of current register totals for audit.
  - **Z-Report**: End-of-day final register lock and financial summary printout.

### 2.4 Branch Pricelists & Promotions (Customer features deferred to a later stage)
- **FR-4.1 Branch & Regional Pricelists**: Support custom price overrides per branch location or geographic region.
- **FR-4.2 Timed Promotions & Rules**: Configurable promotion rules including Happy Hour timed discounts, Buy-X-Get-Y (BOGO), basket subtotal discounts, and coupon code redemptions.
*(Note: Customer tier pricing and credit ledgers are deferred to a later development stage).*

### 2.5 Kitchen Display System (KDS) & Order Production Workflow
- **FR-5.1 Order Routing**: Line items tagged for kitchen preparation are routed instantly to specific KDS screens (e.g. Grill Station, Bar, Cold Prep) or kitchen thermal printers.
- **FR-5.2 Table & Seat Management**: Visual floor map with real-time table status (Free, Occupied, Bill Requested), seat-level ordering, and table transfer capabilities.
- **FR-5.3 Item Modifiers & Preparation Notes**: Support item modifiers (e.g., "Extra Cheese +$1.00", "No Onions", "Medium Rare") attached to specific line items.

### 2.6 Manager Overrides & RBAC Authorization
- **FR-6.1 Role-Based Permissions**: Granular permissions for Cashier, Kitchen Staff, Floor Supervisor, Store Manager, and System Admin.
- **FR-6.2 Supervisor PIN Authorizations**: Require a manager PIN prompt for restricted operations: item line voiding, price overrides, cart discount applications, register opening float adjustments, and order refunds.

---

## 3. Distributed Architecture & Synchronization Requirements

### 3.1 Dynamic N-Tier SQL Hierarchy
- **Leaf Nodes (Edge POS)**: Run SQLite with WASM + OPFS persistence for zero-latency offline operations.
- **Parent Nodes (Branch, City, Regional, Root)**: Run PostgreSQL databases accessible via standard SQL management tools (DBeaver, DataGrip).

### 3.2 Asynchronous Event-Sourcing Replication (`SYNC_EVENTS`)
- Every transactional mutation writes a delta record to `SYNC_EVENTS`.
- Bi-directional WebSockets transport automatically pushes local offline sales and raw ingredient deductions to parent nodes upon network restoration.
- Conflict resolution uses delta arithmetic (`quantity_change = -X`) for inventory counters.

---

## 4. Non-Functional Requirements (NFRs)

| ID | Category | Requirement |
| :--- | :--- | :--- |
| **NFR-1** | **Performance** | Keypad entry, barcode scanning, and cart rendering must execute in **<16ms** (60 FPS). Local SQLite queries must return in **<50ms**. |
| **NFR-2** | **Offline Autonomy** | Terminals must operate indefinitely offline, maintaining full local inventory, BOM auto-deduction, and cash session controls. |
| **NFR-3** | **Financial Integrity** | Currency arithmetic must use fixed-point / cent-based integer representation to prevent floating-point rounding errors. |
| **NFR-4** | **Data Accessibility** | Both SQLite `.sqlite` files and PostgreSQL databases must remain 100% compliant with standard SQL tools (DBeaver, DataGrip). |
