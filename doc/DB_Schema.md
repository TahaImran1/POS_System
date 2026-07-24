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
    PRICELISTS ||--o{ CUSTOMERS : "assigned to"

    CUSTOMERS ||--o{ SALES : "places"
    CUSTOMERS ||--o{ CUSTOMER_LEDGER : "has balance"

    CASH_SESSIONS ||--o{ CASH_DROPS : "logs"
    CASH_SESSIONS ||--o{ SALES : "contains"

    SALES ||--|{ SALE_ITEMS : "contains"
    SALE_ITEMS ||--o{ SALE_ITEM_MODIFIERS : "customized by"

    NODES {
        uuid node_id PK
        uuid parent_node_id FK
        string node_type "ROOT, REGION, CITY, BRANCH, POS"
        string location_name
    }

    PRODUCTS {
        uuid product_id PK
        string barcode UK
        string name
        string product_type "FINISHED_GOOD, RAW_MATERIAL, SERVICE"
        decimal default_price
        string uom "PCS, KG, LTR, G"
    }

    PRODUCT_BOM {
        uuid bom_id PK
        uuid parent_product_id FK "Composite Item e.g. Burger"
        uuid ingredient_product_id FK "Raw Material e.g. Patty"
        decimal quantity_required "e.g. 1.0 or 0.150"
        string uom
    }

    INVENTORY {
        uuid inventory_id PK
        uuid node_id FK
        uuid product_id FK
        decimal quantity
        decimal min_stock_alert
        timestamp last_updated
    }

    TAX_GROUPS {
        uuid tax_group_id PK
        string name "State GST, VAT, Municipal"
        decimal rate_percentage
        boolean is_inclusive
    }

    PRODUCT_TAXES {
        uuid product_tax_id PK
        uuid product_id FK
        uuid tax_group_id FK
    }

    PRICELISTS {
        uuid pricelist_id PK
        string name "Retail Base, VIP 10%, Wholesale"
        string currency
    }

    PRICELIST_ITEMS {
        uuid item_id PK
        uuid pricelist_id FK
        uuid product_id FK
        decimal fixed_price
    }

    CUSTOMERS {
        uuid customer_id PK
        uuid pricelist_id FK
        string name
        string phone
        decimal credit_limit
        decimal current_credit_balance
    }

    CUSTOMER_LEDGER {
        uuid entry_id PK
        uuid customer_id FK
        uuid sale_id FK
        decimal debit_amount
        decimal credit_amount
        timestamp created_at
    }

    CASH_SESSIONS {
        uuid session_id PK
        uuid node_id FK
        uuid cashier_user_id FK
        decimal opening_balance
        decimal closing_cash_counted
        decimal cash_variance
        string status "OPEN, CLOSED"
        timestamp opened_at
        timestamp closed_at
    }

    CASH_DROPS {
        uuid drop_id PK
        uuid session_id FK
        string type "CASH_IN, CASH_OUT_SAFE, EXPENSE"
        decimal amount
        string reason
        timestamp created_at
    }

    SALES {
        uuid sale_id PK
        uuid node_id FK
        uuid session_id FK
        uuid customer_id FK
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
        uuid sale_item_id PK
        uuid sale_id FK
        uuid product_id FK
        decimal quantity
        decimal unit_price
        decimal tax_amount
        decimal line_total
    }

    SALE_ITEM_MODIFIERS {
        uuid modifier_id PK
        uuid sale_item_id FK
        string modifier_name "Extra Cheese, Medium Rare"
        decimal price_override
    }

    SYNC_EVENTS {
        uuid event_id PK
        uuid origin_node_id FK
        string table_name
        string action "INSERT, UPDATE, DELETE"
        jsonb payload "Event Delta"
        timestamp created_at
        boolean is_synced
    }
```
