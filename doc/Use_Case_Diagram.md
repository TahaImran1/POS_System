# Use Case Diagram

This diagram maps human actors (`Cashier`, `Store Supervisor / Manager`, `Global Admin`) to core system operations including Cash Session Management (Z-Report), Recipe/BOM Auto-Deduction, Multi-Tax calculation, and Branch Pricelists.

![Use Case Diagram](./use_case_diagram.svg)

---

### Mermaid Specification
```mermaid
flowchart LR
    subgraph Actors ["System Actors"]
        Cashier["👤 Cashier / Terminal User"]
        Supervisor["👤 Store Supervisor / Manager"]
        RootAdmin["👤 Global / Root Admin"]
    end

    subgraph TerminalOps ["Edge POS Device Operations"]
        UC1(["Open Session & Enter Float"])
        UC2(["Process Sale & Auto-Deduct BOM Raw Materials"])
        UC3(["Apply Multi-Tax & Branch Pricelist Rules"])
        UC4(["Perform Mid-Shift Cash Drop"])
        UC5(["Blind Count & Close Session (Z-Report)"])
    end

    subgraph ManagerOps ["Supervisor / Manager Operations"]
        UC6(["Authorize Line Void / Price Override (Manager PIN)"])
        UC7(["Manage Product Recipes / BOM Definitions"])
        UC8(["Log Inventory Waste & Raw Material Adjustments"])
    end

    subgraph CentralOps ["Central Enterprise Operations"]
        UC9(["Configure Multi-Tax Groups & Regional Pricelists"])
        UC10(["View Cross-Branch Consolidated Financial Reports"])
        UC11(["Monitor Distributed Node Hierarchy"])
    end

    Cashier --> UC1
    Cashier --> UC2
    Cashier --> UC3
    Cashier --> UC4
    Cashier --> UC5

    Supervisor --> UC6
    Supervisor --> UC7
    Supervisor --> UC8

    RootAdmin --> UC9
    RootAdmin --> UC10
    RootAdmin --> UC11

    UC2 -.->|Auto-Deducts Raw Ingredients| UC7
```
