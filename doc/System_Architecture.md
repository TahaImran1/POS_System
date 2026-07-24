# System Architecture

## N-Tier Dynamic Hierarchy

The database architecture is designed as a dynamic, N-tier tree. There are no hardcoded levels (like "City" or "Province"). Instead, every server acts as a node that has exactly one **Parent** (except the Root) and zero-to-many **Children**.

![System Architecture](./system_architecture.svg)

---

### Mermaid Topology Specification
```mermaid
graph TD
    subgraph Global [Level 0: Root Server]
        HQ[(PostgreSQL Master DB)]
    end

    subgraph Region A [Level 1: Intermediate Nodes]
        Prov1[(PostgreSQL Prov 1)]
        Prov2[(PostgreSQL Prov 2)]
    end

    subgraph City Layer [Level 2: Intermediate Nodes]
        City1[(PostgreSQL City 1)]
        City2[(PostgreSQL City 2)]
        City3[(PostgreSQL City 3)]
    end

    subgraph Edge Layer [Level 3: Edge Leaf Nodes]
        POS1[(SQLite Tablet 1)]
        POS2[(SQLite Desktop 1)]
        POS3[(SQLite Mobile 1)]
        POS4[(SQLite Tablet 2)]
    end

    HQ <-->|Sync| Prov1
    HQ <-->|Sync| Prov2

    Prov1 <-->|Sync| City1
    Prov1 <-->|Sync| City2
    Prov2 <-->|Sync| City3

    City1 <-->|Sync| POS1
    City1 <-->|Sync| POS2
    City2 <-->|Sync| POS3
    City3 <-->|Sync| POS4
```

---

## Component Architecture per Node

Every Node (whether a heavy PostgreSQL server or a light SQLite edge device) runs a similar stack, optimized for its hardware.

```mermaid
graph LR
    subgraph POS Edge Device [Tablet / Desktop]
        UI[Frontend UI: Vue 3 + Vite]
        Engine[POS Logic: TypeScript]
        SQLite[(SQLite: OPFS / WASM)]
        SyncClient[Sync Daemon Client]
        
        UI <--> Engine
        Engine <--> SQLite
        SyncClient <--> SQLite
    end

    subgraph Intermediate / Root Server [Cloud / Local Server]
        SyncAPI[Fastify Sync API]
        ServerLogic[Node / Go Core Logic]
        Postgres[(PostgreSQL DB)]
        SyncWorker[Background Event Sync]

        SyncAPI <--> ServerLogic
        ServerLogic <--> Postgres
        SyncWorker <--> Postgres
    end

    SyncClient <-->|WebSockets / REST| SyncAPI
```

---

## Production Tech Stack Specification

### 1. Frontend POS Client Tier (Cross-Platform)
* **UI Framework**: **Vue 3 (Composition API) + TypeScript + Vite**
  * *Rationale*: High performance (<16ms, 60fps rendering), lightweight memory footprint for tablets, identical reactive architecture to Odoo 17/18's Owl framework.
* **Target Wrappers**:
  * **PWA (Progressive Web App)**: Instant web deployment for iPad Safari and Android Chrome registers.
  * **Tauri Framework**: Lightweight native desktop app wrapper (~15MB RAM) for Windows, macOS, and Linux POS terminals.
  * **Capacitor**: Optional wrapper for iOS/Android native app store distribution.

### 2. Database & Data Access Tier (Standard SQL)
* **Edge Terminal Database**: **SQLite (via `@sqlite.org/sqlite-wasm` + OPFS)**
  * *Rationale*: Runs native SQLite inside browser/desktop, persisting actual `.sqlite` database files queryable directly via DBeaver.
* **Server Database (Branch, City, Province, Root Nodes)**: **PostgreSQL**
  * *Rationale*: Enterprise relational database, fully queryable via DBeaver, DataGrip, or pgAdmin.
* **Query Engine**: **Drizzle ORM** / **Kysely**
  * *Rationale*: Type-safe SQL query builder providing a single unified API across both SQLite and PostgreSQL.

### 3. Backend & Event Sync Tier
* **Server Runtime**: **Node.js (TypeScript) + Fastify** *(or Golang compiled binary)*
* **Real-time Sync Transport**: **WebSockets (`ws`)** with HTTP REST fallback for polling `SYNC_EVENTS`.

### 4. Peripherals & Hardware Integration
* **Thermal Receipt Printers**: ESC/POS formatter outputting over WebUSB, Web Serial, LAN, or Bluetooth.
* **Barcode Scanners**: Global JS inter-keystroke listener with `<35ms` detection threshold.
