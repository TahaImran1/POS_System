# Class Diagram

This class diagram details the software architecture, including services for Bill of Materials (BOM) Auto-Deduction, Multi-Tax Calculation, Cash Session Auditing, Pricelist Management, and Event Sourcing Synchronization.

![Class Diagram](./class_diagram.svg)

---

### Mermaid Specification

```mermaid
classDiagram
    class AppController {
        +initialize()
        +startSyncEngine()
        +renderUI()
    }

    class POSController {
        -SalesService salesService
        -BOMService bomService
        -TaxEngine taxEngine
        -SessionManager sessionManager
        -PricelistService pricelistService
        +addToCart(barcode)
        +updateQuantity(productId, qty)
        +checkout(paymentDetails)
    }

    class BOMService {
        -IDatabase db
        +getBOMForProduct(productId) List~BOMEntry~
        +deductRecipeIngredients(productId, soldQty)
        +checkIngredientAvailability(productId, qty) bool
    }

    class TaxEngine {
        -IDatabase db
        +calculateItemTax(product, branchId) TaxResult
        +calculateCartTaxes(cartItems, branchId) List~TaxBreakdown~
    }

    class SessionManager {
        -IDatabase db
        +openSession(cashierId, floatAmount) CashSession
        +logCashDrop(sessionId, type, amount, reason)
        +closeSessionWithCount(sessionId, actualCash) ZReport
    }

    class PricelistService {
        -IDatabase db
        +getItemPrice(productId, branchId, customerId) decimal
        +applyPromotions(cart) Cart
    }

    class SalesService {
        -IDatabase db
        -BOMService bomService
        -TaxEngine taxEngine
        +createSale(cart) Sale
        +generateReceipt(saleId) Document
    }

    class IDatabase {
        <<interface>>
        +query(sql, params)
        +execute(sql, params)
        +insertEvent(table, action, payload)
    }

    class SQLiteAdapter {
        -dbConnection
        +query()
        +execute()
        +insertEvent()
    }

    class PostgresAdapter {
        -dbPool
        +query()
        +execute()
        +insertEvent()
    }

    class SyncEngine {
        -IDatabase localDb
        -SyncAPIClient apiClient
        +pollLocalEvents()
        +pushEventsToServer()
        +pullEventsFromServer()
    }

    POSController --> SalesService
    POSController --> BOMService
    POSController --> TaxEngine
    POSController --> SessionManager
    POSController --> PricelistService

    SalesService --> BOMService
    SalesService --> TaxEngine
    SalesService --> IDatabase

    BOMService --> IDatabase
    TaxEngine --> IDatabase
    SessionManager --> IDatabase
    PricelistService --> IDatabase

    SQLiteAdapter ..|> IDatabase
    PostgresAdapter ..|> IDatabase

    AppController --> SyncEngine
    SyncEngine --> IDatabase
```
