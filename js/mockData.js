// ============================================================================
// ODOO POS MOCK DATABASE & DEMO DATA
// ============================================================================

// Helper to generate sleek SVG Data URIs for product illustrations
function generateSvgIcon(color1, color2, iconType, title) {
  const icons = {
    chair: `<path d="M19 13V7a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3v6a2 2 0 0 0-2 2v4h2v2h2v-2h10v2h2v-2h2v-4a2 2 0 0 0-2-2z" fill="url(#grad)"/>`,
    desk: `<path d="M20 6H4v12h2V8h12v10h2V6zM6 14h4v2H6v-2zm8 0h4v2h-4v-2z" fill="url(#grad)"/>`,
    lamp: `<path d="M12 2L8 8h8l-4-6zm-1 8v6H8l4 4 4-4h-3v-6h-2z" fill="url(#grad)"/>`,
    coffee: `<path d="M18 8h-1V6c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v6c0 3.31 2.69 6 6 6h4c3.31 0 6-2.69 6-6v-2c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-2 4c0 2.21-1.79 4-4 4H9c-2.21 0-4-1.79-4-4V6h10v6zm2-2h-1V9h1v1z" fill="url(#grad)"/>`,
    croissant: `<path d="M21 13c0-4.97-4.03-9-9-9s-9 4.03-9 9c0 1.5.4 2.9 1.1 4.1l2.3-2.3c-.3-.5-.4-1.1-.4-1.8 0-3.31 2.69-6 6-6s6 2.69 6 6c0 .7-.1 1.3-.4 1.8l2.3 2.3c.7-1.2 1.1-2.6 1.1-4.1z" fill="url(#grad)"/>`,
    electronics: `<path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z" fill="url(#grad)"/>`,
    apparel: `<path d="M16 3H8L6 7v14h12V7l-2-4zm-4 4c-1.1 0-2-.9-2-2h4c0 1.1-.9 2-2 2z" fill="url(#grad)"/>`,
    service: `<path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="url(#grad)"/>`
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
  storeName: "Odoo Retail Flagship",
  companyName: "Odoo S.A. Demo Store",
  taxId: "BE 0477.472.701",
  address: "Chaussée de Namur 40, 1367 Grand-Rosière, Belgium",
  phone: "+32 81 81 37 00",
  sessionName: "POS/2026/0042",
  cashier: "Mitchell Admin",
  taxRate: 0.10, // 10% VAT
  openingBalance: 1000.00
};

export const POS_CATEGORIES = [
  { id: "all", name: "All Products", icon: "fa-cubes" },
  { id: "food", name: "Food & Drinks", icon: "fa-coffee" },
  { id: "office", name: "Desk & Office", icon: "fa-chair" },
  { id: "electronics", name: "Electronics", icon: "fa-laptop" },
  { id: "apparel", name: "Apparel", icon: "fa-tshirt" },
  { id: "services", name: "Services", icon: "fa-tools" }
];

export const POS_PRODUCTS = [
  // Office & Furniture
  {
    id: 1,
    sku: "FURN_6666",
    barcode: "7351001",
    name: "Acoustic Bloc Screens",
    category: "office",
    price: 295.00,
    stock: 18,
    image: generateSvgIcon("#714B67", "#017E84", "desk", "Acoustic Screens"),
    description: "Modular sound-absorbing acoustic partition screens for modern offices."
  },
  {
    id: 2,
    sku: "FURN_7777",
    barcode: "7351002",
    name: "Conference Chair Executive",
    category: "office",
    price: 145.00,
    stock: 24,
    image: generateSvgIcon("#017E84", "#00A09D", "chair", "Conference Chair"),
    description: "Ergonomic mesh office conference chair with adjustable lumbar support."
  },
  {
    id: 3,
    sku: "FURN_8888",
    barcode: "7351003",
    name: "Corner Desk Executive Wood",
    category: "office",
    price: 850.00,
    stock: 7,
    image: generateSvgIcon("#8b5cf6", "#3b82f6", "desk", "Executive Desk"),
    description: "Premium solid oak L-shaped executive corner desk."
  },
  {
    id: 4,
    sku: "FURN_9999",
    barcode: "7351004",
    name: "Ergonomic Footrest Pro",
    category: "office",
    price: 55.00,
    stock: 32,
    image: generateSvgIcon("#14b8a6", "#0f766e", "chair", "Footrest"),
    description: "Adjustable angle ergonomic under-desk footrest."
  },
  {
    id: 5,
    sku: "FURN_5555",
    barcode: "7351005",
    name: "Monitor Stand Dual Arm",
    category: "office",
    price: 72.00,
    stock: 19,
    image: generateSvgIcon("#6366f1", "#4f46e5", "desk", "Monitor Stand"),
    description: "Gas-spring articulating dual monitor stand arm."
  },

  // Electronics
  {
    id: 6,
    sku: "ELEC_1001",
    barcode: "7351006",
    name: "LED Desk Lamp Dimmable",
    category: "electronics",
    price: 48.50,
    stock: 45,
    image: generateSvgIcon("#f59e0b", "#d97706", "lamp", "LED Desk Lamp"),
    description: "Touch-control LED desk lamp with adjustable color temperature."
  },
  {
    id: 7,
    sku: "ELEC_1002",
    barcode: "7351007",
    name: "Wireless Optical Mouse",
    category: "electronics",
    price: 24.00,
    stock: 60,
    image: generateSvgIcon("#3b82f6", "#1d4ed8", "electronics", "Wireless Mouse"),
    description: "Precision 2.4GHz wireless ergonomic mouse with silent click."
  },
  {
    id: 8,
    sku: "ELEC_1003",
    barcode: "7351008",
    name: "Mechanical Keyboard RGB",
    category: "electronics",
    price: 115.00,
    stock: 14,
    image: generateSvgIcon("#ec4899", "#be185d", "electronics", "Mechanical Keyboard"),
    description: "Tactile switch aluminum frame mechanical keyboard."
  },
  {
    id: 9,
    sku: "ELEC_1004",
    barcode: "7351009",
    name: "Noise-Canceling Headphones",
    category: "electronics",
    price: 210.00,
    stock: 12,
    image: generateSvgIcon("#714B67", "#111827", "electronics", "Headphones"),
    description: "Active noise canceling Bluetooth over-ear studio headphones."
  },
  {
    id: 10,
    sku: "ELEC_1005",
    barcode: "7351010",
    name: "USB-C Docking Station 11-in-1",
    category: "electronics",
    price: 135.00,
    stock: 22,
    image: generateSvgIcon("#017E84", "#4338ca", "electronics", "USB-C Dock"),
    description: "Multi-port aluminum USB-C dock with dual HDMI & Power Delivery."
  },

  // Food & Drinks
  {
    id: 11,
    sku: "FOOD_0101",
    barcode: "7351011",
    name: "Espresso Single Origin",
    category: "food",
    price: 3.50,
    stock: 999,
    image: generateSvgIcon("#78350f", "#451a03", "coffee", "Espresso"),
    description: "Rich freshly ground single-origin arabica espresso shot."
  },
  {
    id: 12,
    sku: "FOOD_0102",
    barcode: "7351012",
    name: "Cappuccino Grande",
    category: "food",
    price: 4.80,
    stock: 999,
    image: generateSvgIcon("#b45309", "#78350f", "coffee", "Cappuccino"),
    description: "Smooth espresso topped with velvety steamed milk foam."
  },
  {
    id: 13,
    sku: "FOOD_0103",
    barcode: "7351013",
    name: "Artisanal Butter Croissant",
    category: "food",
    price: 3.25,
    stock: 35,
    image: generateSvgIcon("#d97706", "#92400e", "croissant", "Croissant"),
    description: "Flaky fresh-baked French butter croissant."
  },
  {
    id: 14,
    sku: "FOOD_0104",
    barcode: "7351014",
    name: "Club Sandwich Gourmet",
    category: "food",
    price: 9.50,
    stock: 16,
    image: generateSvgIcon("#10b981", "#059669", "croissant", "Club Sandwich"),
    description: "Triple-decker roasted turkey, bacon, avocado & fresh lettuce sandwich."
  },
  {
    id: 15,
    sku: "FOOD_0105",
    barcode: "7351015",
    name: "Fresh Squeezed Orange Juice",
    category: "food",
    price: 4.50,
    stock: 40,
    image: generateSvgIcon("#f97316", "#c2410c", "coffee", "Orange Juice"),
    description: "100% freshly squeezed California oranges."
  },
  {
    id: 16,
    sku: "FOOD_0106",
    barcode: "7351016",
    name: "Organic Sencha Green Tea",
    category: "food",
    price: 3.80,
    stock: 999,
    image: generateSvgIcon("#15803d", "#14532d", "coffee", "Green Tea"),
    description: "Traditional Japanese organic steamed green tea leaves."
  },

  // Apparel
  {
    id: 17,
    sku: "APP_2001",
    barcode: "7351017",
    name: "Odoo Classic Polo Shirt",
    category: "apparel",
    price: 38.00,
    stock: 50,
    image: generateSvgIcon("#714B67", "#017E84", "apparel", "Polo Shirt"),
    description: "100% combed cotton pique polo embroidered with subtle Odoo logo."
  },
  {
    id: 18,
    sku: "APP_2002",
    barcode: "7351018",
    name: "Corporate Zip Hoodie",
    category: "apparel",
    price: 65.00,
    stock: 28,
    image: generateSvgIcon("#334155", "#0f172a", "apparel", "Hoodie"),
    description: "Heavyweight French terry zip-up hoodie in slate gray."
  },

  // Services
  {
    id: 19,
    sku: "SERV_3001",
    barcode: "7351019",
    name: "1-Year Extended Hardware Warranty",
    category: "services",
    price: 45.00,
    stock: 999,
    image: generateSvgIcon("#0284c7", "#0369a1", "service", "Warranty"),
    description: "Full replacement & priority support coverage for 12 additional months."
  },
  {
    id: 20,
    sku: "SERV_3002",
    barcode: "7351020",
    name: "Express On-Site Installation",
    category: "services",
    price: 80.00,
    stock: 999,
    image: generateSvgIcon("#059669", "#047857", "service", "Installation"),
    description: "Professional assembly and calibration by a certified technician."
  }
];

export const POS_CUSTOMERS = [
  {
    id: 1,
    name: "Anita Oliver",
    email: "anita.oliver@example.com",
    phone: "+32 470 12 34 56",
    address: "Avenue Louise 54, 1050 Brussels",
    loyaltyPoints: 450,
    tier: "Gold VIP",
    taxId: "BE 0899.123.456"
  },
  {
    id: 2,
    name: "Deco Addict",
    email: "info@decoaddict.be",
    phone: "+32 2 345 67 89",
    address: "Rue Haute 120, 1000 Brussels",
    loyaltyPoints: 1280,
    tier: "Platinum VIP",
    taxId: "BE 0411.222.333"
  },
  {
    id: 3,
    name: "Gemini Furniture S.A.",
    email: "contact@geminifurniture.com",
    phone: "+32 9 876 54 32",
    address: "Kouter 15, 9000 Ghent",
    loyaltyPoints: 320,
    tier: "Silver VIP",
    taxId: "BE 0678.910.111"
  },
  {
    id: 4,
    name: "Lumber Inc",
    email: "procurement@lumberinc.com",
    phone: "+32 3 222 11 00",
    address: "Meir 88, 2000 Antwerp",
    loyaltyPoints: 890,
    tier: "Gold VIP",
    taxId: "BE 0555.444.333"
  },
  {
    id: 5,
    name: "Azure Interior Design",
    email: "studio@azureinterior.com",
    phone: "+32 4 111 22 33",
    address: "Boulevard d'Avroy 30, 4000 Liège",
    loyaltyPoints: 610,
    tier: "Gold VIP",
    taxId: "BE 0777.888.999"
  },
  {
    id: 6,
    name: "Ready Mat Construction",
    email: "logistics@readymat.be",
    phone: "+32 10 45 67 89",
    address: "Rue de la Gare 10, 1300 Wavre",
    loyaltyPoints: 140,
    tier: "Regular",
    taxId: "BE 0900.111.222"
  },
  {
    id: 7,
    name: "Brandon Freeman",
    email: "brandon.freeman@example.com",
    phone: "+32 488 99 88 77",
    address: "Grand-Place 1, 1000 Brussels",
    loyaltyPoints: 75,
    tier: "Regular",
    taxId: "Private"
  }
];
