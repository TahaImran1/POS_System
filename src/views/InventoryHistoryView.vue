<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  getAllInventoryLogs, 
  getAllPriceHistory, 
  processBatchInventoryAdjustment, 
  type InventoryLogItem, 
  type PriceHistoryLogItem,
  type BatchAdjustmentLine
} from '../services/bomService'
import { useProductStore, type Product } from '../stores/useProductStore'
import { useAuthStore } from '../stores/useAuthStore'
import ManagerPinModal from '../components/modals/ManagerPinModal.vue'
import { useToast } from '../composables/useToast'

import { getVendors, getVendorProductPrice, type Vendor } from '../services/vendorService'
import VendorPaymentModal from '../components/modals/VendorPaymentModal.vue'

const productStore = useProductStore()
const authStore = useAuthStore()
const toast = useToast()

const activeTab = ref<'register' | 'ledger' | 'priceHistory'>('register')

const logs = ref<InventoryLogItem[]>([])
const priceHistoryLogs = ref<PriceHistoryLogItem[]>([])
const vendors = ref<Vendor[]>([])
const selectedPoVendorId = ref<string>('')
const isLoading = ref(true)

// Post-PO Vendor Payment Prompt State
const isVendorPaymentModalOpen = ref(false)
const submittedPoId = ref('')
const submittedPoAmount = ref(0)

// Ledger Filters
const searchQuery = ref('')
const selectedTypeFilter = ref('ALL')
const selectedProductFilter = ref('ALL')
const dateRangeFilter = ref<'ALL' | 'TODAY' | '7DAYS' | '30DAYS'>('ALL')

// Price History Filters
const priceSearchQuery = ref('')
const priceProductFilter = ref('ALL')

// Manager PIN Authorization Modal State
const isManagerPinModalOpen = ref(false)

// Inventory Batch Cart State
export interface BatchCartItem {
  product: Product
  direction: '+' | '-'
  unitMode: 'PCS' | 'CARTON'
  packSize: number
  cartons: number
  pcs: number
  costPrice: number
  newPrice: number
  note: string
}

const batchCart = ref<BatchCartItem[]>([])
const globalBatchNote = ref('Purchase Order (PO) Delivery & Restock')
const isSubmittingBatch = ref(false)
const gridSearchQuery = ref('')
const selectedCategory = ref('all')

async function fetchData() {
  isLoading.value = true
  try {
    await productStore.loadFromDb()
    logs.value = await getAllInventoryLogs()
    priceHistoryLogs.value = await getAllPriceHistory()
    vendors.value = await getVendors()
    if (vendors.value.length > 0 && !selectedPoVendorId.value) {
      selectedPoVendorId.value = vendors.value[0].vendor_id
    }
  } catch (e) {
    console.error('Error fetching inventory & price history:', e)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchData()
})

// Add Product to Batch Cart
async function addToBatchCart(product: Product) {
  const existing = batchCart.value.find(c => c.product.id === product.id)
  if (existing) {
    if (existing.unitMode === 'CARTON') {
      existing.cartons += 1
    } else {
      existing.pcs += 10
    }
  } else {
    // Check if selected vendor has an agreed buying rate for this product
    let initialCost = Number(product.cost_price) || 0
    if (selectedPoVendorId.value) {
      const vendorCost = await getVendorProductPrice(selectedPoVendorId.value, product.id, 'PCS')
      if (vendorCost !== null && vendorCost > 0) {
        initialCost = vendorCost
      }
    }
    if (!initialCost && product.price) {
      initialCost = Number((product.price * 0.8).toFixed(2))
    }

    batchCart.value.push({
      product,
      direction: '+',
      unitMode: 'PCS',
      packSize: 24,
      cartons: 1,
      pcs: 10,
      costPrice: initialCost,
      newPrice: product.price,
      note: 'Purchase Order Restock'
    })
  }
}

function removeFromBatchCart(productId: string) {
  batchCart.value = batchCart.value.filter(c => c.product.id !== productId)
}

function toggleDirection(item: BatchCartItem) {
  item.direction = item.direction === '+' ? '-' : '+'
}

function clearBatchCart() {
  batchCart.value = []
}

// Calculations for Batch Cart Summary
const batchSummary = computed(() => {
  const totalItems = batchCart.value.length
  let totalAddedQty = 0
  let totalReducedQty = 0
  let totalCostValuation = 0

  for (const item of batchCart.value) {
    const rawQty = item.unitMode === 'CARTON' ? (item.cartons * item.packSize) : item.pcs
    const q = Math.abs(rawQty || 0)
    const perPcCost = item.unitMode === 'CARTON' ? (item.costPrice / (item.packSize || 1)) : item.costPrice

    if (item.direction === '+') {
      totalAddedQty += q
      totalCostValuation += q * perPcCost
    } else {
      totalReducedQty += q
    }
  }

  return {
    totalItems,
    totalAddedQty,
    totalReducedQty,
    totalCostValuation
  }
})

// Trigger Batch Confirmation
function requestSubmitBatch() {
  if (batchCart.value.length === 0) {
    toast.warning('Purchase Order cart is empty. Add products before submitting.')
    return
  }

  if (authStore.hasManagerPrivileges) {
    executeSubmitBatch()
  } else {
    isManagerPinModalOpen.value = true
  }
}

async function executeSubmitBatch() {
  isSubmittingBatch.value = true
  try {
    const operatorName = authStore.currentUser?.name || 'Store Manager'
    
    const lines: BatchAdjustmentLine[] = batchCart.value.map(item => {
      const rawQty = item.unitMode === 'CARTON' ? (item.cartons * item.packSize) : item.pcs
      const finalQtyChange = item.direction === '+' ? Math.abs(rawQty) : -Math.abs(rawQty)
      const movType = item.direction === '+' 
        ? 'RESTOCK' 
        : (item.note.toLowerCase().includes('damage') || item.note.toLowerCase().includes('wastage') ? 'WASTAGE' : 'STOCK_REDUCTION')

      const modeLabel = item.unitMode === 'CARTON' ? `${item.cartons} Cartons @ ${item.packSize} pcs/ctn` : `${item.pcs} Pcs`
      const perPcCost = item.unitMode === 'CARTON' ? (item.costPrice / (item.packSize || 1)) : item.costPrice

      return {
        product_id: item.product.id,
        qty_change: finalQtyChange,
        cost_price: perPcCost,
        new_price: Number(item.newPrice),
        uom_name: item.unitMode === 'CARTON' ? 'Carton' : 'Piece',
        reference_note: `${item.note} (${modeLabel} - Cost: Rs ${item.costPrice})`,
        movement_type: movType
      }
    })

    const poCostTotal = batchSummary.value.totalCostValuation
    const batchId = await processBatchInventoryAdjustment(
      lines, 
      operatorName, 
      globalBatchNote.value, 
      'NODE_POS_001', 
      selectedPoVendorId.value || undefined
    )
    
    toast.success(`Successfully created Purchase Order (PO #${batchId})!`)
    clearBatchCart()
    await fetchData()

    // Trigger Immediate Vendor Payment Prompt Modal
    submittedPoId.value = batchId
    submittedPoAmount.value = poCostTotal
    isVendorPaymentModalOpen.value = true
  } catch (e: any) {
    toast.error('Failed to submit Purchase Order: ' + (e.message || e))
  } finally {
    isSubmittingBatch.value = false
  }
}

// Grid Products Filter
const gridProducts = computed(() => {
  return productStore.products.filter(p => {
    const matchesCat = selectedCategory.value === 'all' || p.category === selectedCategory.value
    const q = gridSearchQuery.value.toLowerCase().trim()
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q))
    return matchesCat && matchesSearch
  })
})

// Filtered Audit Logs
const filteredLogs = computed(() => {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  return logs.value.filter(item => {
    // Search Query filter
    const q = searchQuery.value.toLowerCase().trim()
    const matchesSearch = !q || 
      (item.product_name && item.product_name.toLowerCase().includes(q)) ||
      (item.product_barcode && item.product_barcode.toLowerCase().includes(q)) ||
      (item.reference_note && item.reference_note.toLowerCase().includes(q)) ||
      (item.user_name && item.user_name.toLowerCase().includes(q))

    // Type Filter
    const matchesType = selectedTypeFilter.value === 'ALL' || item.movement_type === selectedTypeFilter.value

    // Product Filter
    const matchesProduct = selectedProductFilter.value === 'ALL' || item.product_id === selectedProductFilter.value

    // Date Range Filter
    let matchesDate = true
    if (dateRangeFilter.value !== 'ALL' && item.created_at) {
      const logTime = new Date(item.created_at).getTime()
      if (dateRangeFilter.value === 'TODAY') {
        matchesDate = (now - logTime) <= dayMs
      } else if (dateRangeFilter.value === '7DAYS') {
        matchesDate = (now - logTime) <= (7 * dayMs)
      } else if (dateRangeFilter.value === '30DAYS') {
        matchesDate = (now - logTime) <= (30 * dayMs)
      }
    }

    return matchesSearch && matchesType && matchesProduct && matchesDate
  })
})

// Filtered Price History Logs
const filteredPriceHistory = computed(() => {
  return priceHistoryLogs.value.filter(item => {
    const q = priceSearchQuery.value.toLowerCase().trim()
    const matchesSearch = !q || 
      (item.product_name && item.product_name.toLowerCase().includes(q)) ||
      (item.product_barcode && item.product_barcode.toLowerCase().includes(q)) ||
      (item.change_reason && item.change_reason.toLowerCase().includes(q)) ||
      (item.user_name && item.user_name.toLowerCase().includes(q))

    const matchesProduct = priceProductFilter.value === 'ALL' || item.product_id === priceProductFilter.value

    return matchesSearch && matchesProduct
  })
})

// Summary Stats
const totalMovementsCount = computed(() => logs.value.length)
const totalRestockedQty = computed(() => {
  return logs.value
    .filter(l => l.movement_type === 'RESTOCK' || l.movement_type === 'INITIAL_SEED')
    .reduce((sum, l) => sum + Math.abs(l.quantity_change), 0)
})
const totalDeductedQty = computed(() => {
  return logs.value
    .filter(l => l.movement_type === 'POS_SALE' || l.movement_type === 'BOM_DEDUCTION' || l.movement_type === 'STOCK_REDUCTION' || l.movement_type === 'WASTAGE')
    .reduce((sum, l) => sum + Math.abs(l.quantity_change), 0)
})
const lowStockProductsCount = computed(() => {
  return productStore.products.filter(p => (p.stock || 0) <= 10).length
})

function formatDate(val: any) {
  if (!val) return 'Recently'
  const date = new Date(val)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="h-full w-full bg-[#f8f9fa] flex flex-col overflow-hidden font-sans text-gray-800">
    
    <!-- Top Header Bar -->
    <div class="px-6 py-3.5 bg-white border-b border-gray-200 flex items-center justify-between shrink-0 shadow-2xs">
      <div class="flex items-center gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-black text-gray-900 tracking-tight">📦 Purchase Orders & Inventory Hub</h1>
            <span class="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-[#714B67] font-bold">
              Real-time Ledger
            </span>
          </div>
          <p class="text-xs text-gray-500 mt-0.5">Create purchase orders (PO), restock inventory, track stock reductions (+/-), price readjustments, and stock counts</p>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold ml-4">
          <button 
            @click="activeTab = 'register'"
            :class="[
              'px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'register' ? 'bg-[#714B67] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            ]"
          >
            <i class="fas fa-file-invoice"></i>
            <span>Purchase Order Register</span>
            <span v-if="batchCart.length > 0" class="w-5 h-5 bg-amber-400 text-gray-900 rounded-full text-[10px] flex items-center justify-center font-black">
              {{ batchCart.length }}
            </span>
          </button>

          <button 
            @click="activeTab = 'ledger'"
            :class="[
              'px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'ledger' ? 'bg-[#714B67] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            ]"
          >
            <i class="fas fa-boxes"></i>
            <span>Inventory Stock Audit</span>
          </button>

          <button 
            @click="activeTab = 'priceHistory'"
            :class="[
              'px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'priceHistory' ? 'bg-[#714B67] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            ]"
          >
            <i class="fas fa-chart-line"></i>
            <span>Price Fluctuation History</span>
          </button>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="fetchData"
          class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs flex items-center gap-1.5 border border-gray-300 transition-all cursor-pointer"
          title="Refresh Log Records"
        >
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- MAIN BODY CONTENT -->
    <div class="flex-1 overflow-hidden relative">

      <!-- ==================== TAB 1: PURCHASE ORDER (PO) REGISTER ==================== -->
      <div v-if="activeTab === 'register'" class="h-full flex w-full overflow-hidden">
        
        <!-- Left Pane: Product Selection Catalog Grid -->
        <div class="flex-1 flex flex-col border-r border-gray-200 bg-gray-50/50 overflow-hidden">
          
          <!-- Category & Search Bar -->
          <div class="p-4 bg-white border-b border-gray-200 space-y-3 shrink-0">
            <div class="flex items-center gap-3">
              <!-- Search Bar -->
              <div class="relative flex-1">
                <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input 
                  v-model="gridSearchQuery"
                  type="text" 
                  placeholder="🔍 Search product name, barcode (#BAR-101)..." 
                  class="w-full pl-10 pr-4 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#714B67] focus:bg-white"
                />
              </div>

              <!-- Low Stock Filter Button -->
              <button 
                @click="gridSearchQuery = gridSearchQuery === 'lowstock' ? '' : 'lowstock'"
                :class="[
                  'px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5',
                  gridSearchQuery === 'lowstock' ? 'bg-amber-500 text-white border-amber-600 shadow-xs' : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                ]"
              >
                <i class="fas fa-exclamation-triangle"></i>
                <span>Low Stock Items ({{ lowStockProductsCount }})</span>
              </button>
            </div>

            <!-- Category Pills -->
            <div class="flex gap-2 overflow-x-auto no-scrollbar pt-1">
              <button 
                v-for="cat in productStore.categories"
                :key="cat.id"
                @click="selectedCategory = cat.id"
                :class="[
                  'px-3.5 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer',
                  selectedCategory === cat.id ? 'bg-[#714B67] text-white shadow-2xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                ]"
              >
                {{ cat.name }}
              </button>
            </div>
          </div>

          <!-- Product Grid -->
          <div class="flex-1 p-4 overflow-y-auto">
            <div v-if="gridProducts.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
              <i class="fas fa-box-open text-4xl mb-2 text-gray-300"></i>
              <p class="font-bold text-sm">No products found</p>
            </div>
            <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div 
                v-for="p in gridProducts"
                :key="p.id"
                @click="addToBatchCart(p)"
                class="bg-white border border-gray-200 rounded-xl p-3.5 flex flex-col justify-between hover:border-[#714B67] hover:shadow-md transition-all cursor-pointer group relative"
              >
                <div>
                  <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-xs text-gray-900 group-hover:text-[#714B67] line-clamp-1">{{ p.name }}</span>
                    <span class="text-[10px] font-mono font-bold text-gray-400">#{{ p.barcode || 'N/A' }}</span>
                  </div>
                  <div class="text-[11px] text-gray-500 capitalize mb-2">{{ p.category }}</div>
                </div>

                <div class="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div class="flex flex-col">
                    <span class="text-[10px] text-gray-400 font-semibold uppercase">Current Stock</span>
                    <span 
                      class="font-mono font-black text-xs"
                      :class="(p.stock || 0) <= 10 ? 'text-amber-600 font-extrabold' : 'text-gray-800'"
                    >
                      {{ p.stock || 0 }} Pcs
                    </span>
                  </div>

                  <div class="flex flex-col text-right">
                    <span class="text-[10px] text-gray-400 font-semibold uppercase">Unit Price</span>
                    <span class="font-mono font-extrabold text-xs text-[#00A09D]">Rs {{ p.price }}</span>
                  </div>
                </div>

                <div class="mt-2.5 w-full py-1 bg-purple-50 group-hover:bg-[#714B67] text-[#714B67] group-hover:text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors">
                  <i class="fas fa-plus-circle"></i>
                  <span>Add to Purchase Order</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Right Pane: Purchase Order (PO) Register Drawer -->
        <aside class="w-[480px] bg-white border-l border-gray-200 flex flex-col h-full shrink-0 shadow-lg">
          
          <!-- Cart Header -->
          <div class="p-4 bg-[#714B67] text-white flex items-center justify-between shrink-0 shadow-2xs">
            <div class="flex items-center gap-2">
              <i class="fas fa-file-invoice text-amber-300 text-lg"></i>
              <div>
                <h2 class="font-bold text-sm">Purchase Order (PO) Register</h2>
                <p class="text-[10px] text-white/80">Restock inventory, record supplier deliveries, and readjust prices</p>
              </div>
            </div>

            <button 
              v-if="batchCart.length > 0"
              @click="clearBatchCart"
              class="text-xs px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white font-bold rounded transition-colors"
            >
              Clear Cart
            </button>
          </div>

          <!-- Session Reference Note & Vendor Selection Bar -->
          <div class="p-3 bg-purple-50/60 border-b border-purple-100 space-y-2 shrink-0 text-xs">
            <div class="flex items-center gap-2">
              <i class="fas fa-truck text-purple-700"></i>
              <label class="font-bold text-purple-950 shrink-0">Supplier / Vendor:</label>
              <select 
                v-model="selectedPoVendorId" 
                class="flex-1 px-2.5 py-1 bg-white border border-purple-200 rounded text-xs font-bold text-gray-900 focus:outline-none focus:border-[#714B67]"
              >
                <option v-for="v in vendors" :key="v.vendor_id" :value="v.vendor_id">
                  {{ v.name }} (Balance: Rs {{ v.balance.toFixed(2) }})
                </option>
              </select>
            </div>

            <div class="flex items-center gap-2">
              <i class="fas fa-sticky-note text-purple-700"></i>
              <label class="font-bold text-purple-950 shrink-0">PO Ref / Invoice #:</label>
              <input 
                v-model="globalBatchNote"
                type="text" 
                placeholder="e.g. Supplier PO #104 Delivery & Restock"
                class="flex-1 px-2.5 py-1 bg-white border border-purple-200 rounded text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#714B67]"
              />
            </div>
          </div>

          <!-- Cart Items List -->
          <div class="flex-1 overflow-y-auto p-3 space-y-3">
            <div v-if="batchCart.length === 0" class="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center">
              <i class="fas fa-cart-arrow-down text-5xl mb-3 text-gray-200"></i>
              <p class="font-bold text-sm text-gray-600">Purchase Order Cart is empty</p>
              <p class="text-xs text-gray-400 mt-1">Click products from the catalog grid to add them to your purchase order.</p>
            </div>

            <div 
              v-for="item in batchCart" 
              :key="item.product.id"
              class="border border-gray-200 rounded-xl p-3 bg-white hover:border-purple-300 shadow-2xs transition-all space-y-2.5"
            >
              <!-- Line Header: Name, Current Stock & Delete -->
              <div class="flex justify-between items-start">
                <div>
                  <h4 class="font-bold text-xs text-gray-900">{{ item.product.name }}</h4>
                  <span class="text-[10px] text-gray-500 font-mono">Current Stock: <strong class="text-gray-800">{{ item.product.stock || 0 }} Pcs</strong></span>
                </div>

                <div class="flex items-center gap-2">
                  <!-- Unit Mode Selector (Pcs vs Carton) -->
                  <div class="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-[10px] font-bold">
                    <button 
                      @click="item.unitMode = 'PCS'"
                      :class="[
                        'px-2 py-0.5 rounded transition-all cursor-pointer',
                        item.unitMode === 'PCS' ? 'bg-[#714B67] text-white' : 'text-gray-600'
                      ]"
                    >
                      Pcs
                    </button>
                    <button 
                      @click="item.unitMode = 'CARTON'"
                      :class="[
                        'px-2 py-0.5 rounded transition-all cursor-pointer',
                        item.unitMode === 'CARTON' ? 'bg-[#714B67] text-white' : 'text-gray-600'
                      ]"
                    >
                      📦 Carton
                    </button>
                  </div>

                  <button 
                    @click="removeFromBatchCart(item.product.id)"
                    class="text-gray-400 hover:text-rose-600 transition-colors p-1"
                    title="Remove from PO"
                  >
                    <i class="fas fa-trash-alt text-xs"></i>
                  </button>
                </div>
              </div>

              <!-- Line Controls Grid: Carton/Pcs, Cost Rate, Selling Rate -->
              <div class="grid grid-cols-4 gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100 text-xs">
                
                <!-- Direction Toggle (+ Add / - Reduce) -->
                <div>
                  <label class="block text-[10px] font-bold text-gray-600 mb-0.5">Mode (+/-)</label>
                  <button 
                    @click="toggleDirection(item)"
                    :class="[
                      'w-full py-1 rounded font-black text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer',
                      item.direction === '+' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-rose-600 text-white shadow-2xs'
                    ]"
                  >
                    <span>{{ item.direction === '+' ? '🟢 Restock' : '🔴 Reduce' }}</span>
                  </button>
                </div>

                <!-- Qty / Carton Input -->
                <div v-if="item.unitMode === 'CARTON'">
                  <label class="block text-[10px] font-bold text-gray-600 mb-0.5">Carton Qty</label>
                  <input 
                    v-model.number="item.cartons"
                    type="number"
                    min="1"
                    class="w-full px-2 py-1 bg-white border border-gray-300 rounded font-mono font-bold text-xs text-gray-900 focus:outline-none focus:border-[#714B67]"
                  />
                </div>
                <div v-else>
                  <label class="block text-[10px] font-bold text-gray-600 mb-0.5">Pcs Qty</label>
                  <input 
                    v-model.number="item.pcs"
                    type="number"
                    min="1"
                    class="w-full px-2 py-1 bg-white border border-gray-300 rounded font-mono font-bold text-xs text-gray-900 focus:outline-none focus:border-[#714B67]"
                  />
                </div>

                <!-- Cost Price Input (Purchasing Rate) -->
                <div>
                  <label class="block text-[10px] font-bold text-gray-600 mb-0.5">
                    {{ item.unitMode === 'CARTON' ? 'Carton Cost (Rs)' : 'Cost Rate (Rs)' }}
                  </label>
                  <input 
                    v-model.number="item.costPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full px-2 py-1 bg-white border border-purple-300 rounded font-mono font-bold text-xs text-purple-950 focus:outline-none focus:border-[#714B67]"
                  />
                </div>

                <!-- Selling Retail Price Input -->
                <div>
                  <label class="block text-[10px] font-bold text-gray-600 mb-0.5">Selling Rate (Rs)</label>
                  <input 
                    v-model.number="item.newPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full px-2 py-1 bg-white border border-gray-300 rounded font-mono font-bold text-xs text-gray-900 focus:outline-none focus:border-[#714B67]"
                  />
                </div>
              </div>

              <!-- Carton Pack Size Row if Carton Mode -->
              <div v-if="item.unitMode === 'CARTON'" class="p-2 bg-purple-50/50 rounded-lg border border-purple-100 flex items-center justify-between text-[11px] font-mono">
                <div class="flex items-center gap-1">
                  <span class="text-purple-900 font-sans font-bold">Pack Size:</span>
                  <input 
                    v-model.number="item.packSize"
                    type="number" 
                    min="1"
                    class="w-16 px-1.5 py-0.5 bg-white border border-purple-200 rounded font-bold text-center text-xs text-purple-950"
                  />
                  <span class="text-gray-500 font-sans">Pcs / Carton</span>
                </div>
                <div>
                  <span class="text-gray-500 font-sans">Cost / Pc: </span>
                  <strong class="text-purple-950 font-bold">Rs {{ (item.costPrice / (item.packSize || 1)).toFixed(2) }}</strong>
                </div>
              </div>

              <!-- Cost Rate & Margin Reference Bar -->
              <div class="flex items-center justify-between text-[10px] text-gray-500 px-1">
                <span>Last Buying Cost: <strong class="text-purple-900 font-mono">Rs {{ item.product.cost_price || 0 }}</strong></span>
                <span class="font-bold" :class="(item.newPrice - (item.unitMode === 'CARTON' ? (item.costPrice / (item.packSize || 1)) : item.costPrice)) >= 0 ? 'text-emerald-700' : 'text-rose-600'">
                  Margin / Pc: Rs {{ (item.newPrice - (item.unitMode === 'CARTON' ? (item.costPrice / (item.packSize || 1)) : item.costPrice)).toFixed(2) }}
                </span>
              </div>

              <!-- Line Item Note & Expected Stock Preview -->
              <div class="flex items-center justify-between text-[11px] pt-1 border-t border-gray-100">
                <input 
                  v-model="item.note"
                  type="text" 
                  placeholder="Line note (e.g. Stock adjustment)..." 
                  class="flex-1 px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-[11px] text-gray-700 mr-3"
                />

                <div class="text-right shrink-0 font-mono">
                  <span class="text-gray-400 font-sans font-semibold">Total Pcs: </span>
                  <strong class="font-extrabold text-xs text-purple-900">
                    {{ item.unitMode === 'CARTON' ? (item.cartons * item.packSize) : item.pcs }} Pcs
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <!-- Cart Summary & Submission Footer -->
          <div class="p-4 bg-gray-50 border-t border-gray-200 space-y-3 shrink-0">
            <div class="space-y-1.5 text-xs text-gray-700 font-semibold">
              <div class="flex justify-between items-center">
                <span>Total Line Items:</span>
                <span class="font-mono font-bold text-gray-900">{{ batchSummary.totalItems }} Items</span>
              </div>

              <div class="flex justify-between items-center text-emerald-700">
                <span>Total Restocked Stock (+):</span>
                <span class="font-mono font-bold">+{{ batchSummary.totalAddedQty }} Pcs</span>
              </div>

              <div v-if="batchSummary.totalReducedQty > 0" class="flex justify-between items-center text-rose-700">
                <span>Total Reduced / Wastage (-):</span>
                <span class="font-mono font-bold">-{{ batchSummary.totalReducedQty }} Pcs</span>
              </div>

              <div class="flex justify-between items-center text-sm font-extrabold text-gray-900 pt-1 border-t border-gray-200">
                <span>PO Bill Total (Cost Valuation):</span>
                <span class="font-mono text-[#00A09D]">Rs {{ batchSummary.totalCostValuation.toFixed(2) }}</span>
              </div>
            </div>

            <button 
              @click="requestSubmitBatch"
              :disabled="batchCart.length === 0 || isSubmittingBatch"
              :class="[
                'w-full py-3 rounded-xl font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer',
                batchCart.length > 0 ? 'bg-[#714B67] hover:bg-[#5c3d54] text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              ]"
            >
              <i v-if="isSubmittingBatch" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-file-invoice"></i>
              <span>Confirm & Submit Purchase Order (PO)</span>
            </button>
          </div>

        </aside>

      </div>

      <!-- ==================== TAB 2: TRACEABLE INVENTORY AUDIT HISTORY LEDGER ==================== -->
      <div v-else-if="activeTab === 'ledger'" class="h-full p-6 overflow-y-auto space-y-6">
        
        <!-- Summary Stat Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Stock Logs</span>
              <div class="text-2xl font-black text-gray-900 mt-1 font-mono">{{ totalMovementsCount }}</div>
            </div>
            <div class="w-10 h-10 rounded-xl bg-purple-100 text-[#714B67] flex items-center justify-center text-lg font-bold">
              <i class="fas fa-history"></i>
            </div>
          </div>

          <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Restocked</span>
              <div class="text-2xl font-black text-emerald-700 mt-1 font-mono">+{{ totalRestockedQty.toFixed(0) }} Pcs</div>
            </div>
            <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold">
              <i class="fas fa-arrow-down"></i>
            </div>
          </div>

          <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Deducted / Sales</span>
              <div class="text-2xl font-black text-rose-700 mt-1 font-mono">-{{ totalDeductedQty.toFixed(0) }} Pcs</div>
            </div>
            <div class="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg font-bold">
              <i class="fas fa-shopping-cart"></i>
            </div>
          </div>

          <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Low Stock Items</span>
              <div class="text-2xl font-black text-amber-700 mt-1 font-mono">{{ lowStockProductsCount }}</div>
            </div>
            <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-bold">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
          </div>
        </div>

        <!-- Filter Controls Bar -->
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs">
          <!-- Search Input -->
          <div class="relative flex-1 min-w-[280px]">
            <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Search by product name, barcode (#OD001), batch (#BATCH-1234), or operator..." 
              class="w-full pl-10 pr-4 py-2 bg-slate-50 border border-gray-300 rounded-lg font-medium text-gray-900 focus:outline-none focus:border-[#714B67] focus:bg-white"
            />
          </div>

          <!-- Filter Controls -->
          <div class="flex items-center gap-3">
            <!-- Movement Type Filter -->
            <div class="flex items-center gap-1.5">
              <label class="font-bold text-gray-600">Movement:</label>
              <select v-model="selectedTypeFilter" class="border border-gray-300 rounded-lg px-3 py-2 bg-white font-semibold">
                <option value="ALL">All Movement Types</option>
                <option value="RESTOCK">🟢 Restock / Stock In</option>
                <option value="POS_SALE">🔴 POS Sale Deduction</option>
                <option value="BOM_DEDUCTION">🟣 BOM Ingredient Deduction</option>
                <option value="STOCK_REDUCTION">🟠 Stock Reduction</option>
                <option value="WASTAGE">⚠️ Wastage / Loss</option>
                <option value="INITIAL_SEED">⚙️ Initial Seed</option>
              </select>
            </div>

            <!-- Date Range Filter -->
            <div class="flex items-center gap-1.5">
              <label class="font-bold text-gray-600">Time Range:</label>
              <select v-model="dateRangeFilter" class="border border-gray-300 rounded-lg px-3 py-2 bg-white font-semibold">
                <option value="ALL">All Time</option>
                <option value="TODAY">Today (Last 24h)</option>
                <option value="7DAYS">Last 7 Days</option>
                <option value="30DAYS">Last 30 Days</option>
              </select>
            </div>

            <!-- Product Filter -->
            <div class="flex items-center gap-1.5">
              <label class="font-bold text-gray-600">Product:</label>
              <select v-model="selectedProductFilter" class="border border-gray-300 rounded-lg px-3 py-2 bg-white font-semibold max-w-[180px] truncate">
                <option value="ALL">All Products</option>
                <option v-for="p in productStore.products" :key="p.id" :value="p.id">
                  {{ p.name }} (Stock: {{ p.stock }})
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Inventory History Table -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-xs">
          <div v-if="isLoading" class="p-12 text-center text-gray-400 flex flex-col items-center">
            <i class="fas fa-circle-notch fa-spin text-3xl text-[#714B67] mb-3"></i>
            <span class="font-bold">Loading Inventory Ledger...</span>
          </div>

          <div v-else-if="filteredLogs.length === 0" class="p-12 text-center text-gray-400 flex flex-col items-center">
            <i class="fas fa-boxes text-4xl text-gray-300 mb-3"></i>
            <p class="font-bold text-gray-600">No stocking history records found.</p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead class="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th class="py-3.5 px-4">Date & Time</th>
                  <th class="py-3.5 px-4">Product Name</th>
                  <th class="py-3.5 px-4">Barcode / SKU</th>
                  <th class="py-3.5 px-4">Movement Type</th>
                  <th class="py-3.5 px-4 text-right">Qty Change</th>
                  <th class="py-3.5 px-4 text-right">Stock After</th>
                  <th class="py-3.5 px-4">Reference Note</th>
                  <th class="py-3.5 px-4">Operator</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 font-medium">
                <tr v-for="item in filteredLogs" :key="item.log_id" class="hover:bg-slate-50/80 transition-colors">
                  <td class="py-3 px-4 font-mono text-gray-700 font-semibold whitespace-nowrap">{{ formatDate(item.created_at) }}</td>
                  <td class="py-3 px-4 font-bold text-gray-900">{{ item.product_name }}</td>
                  <td class="py-3 px-4 font-mono text-gray-500 font-bold">{{ item.product_barcode ? `#${item.product_barcode}` : '-' }}</td>
                  
                  <td class="py-3 px-4 whitespace-nowrap">
                    <span 
                      v-if="item.movement_type === 'RESTOCK' || item.movement_type === 'INITIAL_SEED'"
                      class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center w-fit gap-1"
                    >
                      <i class="fas fa-arrow-down text-emerald-600"></i>
                      <span>{{ item.movement_type === 'INITIAL_SEED' ? 'INITIAL SEED' : 'RESTOCK / IN' }}</span>
                    </span>

                    <span 
                      v-else-if="item.movement_type === 'POS_SALE'"
                      class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300 flex items-center w-fit gap-1"
                    >
                      <i class="fas fa-shopping-cart text-rose-600"></i>
                      <span>POS SALE</span>
                    </span>

                    <span 
                      v-else-if="item.movement_type === 'WASTAGE'"
                      class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 flex items-center w-fit gap-1"
                    >
                      <i class="fas fa-trash-alt text-amber-700"></i>
                      <span>WASTAGE / LOSS</span>
                    </span>

                    <span 
                      v-else
                      class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-300 flex items-center w-fit gap-1"
                    >
                      <i class="fas fa-sliders-h text-blue-600"></i>
                      <span>ADJUSTMENT</span>
                    </span>
                  </td>

                  <td class="py-3 px-4 font-mono font-black text-right text-sm whitespace-nowrap" :class="item.quantity_change > 0 ? 'text-emerald-600' : 'text-rose-600'">
                    {{ item.quantity_change > 0 ? `+${item.quantity_change}` : item.quantity_change }} Pcs
                  </td>
                  <td class="py-3 px-4 font-mono font-bold text-gray-900 text-right text-sm whitespace-nowrap">{{ item.quantity_after }} Pcs</td>
                  <td class="py-3 px-4 text-gray-600 text-xs">{{ item.reference_note || '-' }}</td>
                  <td class="py-3 px-4 text-gray-700 font-semibold">{{ item.user_name || 'System' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ==================== TAB 3: ITEM PRICE FLUCTUATION HISTORY LEDGER ==================== -->
      <div v-else-if="activeTab === 'priceHistory'" class="h-full p-6 overflow-y-auto space-y-6">
        
        <!-- Header Banner -->
        <div class="bg-gradient-to-r from-[#714B67] to-purple-900 text-white p-5 rounded-2xl shadow-md flex items-center justify-between">
          <div>
            <h2 class="text-lg font-black tracking-tight flex items-center gap-2">
              <i class="fas fa-chart-line text-amber-300"></i>
              <span>Item Price Fluctuation Audit Ledger</span>
            </h2>
            <p class="text-xs text-white/80 mt-1">Tracks every historical price revision recorded during inventory restocking sessions or manual price edits.</p>
          </div>

          <div class="text-right">
            <span class="text-xs text-white/70 uppercase font-bold tracking-wider block">Total Price Revisions</span>
            <span class="text-2xl font-black font-mono text-amber-300">{{ priceHistoryLogs.length }} Changes</span>
          </div>
        </div>

        <!-- Filter Controls Bar -->
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between gap-4 text-xs">
          <div class="relative flex-1 min-w-[280px]">
            <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input 
              v-model="priceSearchQuery"
              type="text"
              placeholder="Search by product name, barcode (#BAR-101), batch reference, or user..."
              class="w-full pl-10 pr-4 py-2 bg-slate-50 border border-gray-300 rounded-lg font-medium text-gray-900 focus:outline-none focus:border-[#714B67] focus:bg-white"
            />
          </div>

          <div class="flex items-center gap-1.5">
            <label class="font-bold text-gray-600">Product:</label>
            <select v-model="priceProductFilter" class="border border-gray-300 rounded-lg px-3 py-2 bg-white font-semibold max-w-[220px] truncate">
              <option value="ALL">All Products</option>
              <option v-for="p in productStore.products" :key="p.id" :value="p.id">
                {{ p.name }} (Current: Rs {{ p.price }})
              </option>
            </select>
          </div>
        </div>

        <!-- Price Fluctuation History Table -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-xs">
          <div v-if="filteredPriceHistory.length === 0" class="p-12 text-center text-gray-400 flex flex-col items-center">
            <i class="fas fa-tag text-4xl text-gray-300 mb-3"></i>
            <p class="font-bold text-gray-600">No price fluctuation records logged yet.</p>
            <p class="text-xs text-gray-400 mt-1">Price revisions made during restocking sessions will be tracked and displayed here dynamically.</p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead class="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th class="py-3.5 px-4">Date & Time</th>
                  <th class="py-3.5 px-4">Product Name</th>
                  <th class="py-3.5 px-4">Barcode / SKU</th>
                  <th class="py-3.5 px-4 text-right">Old Price</th>
                  <th class="py-3.5 px-4 text-right">New Price</th>
                  <th class="py-3.5 px-4 text-right">Revision Delta</th>
                  <th class="py-3.5 px-4">Reason / Batch Ref</th>
                  <th class="py-3.5 px-4">Operator User</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 font-medium">
                <tr v-for="item in filteredPriceHistory" :key="item.history_id" class="hover:bg-slate-50/80 transition-colors">
                  <td class="py-3 px-4 font-mono text-gray-700 font-semibold whitespace-nowrap">{{ formatDate(item.created_at) }}</td>
                  <td class="py-3 px-4 font-bold text-gray-900">{{ item.product_name }}</td>
                  <td class="py-3 px-4 font-mono text-gray-500 font-bold">{{ item.product_barcode ? `#${item.product_barcode}` : '-' }}</td>
                  <td class="py-3 px-4 font-mono text-gray-500 text-right">Rs {{ item.old_price.toFixed(2) }}</td>
                  <td class="py-3 px-4 font-mono font-bold text-gray-900 text-right">Rs {{ item.new_price.toFixed(2) }}</td>
                  <td class="py-3 px-4 font-mono font-black text-right text-xs whitespace-nowrap">
                    <span 
                      class="px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-0.5 font-bold"
                      :class="item.price_delta >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'"
                    >
                      <span>{{ item.price_delta >= 0 ? '↑' : '↓' }}</span>
                      <span>Rs {{ Math.abs(item.price_delta).toFixed(2) }} ({{ item.price_delta_percent >= 0 ? '+' : '' }}{{ item.price_delta_percent.toFixed(1) }}%)</span>
                    </span>
                  </td>
                  <td class="py-3 px-4 text-gray-600 text-xs">{{ item.change_reason || '-' }}</td>
                  <td class="py-3 px-4 text-gray-700 font-semibold">{{ item.user_name || 'Store Manager' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>

    <!-- Manager Authorization PIN Modal -->
    <ManagerPinModal 
      :show="isManagerPinModalOpen" 
      title="Manager Authorization Required for Batch Stocking"
      actionDescription="Only Store Manager can adjust inventory stock levels and revise unit prices. Please enter Manager PIN code."
      @close="isManagerPinModalOpen = false"
      @authorized="executeSubmitBatch"
    />

    <!-- Vendor Payment & Debit Note Settlement Modal (Post-PO Prompt) -->
    <VendorPaymentModal 
      :show="isVendorPaymentModalOpen"
      :initialVendorId="selectedPoVendorId"
      :initialPoId="submittedPoId"
      :initialAmount="submittedPoAmount"
      @close="isVendorPaymentModalOpen = false"
      @payment-success="fetchData"
    />

  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
