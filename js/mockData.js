// ============================================================================
// ENTERPRISE POS MOCK DATABASE & DEMO DATA (RETAIL, RESTAURANT, BOM & TAXES)
// ============================================================================

function generateSvgIcon(color1, color2, iconType) {
  const icons = {
    chair: `<path d="M19 13V7a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3v6a2 2 0 0 0-2 2v4h2v2h2v-2h10v2h2v-2h2v-4a2 2 0 0 0-2-2z" fill="url(#grad)"/>`,
    desk: `<path d="M20 6H4v12h2V8h12v10h2V6zM6 14h4v2H6v-2zm8 0h4v2h-4v-2z" fill="url(#grad)"/>`,
    coffee: `<path d="M18 8h-1V6c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v6c0 3.31 2.69 6 6 6h4c3.31 0 6-2.69 6-6v-2c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-2 4c0 2.21-1.79 4-4 4H9c-2.21 0-4-1.79-4-4V6h10v6zm2-2h-1V9h1v1z" fill="url(#grad)"/>`,
    burger: `<path d="M12 2C7 2 3 5 3 8h18c0-3-4-6-9-6zm-9 8v1h18v-1H3zm0 3c0 2 4 4 9 4s9-2 9-4H3z" fill="url(#grad)"/>`,
    pizza: `<path d="M12 2L2 22h20L12 2zm0 5l5 10H7l5-10z" fill="url(#grad)"/>`,
    apparel: `<path d="M16 3H8L6 7v14h12V7l-2-4zm-4 4c-1.1 0-2-.9-2-2h4c0 1.1-.9 2-2 2z" fill="url(#grad)"/>`,
    electronics: `<path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z" fill="url(#grad)"/>`,
    service: `<path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6-3.6z" fill="url(#grad)"/>`
  };

  const selectedPath = icons[iconType] || icons.desk;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100" height="100">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color1}" />
        <stop offset="100%" stop-color="${color2}" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="#f8fafc"/>
    <g transform="translate(2, 2) scale(0.85)">
      ${selectedPath}
    </g>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const STORE_INFO = {
  storeName: "Odoo Universal Enterprise POS",
  branchName: "Branch #01 - Downtown Flagship",
  companyName: "Enterprise Retail & HORECA Group",
  taxId: "US-884920419-VAT",
  address: "100 Innovation Boulevard, Tech District",
  phone: "+1 (800) 555-0199",
  currentCashier: "Mitchell Admin (Manager)",
  cashierPin: "1234",
  managerPin: "9999"
};

// Tax Groups (Inclusive / Exclusive)
export const TAX_GROUPS = [
  { id: "vat10_inc", name: "VAT 10% (Inclusive)", rate: 0.10, isInclusive: true },
  { id: "gst15_exc", name: "GST 15% (Exclusive)", rate: 0.15, isInclusive: false },
  { id: "zero_tax", name: "Zero Rated (0%)", rate: 0.00, isInclusive: true }
];

// Pricelists
export const PRICELISTS = [
  { id: "standard", name: "Standard Retail Price", discountFactor: 1.0 },
  { id: "vip", name: "VIP Customer (10% Off)", discountFactor: 0.90 },
  { id: "wholesale", name: "Wholesale Bulk (20% Off)", discountFactor: 0.80 }
];

// POS Vertical Categories
export const POS_CATEGORIES = [
  { id: "all", name: "All Items", icon: "fa-cubes" },
  { id: "burgers", name: "Burgers & Meals (BOM)", icon: "fa-hamburger" },
  { id: "beverages", name: "Drinks & Coffee", icon: "fa-coffee" },
  { id: "raw_materials", name: "Raw Ingredients", icon: "fa-seedling" },
  { id: "office", name: "Desk & Furniture", icon: "fa-chair" },
  { id: "electronics", name: "Electronics", icon: "fa-laptop" },
  { id: "services", name: "Services & Repair", icon: "fa-tools" }
];

// Raw Ingredients Storage (For BOM Auto-Deduction)
export const RAW_INGREDIENTS = {
  "ING_BEEF_PATTY": { id: "ING_BEEF_PATTY", name: "Raw Beef Patty 150g", stock: 120, uom: "PCS" },
  "ING_BURGER_BUN": { id: "ING_BURGER_BUN", name: "Sesame Bun", stock: 150, uom: "PCS" },
  "ING_CHEESE_SLICE": { id: "ING_CHEESE_SLICE", name: "Cheddar Cheese Slice", stock: 300, uom: "PCS" },
  "ING_SAUCE": { id: "ING_SAUCE", name: "Special House Sauce", stock: 5000, uom: "GRAMS" },
  "ING_COFFEE_BEANS": { id: "ING_COFFEE_BEANS", name: "Espresso Beans Blend", stock: 10000, uom: "GRAMS" },
  "ING_MILK": { id: "ING_MILK", name: "Whole Dairy Milk", stock: 25000, uom: "ML" }
};

// Composite Products (with Bill of Materials) & Regular Products
export const POS_PRODUCTS = [
  {
    id: 101,
    sku: "FOOD_BURGER_DELUXE",
    barcode: "8801001",
    name: "Double Bacon Cheeseburger",
    category: "burgers",
    price: 12.50,
    type: "FINISHED_GOOD",
    kdsStation: "Grill Station",
    taxGroupId: "vat10_inc",
    image: generateSvgIcon("#ef4444", "#f59e0b", "burger"),
    description: "Flame-grilled double beef patty with melted cheddar and special sauce.",
    bom: [
      { ingredientId: "ING_BEEF_PATTY", qty: 2, uom: "PCS" },
      { ingredientId: "ING_BURGER_BUN", qty: 1, uom: "PCS" },
      { ingredientId: "ING_CHEESE_SLICE", qty: 2, uom: "PCS" },
      { ingredientId: "ING_SAUCE", qty: 25, uom: "GRAMS" }
    ]
  },
  {
    id: 102,
    sku: "FOOD_ESPRESSO_MAC",
    barcode: "8801002",
    name: "Espresso Macchiato",
    category: "beverages",
    price: 4.50,
    type: "FINISHED_GOOD",
    kdsStation: "Bar Station",
    taxGroupId: "vat10_inc",
    image: generateSvgIcon("#78350f", "#d97706", "coffee"),
    description: "Double shot espresso with a dollop of velvety steamed milk foam.",
    bom: [
      { ingredientId: "ING_COFFEE_BEANS", qty: 18, uom: "GRAMS" },
      { ingredientId: "ING_MILK", qty: 50, uom: "ML" }
    ]
  },
  {
    id: 1,
    sku: "FURN_6666",
    barcode: "7351001",
    name: "Acoustic Partition Screen",
    category: "office",
    price: 295.00,
    type: "RETAIL_GOOD",
    stock: 18,
    taxGroupId: "gst15_exc",
    image: generateSvgIcon("#714B67", "#017E84", "desk"),
    description: "Modular sound-absorbing acoustic partition screens for modern offices."
  },
  {
    id: 2,
    sku: "FURN_7777",
    barcode: "7351002",
    name: "Executive Mesh Chair Pro",
    category: "office",
    price: 145.00,
    type: "RETAIL_GOOD",
    stock: 24,
    taxGroupId: "gst15_exc",
    image: generateSvgIcon("#017E84", "#00A09D", "chair"),
    description: "Ergonomic mesh office conference chair with adjustable lumbar support."
  },
  {
    id: 3,
    sku: "ELEC_LAPTOP_STAND",
    barcode: "7351003",
    name: "Aluminum Laptop Docking Stand",
    category: "electronics",
    price: 89.00,
    type: "RETAIL_GOOD",
    stock: 45,
    taxGroupId: "gst15_exc",
    image: generateSvgIcon("#3b82f6", "#1d4ed8", "electronics"),
    description: "Dual-fan aluminum ergonomic riser with 4K USB-C hub."
  },
  {
    id: 4,
    sku: "SVC_POS_INSTALL",
    barcode: "7351004",
    name: "On-Site Hardware Installation",
    category: "services",
    price: 150.00,
    type: "SERVICE",
    stock: 999,
    taxGroupId: "zero_tax",
    image: generateSvgIcon("#10b981", "#047857", "service"),
    description: "Professional POS terminal configuration and peripheral wiring service."
  }
];

// Customers & Credit Accounts
export const POS_CUSTOMERS = [
  {
    id: 1,
    name: "Anita Oliver",
    company: "Deco Addict Studio",
    phone: "+1 555-0142",
    tier: "VIP Customer",
    pricelistId: "vip",
    loyaltyPoints: 1240,
    creditLimit: 5000.00,
    currentBalance: 350.00
  },
  {
    id: 2,
    name: "Deco Addict Wholesale",
    company: "Deco Group Ltd",
    phone: "+1 555-0199",
    tier: "Wholesale Partner",
    pricelistId: "wholesale",
    loyaltyPoints: 3450,
    creditLimit: 20000.00,
    currentBalance: 1200.00
  },
  {
    id: 3,
    name: "Walk-in Customer",
    company: "Standard Retail",
    phone: "N/A",
    tier: "Regular",
    pricelistId: "standard",
    loyaltyPoints: 0,
    creditLimit: 0.00,
    currentBalance: 0.00
  }
];

// Restaurant Tables & Floor Plan
export const RESTAURANT_TABLES = [
  { id: "T1", name: "Table 1 (Patio)", seats: 4, status: "FREE" },
  { id: "T2", name: "Table 2 (Main)", seats: 2, status: "FREE" },
  { id: "T3", name: "Table 3 (Main)", seats: 6, status: "FREE" },
  { id: "B1", name: "Bar Stool 1", seats: 1, status: "FREE" },
  { id: "B2", name: "Bar Stool 2", seats: 1, status: "FREE" }
];
