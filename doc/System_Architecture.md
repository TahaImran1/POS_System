# Universal Edge-Node Hybrid Architecture & Sync Engine Specification

## 1. Executive Architecture Overview

The system operates on a **Distributed Universal Edge-Node Architecture**. Instead of maintaining distinct applications for "Client POS" vs "Branch Server" vs "Enterprise HQ", a **single unified application codebase** runs across all deployment environments. The operational behavior of any given instance is governed strictly by its **Node Role Configuration**.

```
+-------------------------------------------------------------------------------+
|                       Level 0: Grandparent / HQ Server                        |
|                  [ HQ Master Node - PostgreSQL / Oracle DB ]                  |
+-------------------------------------------------------------------------------+
                                      ^
                                      | (Direct DB Access via Restricted Sync User)
         +----------------------------+----------------------------+
         |                                                         |
+---------------------------------+       +---------------------------------+
|   Level 1: Branch Server #1     |       |   Level 1: Branch Server #2     |
| [ Branch Server - PostgreSQL ]  |       | [ Branch Server - PostgreSQL ]  |
+---------------------------------+       +---------------------------------+
                 ^                                         ^
                 | (Direct DB Access)                      | (Direct DB Access)
   +-------------+-------------+             +-------------+
   |                           |             |
+-------------------+ +-------------------+ +-------------------+ +-------------------+
|  Level 2: POS #1  | |  Level 2: POS #2  | |  Level 2: POS #3  | |  Standalone POS   |
| [ SQLite Edge ]   | | [ SQLite Edge ]   | | [ SQLite Edge ]   | | [ Local SQLite ]  |
+-------------------+ +-------------------+ +-------------------+ +-------------------+
          |                                                             (No Server)
          + - - - - - (Direct DB Connection Failover to HQ DB) - - - - -> HQ Server DB
```

---

## 2. Desktop Runtime Architecture (Electron Container)

To deliver a dedicated, clean desktop experience without running inside a web browser tab, the application is packaged using **Electron Framework**:

```
+-------------------------------------------------------------------------------+
|                           ELECTRON DESKTOP APPLICATION                        |
|                                                                               |
|  +-----------------------------------+     +-------------------------------+  |
|  |     RENDERER PROCESS (UI)         |     |     MAIN PROCESS (Node.js)    |  |
|  |  Vue 3 + Vite + TailwindCSS       |     |  Native Node.js Runtime       |  |
|  |  Pinia Stores + Vue Router        |     |  Electron BrowserWindow       |  |
|  +-----------------------------------+     +-------------------------------+  |
|                    |                                       |                  |
|                    +====== IPC Bridge (contextBridge) =====+                  |
|                                                            |                  |
|                                                            v                  |
|                                            +-------------------------------+  |
|                                            |  Local DB: better-sqlite3     |  |
|                                            |  Remote DB: pg (PostgreSQL)   |  |
|                                            |  ESC/POS Printer & Hardware   |  |
|                                            +-------------------------------+  |
+-------------------------------------------------------------------------------+
```

### Key Advantages of Electron Deployment:
1. **Dedicated Native Window**: Runs in a standalone desktop window (frameless or full-screen kiosk mode) with zero browser address bars, tabs, or standard browser chrome.
2. **Native Node.js Access**: The Electron Main Process executes `better-sqlite3` and `pg` database drivers natively at native C++ speed, bypassing browser storage/OPFS limitations.
3. **Hardware & Peripheral Integration**: Direct access to USB thermal receipt printers (ESC/POS), COM serial ports, barcode scanners, and cash drawers without browser security prompts.

---

## 3. Universal Node Roles

Every application instance maintains a `node_config` stored in its local configuration store/database:

| Node Role | Database Engine | Upstream Parent Node | Downstream Ingestion? | Manager Operations Allowed? | Typical Deployment Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Standalone POS** | Local SQLite (`better-sqlite3`) | `None` (Self-contained) | No | Yes (Acts as local master) | Single store / Independent terminal |
| **Terminal POS (Leaf)** | Local SQLite (`better-sqlite3`) | Branch Server DB | No | Cashier Sales & Shift Ops | Counter checkout terminal |
| **Branch Server** | PostgreSQL / Local Server DB | Enterprise HQ Server DB | Yes (from Branch POS nodes) | Yes (Branch inventory/prices) | Local back-office PC |
| **Enterprise HQ Server** | PostgreSQL / Oracle DB | `None` (Top Level) | Yes (from Branch Servers/POS) | Yes (Enterprise Global Mgmt) | Cloud VPS / Central Server |

---

## 4. Direct Database Sync Mechanism (DBeaver Connection Style)

To eliminate intermediate Web API layers, API contract breaking, and complex routing issues across Mikrotik/Multi-WAN networks, **sync is executed via Direct Database Connections**. 

Lower nodes are configured with higher node database credentials (Host, Port, DB Name, Username, Password) identical to database management software (e.g. DBeaver).

```
PHASE 1: DIRECT DB PULL (Downstream Catalog & Inventory Sync)
========================================================================================
[ POS Electron Main Process ] --- (1. Connects to Remote Postgres DB via Host:Port) ---> [ Server PostgreSQL DB ]
                              <--- (2. SELECT * FROM master_products WHERE updated_at > X) ---
                              ---> [ Inserts/Updates into Local SQLite DB ]

PHASE 2: DIRECT DB PUSH (Upstream Sales & Stock Logs Sync)
========================================================================================
[ POS Electron Main Process ] ---> [ SELECT * FROM local_sales WHERE synced = false ]
                              --- (1. Transactional INSERT INTO remote_master_sales) ---> [ Server PostgreSQL DB ]
                              <--- (2. DB Transaction Commit Confirmation) --------------
                              ---> [ UPDATE local_sales SET synced = true ]
```

---

## 5. Controlled On-Duty Modifications & Audit Lineage Engine

Sales personnel actively **on duty** (logged into an active shift session) are permitted to perform sales edits, returns, or voids through the POS UI. To maintain 100% financial integrity and prevent untraceable corruption, **every single modification generates an immutable audit lineage record**.

```
+-----------------------------------------------------------------------------------+
|                  ON-DUTY SALES MODIFICATION & AUDIT FLOW                          |
+-----------------------------------------------------------------------------------+

[ Salesperson / Cashier On Duty ]
              |
              v
 [ Initiates Sale Edit / Void in POS App UI ]
              |
              v
 [ Prompts for Change Reason & Validates Active Shift Session ]
              |
              v
 +---------------------------------------------------------------------------------+
 |                    ATOMIC DATABASE AUDIT TRANSACTION                            |
 |                                                                                 |
 |  1. UPDATE sales_orders SET total_amount = X, status = 'MODIFIED', ...          |
 |                                                                                 |
 |  2. INSERT INTO sales_audit_logs (                                              |
 |         sale_id,                                                                |
 |         modified_by_user_id,                                                    |
 |         shift_session_id,                                                       |
 |         action_type,           -- 'QUANTITY_CHANGE', 'VOID', 'EXCHANGE'         |
 |         old_snapshot_json,     -- Full state before edit                        |
 |         new_snapshot_json,     -- Full state after edit                         |
 |         reason_note,           -- Cashier's typed reason                        |
 |         timestamp                                                               |
 |     )                                                                           |
 +---------------------------------------------------------------------------------+
              |
              v
 [ Sync Engine pushes Sale Update + Audit Log to Server DB ]
              |
              v
 [ Server DB Stores Complete Historical Lineage of WHO changed WHAT and WHEN ]
```

---

## 6. Multi-WAN, Mikrotik & Connection Configuration

Each node stores explicit target database connection credentials:

```json
{
  "node_id": "POS_LAHORE_BRANCH_01_TERM_02",
  "node_role": "LEAF_POS",
  "branch_id": "BRANCH_LAHORE_01",
  "pos_id": "POS_02",
  "upstream_db_connections": {
    "primary_branch_db": {
      "host": "192.168.1.50",
      "port": 5432,
      "database": "pos_branch_db",
      "username": "pos_sync_user",
      "password": "encrypted_password_hash",
      "ssl": false
    },
    "fallback_grandparent_db": {
      "host": "hq.clientdomain.com",
      "port": 5432,
      "database": "pos_enterprise_hq",
      "username": "pos_sync_user",
      "password": "encrypted_password_hash",
      "ssl": true
    }
  }
}
```

---

## 7. Data Integrity & Primary Key Collision Prevention

To prevent primary key collisions across offline terminals sync to a central database:

1. **Globally Unique Primary Keys**: Every database record uses `UUIDv7` (time-ordered, index-friendly globally unique identifier).
2. **Mandatory Origin Metadata**:
   All syncable tables (Orders, Order Items, Payments, Inventory Adjustments, Audit Logs) carry standard composite tracking columns:
   - `origin_branch_id`: Unique identifier of the originating store branch.
   - `origin_pos_id`: Unique identifier of the terminal device.
   - `origin_user_id`: Unique cashier/manager ID who authored the record.
   - `updated_at`: ISO timestamp for Conflict-Free Replicated Data Types (CRDT) / Last-Write-Wins (LWW) resolution.

---

## 8. Parallel Microservices Integration Bridge (e.g. FBR Invoicing)

For client-specific modules built in different tech stacks (Python, C#, Java, etc.), the system uses an **Event-Driven Microservices Bridge** on the Server Node:

```
[ POS Terminal ] --- (Direct DB Insert Sale) ---> [ Server PostgreSQL DB ]
                                                         |
                                            (DB Event / Table Listener)
                                                         v
                                            [ FBR Microservice (Python/C#) ]
                                                         |
                                            (API Request & Fiscal Sign)
                                                         v
                                            [ Government FBR Portal ]
                                                         |
                                            (Returns Invoice # & QR Code)
                                                         v
                                            [ FBR Microservice ]
                                                         |
                                            (Inserts Fiscal QR into Server DB)
                                                         v
                                            [ POS reads QR on next DB Pull ]
```

- **Decoupled Architecture**: Core POS system remains 100% clean and agnostic to external tax compliance rules.
- **Inter-Process Communication**: External microservices run in parallel on the server PC, observing the Server DB for new sales and writing fiscal metadata directly into the DB.

---

## 9. Software Licensing, Anti-Piracy & Subscription Engine (No SaaS Dependency)

To prevent unauthorized distribution or license piracy without relying on cloud auth platforms like Supabase:

### A. Machine Hardware Binding
At installation, the app generates a deterministic **Machine Fingerprint** derived from local hardware specs:
`SHA256( CPU_ID + MOTHERBOARD_SERIAL + MAC_ADDRESS )`

### B. Cryptographically Signed License File (`.lic`)
Licenses are issued as offline cryptographic files signed with **Ed25519 Asymmetric Keys**:
- **Your Private Key (Kept Secure in Dev HQ)**: Signs the license payload.
- **Public Key (Embedded in App Binary)**: Verifies signature locally.

```json
{
  "client_id": "CLIENT_PHARMA_001",
  "machine_fingerprint": "a3f89e...d4c1",
  "node_role": "BRANCH_SERVER",
  "allowed_pos_count": 5,
  "valid_until": "2027-08-01T23:59:59Z",
  "grace_period_days": 15,
  "features": ["FBR_INVOICING", "ADVANCED_INVENTORY"],
  "signature": "ed25519_sig_8d2f..."
}
```

### C. Anti-Clock Rewind Tampering Protection
To stop users from rewinding their PC system clock to bypass expiration:
- The app stores an encrypted `last_known_utc_timestamp` in its internal state table.
- Every transaction updates `last_known_utc_timestamp = MAX(current_time, last_known_utc_timestamp)`.
- If `current_system_time < last_known_utc_timestamp`, the app triggers a **Clock Tampering Flag** and prompts for license reactivation.

---

## 10. Financial Data Accuracy & Audit Integrity

Because financial calculations demand zero data corruption and total auditability:

1. **Immutable Double-Entry Ledger**:
   Financial transactions (Sales, Refunds, Cash Drawer Movements, Stock Adjustments) are **never overwritten or deleted**. Corrections are recorded as reversing ledger entries.
2. **Idempotent Sync Payloads**:
   Every sync batch carries a unique `sync_id` (UUIDv7). Re-executed sync attempts resulting from network drops are checked against `processed_sync_logs` to prevent duplicate financial credits/debits.
3. **ACID Transaction Safeguards**:
   All checkout operations (inventory deduction + sale generation + cash register balance update) execute inside strict Database Transaction boundaries (`db.transaction(...)`). Any error causes a complete rollback.

---

## 11. Client Diagnostic Package & Error Replication Workflow

To quickly debug and reproduce client-specific errors in a local development environment:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Client Diagnostic Package (.zip)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ ├── db_dump.sqlite / db_dump.sql    (Anonymized database snapshot)          │
│ ├── audit_events.jsonl              (Structured action logs leading to bug) │
│ ├── node_config.json                (Node role, hardware specs, OS details) │
│ └── system_errors.log               (Un-truncated stack traces)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **One-Click Export**: Managers can click *"Export System Diagnostics"* in Settings to download the bundle.
- **Dev Reproduction**: Drag-and-drop the `.zip` file into local dev workspace to instantly hydrate the client's state and replicate bugs line-by-line.
