# Enterprise Database Schema & Data Models

This document defines the relational database schema implemented across **PostgreSQL (Servers)** and **SQLite (Edge Terminals)**. It natively supports Bill of Materials (BOM) raw material tracking, multi-tax engines, cash sessions, multi-tier pricelists, and event-sourcing sync.

![Database Schema](./db_schema.svg)

---

## Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    NODES ||--o{ NODES : "parent_node_id (Hierarchy)"
    NODES ||--o{ POS_CONFIG : "configures"
    NODES ||--o{ INVENTORY : "holds"
    NODES ||--o{ CASH_SESSIONS : "operates"
    NODES ||--o{ SALES : "generates"
    NODES ||--o{ SYNC_EVENTS : "creates"

    PRODUCTS ||--o{ PRODUCT_BOM : "parent (Composite)"
    PRODUCTS ||--o{ PRODUCT_BOM : "ingredient (Raw Material)"
    PRODUCTS ||--o{ INVENTORY : "tracked in"
    PRODUCTS ||--o{ PRODUCT_TAXES : "taxed by"
    PRODUCTS ||--o{ PRICELIST_ITEMS : "priced in"
    PRODUCTS ||--o{ SALE_ITEMS : "sold as"

    TAX_GROUPS ||--o{ PRODUCT_TAXES : "applies"
    PRICELISTS ||--o{ PRICELIST_ITEMS : "contains"

    CASH_SESSIONS ||--o{ CASH_DROPS : "logs"
    CASH_SESSIONS ||--o{ SALES : "contains"

    SALES ||--|{ SALE_ITEMS : "contains"
    SALE_ITEMS ||--o{ SALE_ITEM_MODIFIERS : "customized by"

    NODES {
        string node_id PK "Stored as TEXT (UUID)"
        string parent_node_id FK "Stored as TEXT (UUID)"
        string node_type "ROOT, REGION, CITY, BRANCH, POS"
        string location_name
    }

    PRODUCTS {
        string product_id PK "Stored as TEXT (UUID)"
        string barcode UK
        string name
        string product_type "FINISHED_GOOD, RAW_MATERIAL, SERVICE"
        decimal default_price
        string uom "PCS, KG, LTR, G"
    }

    PRODUCT_BOM {
        string bom_id PK "Stored as TEXT (UUID)"
        string parent_product_id FK "Composite Item e.g. Burger"
        string ingredient_product_id FK "Raw Material e.g. Patty"
        decimal quantity_required "e.g. 1.0 or 0.150"
        string uom
    }

    INVENTORY {
        string inventory_id PK "Stored as TEXT (UUID)"
        string node_id FK
        string product_id FK
        decimal quantity
        decimal min_stock_alert
        timestamp last_updated
    }

    TAX_GROUPS {
        string tax_group_id PK "Stored as TEXT (UUID)"
        string name "State GST, VAT, Municipal"
        decimal rate_percentage
        boolean is_inclusive
    }

    PRODUCT_TAXES {
        string product_tax_id PK "Stored as TEXT (UUID)"
        string product_id FK
        string tax_group_id FK
    }

    PRICELISTS {
        string pricelist_id PK "Stored as TEXT (UUID)"
        string name "Retail Base, VIP 10%, Wholesale"
        string currency
    }

    PRICELIST_ITEMS {
        string item_id PK "Stored as TEXT (UUID)"
        string pricelist_id FK
        string product_id FK
        decimal fixed_price
    }

    CASH_SESSIONS {
        string session_id PK "Stored as TEXT (UUID)"
        string node_id FK
        string cashier_user_id FK
        decimal opening_balance
        decimal expected_closing_balance
        decimal closing_cash_counted
        decimal cash_variance
        string status "OPEN, CLOSED"
        timestamp opened_at
        timestamp closed_at
    }

    CASH_DROPS {
        string drop_id PK "Stored as TEXT (UUID)"
        string session_id FK
        string type "CASH_IN, CASH_OUT_SAFE, EXPENSE"
        decimal amount
        string reason
        timestamp created_at
    }

    SALES {
        string sale_id PK "Stored as TEXT (UUID)"
        string node_id FK
        string session_id FK
        decimal subtotal
        decimal tax_total
        decimal discount_total
        decimal net_total
        string payment_method
        string order_type "TAKEAWAY, DINE_IN, DELIVERY"
        jsonb extra_attributes "Table No, Seat No, KDS Notes"
        timestamp created_at
    }

    SALE_ITEMS {
        string sale_item_id PK "Stored as TEXT (UUID)"
        string sale_id FK
        string product_id FK
        decimal quantity
        decimal unit_price
        decimal tax_amount
        decimal line_total
    }

    SALE_ITEM_MODIFIERS {
        string modifier_id PK "Stored as TEXT (UUID)"
        string sale_item_id FK
        string modifier_name "Extra Cheese, Medium Rare"
        decimal price_override
    }

    SYNC_EVENTS {
        string event_id PK "Stored as TEXT (UUID)"
        string origin_node_id FK
        string table_name
        string action "INSERT, UPDATE, DELETE"
        string payload "Event Delta (Stored as JSON String)"
        timestamp created_at
    }

    SYNC_LEDGER {
        string sync_id PK "Stored as TEXT (UUID)"
        string source_node_id FK "Node generating the event"
        string target_node_id FK "Node receiving the event"
        string last_synced_event_id FK "Last successful event"
        timestamp last_sync_time
    }
```
