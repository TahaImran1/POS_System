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
import { useProductStore } from '../stores/useProductStore'
import { useAuthStore } from '../stores/useAuthStore'
import { usePurchaseOrderStore } from '../stores/usePurchaseOrderStore'
import ManagerPinModal from '../components/modals/ManagerPinModal.vue'
import { useToast } from '../composables/useToast'
import { 
  getVendors, 
  getVendorPayments, 
  getDamagedExpiredHoldQueue, 
  getVendorPurchases,
  type Vendor, 
  type VendorPaymentRecord, 
  type DamagedExpiredHoldItem,
  type VendorPurchaseRecord 
} from '../services/vendorService'
import VendorPaymentModal from '../components/modals/VendorPaymentModal.vue'
import PurchaseOrderProductCard from '../components/PurchaseOrderProductCard.vue'
import PurchaseOrderCartItem from '../components/PurchaseOrderCartItem.vue'
import PurchaseOrderNumpad from '../components/PurchaseOrderNumpad.vue'

const productStore = useProductStore()
const authStore = useAuthStore()
const poStore = usePurchaseOrderStore()
const toast = useToast()

const activeTab = ref<'register' | 'ledger' | 'priceHistory' | 'vendors'>('register')

const logs = ref<InventoryLogItem[]>([])
const priceHistoryLogs = ref<PriceHistoryLogItem[]>([])
const vendors = ref<Vendor[]>([])
const vendorPayments = ref<VendorPaymentRecord[]>([])
const vendorPurchases = ref<VendorPurchaseRecord[]>([])
const holdQueue = ref<DamagedExpiredHoldItem[]>([])
const selectedPoVendorId = ref<string>('')
const vendorSearchQuery = ref('')
const expandedVendorId = ref<string | null>(null)
const isLoading = ref(true)

function toggleVendorExpand(vendorId: string) {
  if (expandedVendorId.value === vendorId) {
    expandedVendorId.value = null
  } else {
    expandedVendorId.value = vendorId
  }
}

function getPaymentsForVendor(vendorId: string): VendorPaymentRecord[] {
  return vendorPayments.value.filter(p => p.vendor_id === vendorId)
}

function getVendorTotalPaid(vendorId: string): number {
  return getPaymentsForVendor(vendorId).reduce((sum, p) => sum + p.amount + p.debit_note_amount, 0)
}

function getPurchasesForVendor(vendorId: string): VendorPurchaseRecord[] {
  const list = [...vendorPurchases.value.filter(p => p.vendor_id === vendorId)]
  
  const v = vendors.value.find(x => x.vendor_id === vendorId)
  if (!v) return list

  const itemizedSum = list.reduce((sum, p) => sum + (p.total_cost || 0), 0)
  const totalPaid = getVendorTotalPaid(vendorId)
  const totalAccountedInvoiced = (v.balance || 0) + totalPaid
  const unitemizedDiff = Number((totalAccountedInvoiced - itemizedSum).toFixed(2))

  // If there is an opening payable or unitemized historic restock balance, include it as an explicit ledger line
  if (unitemizedDiff > 0.01) {
    list.push({
      purchase_id: `opening_${vendorId}`,
      vendor_id: vendorId,
      po_id: 'PO-OPENING',
      product_id: 'HISTORIC_PAYABLE',
      product_name: 'Opening Payable / Historic Restock Balance',
      product_barcode: 'N/A',
      quantity: 1,
      uom_name: 'Batch',
      uom_multiplier: 1,
      unit_cost: unitemizedDiff,
      total_cost: unitemizedDiff,
      reference_note: 'Unitemized opening payable balance / previous restock session credit',
      user_name: 'System / Prior Session',
      created_at: Number(v.created_at || (Date.now() - 86400000))
    })
  }

  // Always keep sorted with latest purchases first
  return list.sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))
}

function getVendorTotalPurchased(vendorId: string): number {
  return getPurchasesForVendor(vendorId).reduce((sum, p) => sum + p.total_cost, 0)
}

async function startPurchaseOrderForVendor(vendor: Vendor) {
  poStore.selectedVendorId = vendor.vendor_id
  if (poStore.items.length > 0) {
    await poStore.assignVendorToAll(vendor.vendor_id)
  }
  activeTab.value = 'register'
  toast.info(`Purchase Order started with "${vendor.name}". Stock purchases will be billed to this supplier.`)
}

// Vendor Payment Settlement Modal State (Decoupled on-demand settlement)
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
const isSubmittingBatch = ref(false)
const gridSearchQuery = ref('')
const selectedCategory = ref('all')

const totalOutstandingPayable = computed(() => {
  return vendors.value
    .filter(v => v.balance > 0)
    .reduce((sum, v) => sum + v.balance, 0)
})

const pendingHoldClaimsCount = computed(() => holdQueue.value.length)
const pendingHoldClaimsAmount = computed(() => {
  return holdQueue.value.reduce((sum, h) => sum + (h.quantity * h.cost_price), 0)
})

const filteredVendors = computed(() => {
  if (!vendorSearchQuery.value.trim()) return vendors.value
  const q = vendorSearchQuery.value.toLowerCase()
  return vendors.value.filter(v => 
    v.name.toLowerCase().includes(q) ||
    (v.company_name && v.company_name.toLowerCase().includes(q)) ||
    (v.phone && v.phone.toLowerCase().includes(q))
  )
})

function openVendorPayment(vendorId?: string, defaultAmount?: number, poId?: string) {
  selectedPoVendorId.value = vendorId || (vendors.value[0]?.vendor_id || '')
  submittedPoId.value = poId || ''
  submittedPoAmount.value = defaultAmount !== undefined ? defaultAmount : 0
  isVendorPaymentModalOpen.value = true
}

async function fetchData() {
  isLoading.value = true
  try {
    await productStore.loadFromDb()
    await poStore.initStore()
    logs.value = await getAllInventoryLogs()
    priceHistoryLogs.value = await getAllPriceHistory()
    vendors.value = await getVendors()
    vendorPayments.value = await getVendorPayments()
    vendorPurchases.value = await getVendorPurchases()
    holdQueue.value = await getDamagedExpiredHoldQueue('PENDING_CLAIM')
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

// Trigger Batch Confirmation
function requestSubmitBatch() {
  const validItems = poStore.items.filter(item => item.quantity > 0)
  if (validItems.length === 0) {
    toast.warning('Purchase Order cart has no items with quantity greater than 0. Please set quantities before submitting.')
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
    
    const activeVendorId = (poStore.selectedVendorId && poStore.selectedVendorId.trim()) || 
      (poStore.items.find(i => i.vendor_id)?.vendor_id) || 
      undefined

    const lines: BatchAdjustmentLine[] = poStore.items
      .filter(item => item.quantity > 0)
      .map(item => {
        const multiplier = item.uom_multiplier || 1
        const rawQty = item.quantity * multiplier
        const finalQtyChange = item.direction === '+' ? Math.abs(rawQty) : -Math.abs(rawQty)
        const movType = item.direction === '+' 
          ? 'RESTOCK' 
          : (item.note?.toLowerCase().includes('damage') || item.note?.toLowerCase().includes('wastage') ? 'WASTAGE' : 'STOCK_REDUCTION')

      return {
        product_id: item.product.id,
        qty_change: finalQtyChange,
        cost_price: item.costPrice / multiplier,
        new_price: item.newPrice / multiplier,
        uom_name: item.uom_name,
        uom_multiplier: multiplier,
        purchase_qty: item.quantity,
        unit_cost: item.costPrice,
        total_cost: item.quantity * item.costPrice,
        reference_note: `${item.note || 'PO Restock'} (${item.quantity} ${item.uom_name} @ Rs ${item.costPrice.toFixed(2)})`,
        movement_type: movType,
        vendor_id: item.vendor_id || activeVendorId
      }
    })

    const poCostTotal = Math.abs(poStore.totalCost)
    const batchId = await processBatchInventoryAdjustment(
      lines, 
      operatorName, 
      poStore.invoiceRef, 
      'NODE_POS_001', 
      activeVendorId
    )
    
    const vName = vendors.value.find(v => v.vendor_id === activeVendorId)?.name
    toast.success(
      `Successfully received PO #${batchId}! Stock added to inventory and Rs ${poCostTotal.toFixed(2)} recorded on ${vName ? vName + ' Payable' : 'Vendor Ledger'}.`
    )
    poStore.clearCart()
    await fetchData()
  } catch (e: any) {
    toast.error('Failed to submit Purchase Order: ' + (e.message || e))
  } finally {
    isSubmittingBatch.value = false
  }
}

const lowStockProductsCount = computed(() => {
  return productStore.products.filter(p => (p.stock || 0) <= 10).length
})

// Grid Products Filter
const gridProducts = computed(() => {
  return productStore.products.filter(p => {
    if (gridSearchQuery.value === 'lowstock') {
      return (p.stock || 0) <= 10
    }
    const matchesCat = selectedCategory.value === 'all' || p.category === selectedCategory.value
    const q = gridSearchQuery.value.toLowerCase().trim()
    const matchesSearch = !q || 
      p.name.toLowerCase().includes(q) || 
      (p.barcode && p.barcode.toLowerCase().includes(q)) || 
      (p.sku && p.sku.toLowerCase().includes(q))
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
    <div class="px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between shrink-0 shadow-2xs">
      <div class="flex items-center gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-lg font-black text-gray-900 tracking-tight">📦 Purchase Orders & Inventory Hub</h1>
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
            <span v-if="poStore.items.length > 0" class="w-5 h-5 bg-amber-400 text-gray-900 rounded-full text-[10px] flex items-center justify-center font-black">
              {{ poStore.items.length }}
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

          <button 
            @click="activeTab = 'vendors'"
            :class="[
              'px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'vendors' ? 'bg-[#714B67] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            ]"
          >
            <i class="fas fa-truck"></i>
            <span>Vendors & Payables</span>
            <span v-if="totalOutstandingPayable > 0" class="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-mono font-black shadow-xs">
              Rs {{ Math.round(totalOutstandingPayable).toLocaleString() }}
            </span>
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
        
        <!-- Left Pane: PO Cart / Order Pad & Numpad (Matching Sale Order LeftPane) -->
        <aside class="w-[440px] bg-white border-r border-gray-200 flex flex-col h-full shrink-0 shadow-lg z-10 overflow-hidden">
          
          <!-- Header -->
          <div class="px-4 py-2.5 bg-[#714B67] text-white flex items-center justify-between shrink-0 shadow-2xs">
            <div class="flex items-center gap-2">
              <i class="fas fa-file-invoice text-amber-300 text-base"></i>
              <div>
                <h2 class="font-extrabold text-xs tracking-tight">Purchase Order Lines ({{ poStore.items.length }})</h2>
                <p class="text-[9px] text-white/80">Select product & adjust Qty, Cost Rate, Sell Rate</p>
              </div>
            </div>

            <button 
              v-if="poStore.items.length > 0"
              @click="poStore.clearCart"
              class="text-[11px] px-2 py-0.5 bg-white/20 hover:bg-white/30 text-white font-bold rounded transition-colors cursor-pointer"
              title="Clear all items from PO Cart"
            >
              Clear Cart
            </button>
          </div>

          <!-- Order Lines List (Scrollable) -->
          <div class="flex-1 min-h-0 overflow-y-auto bg-white divide-y divide-gray-100">
            <div v-if="poStore.items.length === 0" class="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center">
              <i class="fas fa-cart-arrow-down text-5xl mb-3 text-gray-200"></i>
              <p class="font-bold text-sm text-gray-600">Purchase Order Cart is empty</p>
              <p class="text-xs text-gray-400 mt-1 max-w-xs">
                Click any product card to add, or hover to select specific UOM tier (Piece, Pack, Carton).
              </p>
            </div>

            <PurchaseOrderCartItem 
              v-for="item in poStore.items" 
              :key="item.id" 
              :item="item" 
            />
          </div>

          <!-- Summary Box (Matching Sale Order Summary) -->
          <div class="px-3 py-1.5 bg-gray-50/90 border-t border-gray-200 shrink-0 text-xs select-none">
            <div class="flex justify-between items-center text-gray-600 font-medium text-[11px] mb-0.5">
              <span>Items: <strong class="font-mono text-gray-800">{{ poStore.items.length }}</strong> lines ({{ poStore.totalBasePieces }} Pcs)</span>
              <span>Retail Value: <strong class="font-mono text-teal-700">Rs {{ poStore.totalSellingValue.toFixed(2) }}</strong></span>
            </div>
            <div class="flex justify-between items-center text-sm font-extrabold text-gray-900 pt-1 border-t border-gray-200/80">
              <div class="flex items-center gap-1.5">
                <span>Total PO Cost:</span>
                <span 
                  class="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono"
                  :class="poStore.estimatedMarginPercent >= 20 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'"
                >
                  Est. Margin: {{ poStore.estimatedMarginPercent }}%
                </span>
              </div>
              <span class="font-mono text-[#714B67] text-base font-black">
                Rs {{ poStore.totalCost.toFixed(2) }}
              </span>
            </div>
          </div>

          <!-- PO Interactive Numpad & Rate Controls -->
          <PurchaseOrderNumpad @submit-po="requestSubmitBatch" />
        </aside>

        <!-- Right Pane: Category Filter & Product Catalog Grid (Matching Sale Order RightPane) -->
        <section class="flex-1 flex flex-col bg-[#e9ecef]/50 h-full overflow-hidden">
          
          <!-- Category & Search Bar Header -->
          <div class="p-3 bg-white border-b border-gray-200 space-y-2.5 shrink-0">
            <div class="flex items-center gap-3">
              <!-- Search Bar -->
              <div class="relative flex-1">
                <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                <input 
                  v-model="gridSearchQuery"
                  type="text" 
                  placeholder="🔍 Search product name, barcode (#BAR-101), SKU..." 
                  class="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#714B67] focus:bg-white"
                />
              </div>

              <!-- Low Stock Filter Button -->
              <button 
                @click="gridSearchQuery = gridSearchQuery === 'lowstock' ? '' : 'lowstock'"
                :class="[
                  'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
                  gridSearchQuery === 'lowstock' ? 'bg-amber-500 text-white border-amber-600 shadow-xs' : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                ]"
              >
                <i class="fas fa-exclamation-triangle"></i>
                <span>Low Stock ({{ lowStockProductsCount }})</span>
              </button>
            </div>

            <!-- Category Tabs -->
            <div class="flex gap-2 overflow-x-auto no-scrollbar pt-0.5">
              <button 
                v-for="cat in productStore.categories"
                :key="cat.id"
                @click="selectedCategory = cat.id"
                :class="[
                  'px-3.5 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer select-none border',
                  selectedCategory === cat.id ? 'bg-[#714B67] text-white border-[#714B67] shadow-xs' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                ]"
              >
                {{ cat.name }}
              </button>
            </div>
          </div>

          <!-- Product Cards Grid with Hover UOM Selector -->
          <div class="flex-1 p-3 overflow-y-auto">
            <div v-if="gridProducts.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
              <i class="fas fa-box-open text-4xl mb-2 text-gray-300"></i>
              <p class="font-bold text-sm">No products found</p>
              <p class="text-xs text-gray-400 mt-1">Try another category or clear search filter</p>
            </div>
            <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <PurchaseOrderProductCard 
                v-for="p in gridProducts" 
                :key="p.id" 
                :product="p" 
              />
            </div>
          </div>
        </section>

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

      <!-- ==================== TAB 4: VENDORS & ACCOUNTS PAYABLE LEDGER ==================== -->
      <div v-else-if="activeTab === 'vendors'" class="h-full p-6 overflow-y-auto space-y-6">
        
        <!-- Summary Stat Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Card 1: Total Accounts Payable -->
          <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Accounts Payable</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Debt Owed</span>
              </div>
              <h3 class="text-2xl font-black text-rose-600 font-mono mt-1">
                Rs {{ totalOutstandingPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </h3>
              <p class="text-xs text-gray-400 mt-1">Accumulated unpaid liability across all received POs</p>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl">
              <i class="fas fa-file-invoice-dollar"></i>
            </div>
          </div>

          <!-- Card 2: Registered Suppliers -->
          <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Registered Suppliers</span>
              <h3 class="text-2xl font-black text-purple-950 font-mono mt-1">
                {{ vendors.length }} Vendors
              </h3>
              <p class="text-xs text-gray-400 mt-1">Direct manufacturers & wholesale distribution accounts</p>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center text-xl">
              <i class="fas fa-truck-loading"></i>
            </div>
          </div>

          <!-- Card 3: Damaged / Expired Hold Claims -->
          <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Debit Note Claims</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">Pending Return</span>
              </div>
              <h3 class="text-2xl font-black text-amber-600 font-mono mt-1">
                Rs {{ pendingHoldClaimsAmount.toFixed(2) }}
              </h3>
              <p class="text-xs text-gray-400 mt-1">{{ pendingHoldClaimsCount }} damaged/expired goods ready for claim deduction</p>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
              <i class="fas fa-biohazard"></i>
            </div>
          </div>
        </div>

        <!-- Section 1: Supplier Directory & Accounts Ledger -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div class="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
            <div>
              <h3 class="font-extrabold text-sm text-gray-900 tracking-tight flex items-center gap-2">
                <i class="fas fa-users text-[#714B67]"></i>
                <span>Supplier Ledger & Balances</span>
              </h3>
              <p class="text-xs text-gray-500 mt-0.5">Stock is received into inventory on credit terms; pay suppliers when invoices mature</p>
            </div>

            <div class="flex items-center gap-3">
              <!-- Search Bar -->
              <div class="relative w-64">
                <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                <input 
                  v-model="vendorSearchQuery"
                  type="text" 
                  placeholder="Search supplier, company, phone..."
                  class="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#714B67]"
                />
              </div>

              <!-- Pay Any Vendor Button -->
              <button 
                @click="openVendorPayment()"
                class="px-3 py-1.5 bg-[#714B67] hover:bg-[#5a3a52] text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <i class="fas fa-plus"></i>
                <span>Record Vendor Payment</span>
              </button>
            </div>
          </div>

          <!-- Vendors Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead class="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th class="py-3.5 px-4">Supplier / Vendor</th>
                  <th class="py-3.5 px-4">Company / Brand</th>
                  <th class="py-3.5 px-4">Contact Info</th>
                  <th class="py-3.5 px-4">Address</th>
                  <th class="py-3.5 px-4 text-right">Current Balance (Payable)</th>
                  <th class="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 font-medium text-xs">
                <tr v-if="filteredVendors.length === 0">
                  <td colspan="6" class="py-8 text-center text-gray-400">
                    No suppliers match your search query.
                  </td>
                </tr>
                <template v-for="v in filteredVendors" :key="v.vendor_id">
                  <tr 
                    @click="toggleVendorExpand(v.vendor_id)"
                    class="hover:bg-purple-50/50 transition-colors cursor-pointer"
                    :class="expandedVendorId === v.vendor_id ? 'bg-purple-50/60 font-semibold' : ''"
                  >
                    <td class="py-3.5 px-4 font-black text-gray-900 flex items-center gap-2.5">
                      <button 
                        type="button" 
                        @click.stop="toggleVendorExpand(v.vendor_id)"
                        class="w-6 h-6 rounded-md bg-white border border-gray-200 hover:border-[#714B67] hover:bg-[#714B67] hover:text-white text-gray-500 flex items-center justify-center text-[10px] transition-all shrink-0 shadow-2xs cursor-pointer"
                        :title="expandedVendorId === v.vendor_id ? 'Collapse purchase breakdown' : 'Click to view full purchase breakdown'"
                      >
                        <i class="fas fa-chevron-right transition-transform duration-200" :class="expandedVendorId === v.vendor_id ? 'rotate-90 text-[#714B67]' : ''"></i>
                      </button>

                      <span class="w-7 h-7 rounded-full bg-purple-100 text-purple-900 font-bold flex items-center justify-center text-xs shrink-0">
                        {{ v.name.charAt(0).toUpperCase() }}
                      </span>

                      <div>
                        <div class="flex items-center gap-1.5">
                          <span class="font-extrabold text-gray-900">{{ v.name }}</span>
                          <span v-if="getPurchasesForVendor(v.vendor_id).length > 0" class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                            {{ getPurchasesForVendor(v.vendor_id).length }} {{ getPurchasesForVendor(v.vendor_id).length === 1 ? 'purchase' : 'purchases' }}
                          </span>
                        </div>
                        <div class="text-[10px] text-gray-400 font-normal">Click to see what was bought &amp; payable breakdown</div>
                      </div>
                    </td>

                    <td class="py-3.5 px-4 text-gray-700 font-semibold">{{ v.company_name || '-' }}</td>
                    <td class="py-3.5 px-4 text-gray-600 font-mono text-[11px]">
                      <div>{{ v.phone || '-' }}</div>
                      <div v-if="v.email" class="text-[10px] text-gray-400">{{ v.email }}</div>
                    </td>
                    <td class="py-3.5 px-4 text-gray-500 text-xs truncate max-w-xs">{{ v.address || '-' }}</td>
                    <td class="py-3.5 px-4 text-right font-mono">
                      <span 
                        class="px-2.5 py-1 rounded-lg text-xs font-black inline-block border"
                        :class="v.balance > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : (v.balance < 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200')"
                      >
                        {{ v.balance > 0 ? 'Payable: Rs ' + v.balance.toFixed(2) : (v.balance < 0 ? 'Advance: Rs ' + Math.abs(v.balance).toFixed(2) : 'Settled (Rs 0.00)') }}
                      </span>
                    </td>
                    <td class="py-3.5 px-4 text-right whitespace-nowrap">
                      <div class="flex items-center justify-end gap-1.5" @click.stop>
                        <!-- Toggle Details Logs Button -->
                        <button 
                          @click="toggleVendorExpand(v.vendor_id)"
                          class="px-2.5 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 cursor-pointer"
                          :class="expandedVendorId === v.vendor_id ? 'bg-[#714B67] text-white border-[#714B67]' : 'bg-purple-50 hover:bg-purple-100 text-[#714B67] border-purple-200'"
                          title="View full purchase history and payable breakdown"
                        >
                          <i class="fas fa-list-ul text-[10px]"></i>
                          <span>{{ expandedVendorId === v.vendor_id ? 'Hide Logs' : 'View Logs' }}</span>
                          <i class="fas fa-chevron-down text-[9px] transition-transform duration-200" :class="expandedVendorId === v.vendor_id ? 'rotate-180' : ''"></i>
                        </button>

                        <!-- Pay Button: ONLY shown when payable balance is greater than 0 -->
                        <button 
                          v-if="v.balance > 0"
                          @click="openVendorPayment(v.vendor_id, v.balance)"
                          class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                          title="Settle outstanding payable"
                        >
                          <i class="fas fa-hand-holding-usd text-[11px]"></i>
                          <span>Pay</span>
                        </button>

                        <!-- Settled Indicator: Shown when payable is completely settled -->
                        <span 
                          v-else
                          class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[11px] font-semibold flex items-center gap-1"
                          title="Payable settled - No outstanding debt owed"
                        >
                          <i class="fas fa-check text-emerald-600 text-[10px]"></i>
                          <span>Settled</span>
                        </span>

                        <button 
                          @click="startPurchaseOrderForVendor(v)"
                          class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1"
                          title="Start new Purchase Order with this supplier"
                        >
                          <i class="fas fa-cart-plus text-[10px]"></i>
                          <span>Order</span>
                        </button>
                      </div>
                    </td>
                  </tr>

                  <!-- EXPANDED VENDOR PURCHASE BREAKDOWN SUB-ROW -->
                  <tr v-if="expandedVendorId === v.vendor_id" class="bg-gradient-to-b from-purple-50/50 via-purple-50/25 to-slate-50 border-y-2 border-purple-200">
                    <td colspan="6" class="p-4 sm:p-5">
                      <div class="space-y-3.5">
                        
                        <!-- Header & Financial Summary Banner -->
                        <div class="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-purple-200/80 shadow-xs">
                          <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-[#714B67] text-white flex items-center justify-center text-base shadow-xs shrink-0">
                              <i class="fas fa-file-invoice-dollar"></i>
                            </div>
                            <div>
                              <h4 class="font-black text-sm text-gray-900 flex items-center gap-2">
                                <span>Purchases &amp; Goods Received Log</span>
                                <span class="text-xs font-bold text-gray-500 font-normal">— {{ v.name }}</span>
                              </h4>
                              <p class="text-[11px] text-gray-500 mt-0.5">
                                Breakdown of every product, unit cost, quantity, and batch restock that accounts for this vendor's balance.
                              </p>
                            </div>
                          </div>

                          <!-- Metric Chips -->
                          <div class="flex items-center gap-2 text-xs">
                            <div class="px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
                              <span class="text-[10px] text-purple-700 font-bold block uppercase tracking-wider">Total Invoiced</span>
                              <span class="font-mono font-black text-purple-950 text-xs">
                                Rs {{ getVendorTotalPurchased(v.vendor_id).toFixed(2) }}
                              </span>
                            </div>

                            <div class="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                              <span class="text-[10px] text-emerald-700 font-bold block uppercase tracking-wider">Total Paid</span>
                              <span class="font-mono font-black text-emerald-950 text-xs">
                                Rs {{ getVendorTotalPaid(v.vendor_id).toFixed(2) }}
                              </span>
                            </div>

                            <div 
                              class="px-3 py-1.5 border rounded-lg"
                              :class="v.balance > 0 ? 'bg-rose-50 border-rose-200' : 'bg-gray-100 border-gray-200'"
                            >
                              <span class="text-[10px] font-bold block uppercase tracking-wider" :class="v.balance > 0 ? 'text-rose-700' : 'text-gray-500'">
                                Net Payable
                              </span>
                              <span class="font-mono font-black text-xs" :class="v.balance > 0 ? 'text-rose-900' : 'text-gray-700'">
                                Rs {{ v.balance.toFixed(2) }}
                              </span>
                            </div>
                          </div>
                        </div>

                        <!-- Itemized Purchases Table -->
                        <div v-if="getPurchasesForVendor(v.vendor_id).length > 0" class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                          <div class="px-4 py-2 bg-slate-50 border-b border-gray-200 flex justify-between items-center text-xs">
                            <span class="font-extrabold text-gray-800 flex items-center gap-1.5">
                              <i class="fas fa-boxes text-[#714B67]"></i>
                              <span>Itemized Goods Received ({{ getPurchasesForVendor(v.vendor_id).length }} items)</span>
                            </span>
                            <span class="text-[11px] text-gray-500 font-mono">
                              Latest purchases first
                            </span>
                          </div>

                          <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs border-collapse">
                              <thead class="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[10px] border-b border-gray-200">
                                <tr>
                                  <th class="py-2 px-3">Date &amp; Time</th>
                                  <th class="py-2 px-3">PO Batch #</th>
                                  <th class="py-2 px-3">Product / Item</th>
                                  <th class="py-2 px-3">Barcode / SKU</th>
                                  <th class="py-2 px-3 text-right">Quantity Bought</th>
                                  <th class="py-2 px-3 text-right">Unit Buying Cost</th>
                                  <th class="py-2 px-3 text-right">Line Total</th>
                                  <th class="py-2 px-3">Received By</th>
                                  <th class="py-2 px-3">Notes / Ref</th>
                                </tr>
                              </thead>
                              <tbody class="divide-y divide-gray-100">
                                <tr v-for="p in getPurchasesForVendor(v.vendor_id)" :key="p.purchase_id" class="hover:bg-purple-50/30 transition-colors">
                                  <td class="py-2.5 px-3 font-mono text-gray-600 whitespace-nowrap text-[11px]">
                                    {{ formatDate(p.created_at) }}
                                  </td>
                                  <td class="py-2.5 px-3 font-mono font-bold text-purple-900 whitespace-nowrap">
                                    <span class="px-1.5 py-0.5 rounded bg-purple-100 border border-purple-200 text-[10px]">
                                      #{{ p.po_id }}
                                    </span>
                                  </td>
                                  <td class="py-2.5 px-3 font-bold text-gray-900">
                                    <span>{{ p.product_name }}</span>
                                    <span v-if="p.product_id === 'HISTORIC_PAYABLE'" class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 ml-1.5 inline-flex items-center gap-1">
                                      <i class="fas fa-history text-[9px]"></i>
                                      <span>Opening Balance</span>
                                    </span>
                                  </td>
                                  <td class="py-2.5 px-3 font-mono text-gray-500 text-[11px]">
                                    {{ p.product_barcode || '-' }}
                                  </td>
                                  <td class="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                                    <span class="text-gray-900">{{ p.quantity }}</span>
                                    <span class="text-[10px] text-purple-800 font-bold ml-1 px-1 py-0.2 bg-purple-50 rounded border border-purple-100 uppercase">
                                      {{ p.uom_name }}
                                    </span>
                                    <span v-if="p.uom_multiplier > 1" class="block text-[9px] text-gray-400 font-normal">
                                      ({{ (p.quantity * p.uom_multiplier).toFixed(0) }} base units)
                                    </span>
                                  </td>
                                  <td class="py-2.5 px-3 text-right font-mono text-gray-700 whitespace-nowrap">
                                    Rs {{ p.unit_cost.toFixed(2) }}
                                  </td>
                                  <td class="py-2.5 px-3 text-right font-mono font-black text-purple-950 whitespace-nowrap">
                                    Rs {{ p.total_cost.toFixed(2) }}
                                  </td>
                                  <td class="py-2.5 px-3 text-gray-600 text-[11px]">
                                    {{ p.user_name || 'Store Manager' }}
                                  </td>
                                  <td class="py-2.5 px-3 text-gray-500 text-[11px] truncate max-w-xs" :title="p.reference_note || ''">
                                    {{ p.reference_note || '-' }}
                                  </td>
                                </tr>
                              </tbody>
                              <tfoot class="bg-gray-50 border-t-2 border-gray-200 font-extrabold text-xs text-gray-900">
                                <tr>
                                  <td colspan="6" class="py-2.5 px-3 text-right uppercase tracking-wider text-[10px] text-gray-500">
                                    Total Goods Purchased from {{ v.name }}:
                                  </td>
                                  <td class="py-2.5 px-3 text-right font-mono font-black text-sm text-[#714B67]">
                                    Rs {{ getVendorTotalPurchased(v.vendor_id).toFixed(2) }}
                                  </td>
                                  <td colspan="2"></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>

                        <!-- Empty State when no purchases logged yet -->
                        <div v-else class="p-6 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300 space-y-2">
                          <i class="fas fa-box-open text-3xl text-gray-300"></i>
                          <p class="font-bold text-xs text-gray-700">No itemized purchase orders logged for {{ v.name }} yet.</p>
                          <p v-if="v.balance > 0" class="text-[11px] text-amber-800 bg-amber-50 py-1 px-3 rounded-lg inline-block border border-amber-200">
                            Current balance of <strong>Rs {{ v.balance.toFixed(2) }}</strong> reflects an opening payable or unitemized supplier credit.
                          </p>
                          <p class="text-[11px] text-gray-400">
                            When restocking items from {{ v.name }} in the Purchase Orders tab, all product names, UOMs, unit costs, and quantities will automatically log here.
                          </p>
                          <div class="pt-2">
                            <button 
                              @click="startPurchaseOrderForVendor(v)"
                              class="px-3.5 py-1.5 bg-[#714B67] hover:bg-[#5a3a52] text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                            >
                              <i class="fas fa-cart-plus"></i>
                              <span>Create Purchase Order with {{ v.name }}</span>
                            </button>
                          </div>
                        </div>

                        <!-- Settled Payments Log for this Vendor -->
                        <div v-if="getPaymentsForVendor(v.vendor_id).length > 0" class="bg-white rounded-xl border border-emerald-200 shadow-xs overflow-hidden">
                          <div class="px-4 py-2 bg-emerald-50/70 border-b border-emerald-100 flex justify-between items-center text-xs">
                            <span class="font-bold text-emerald-900 flex items-center gap-1.5">
                              <i class="fas fa-check-circle text-emerald-600"></i>
                              <span>Settlement History for {{ v.name }} ({{ getPaymentsForVendor(v.vendor_id).length }} payments)</span>
                            </span>
                            <span class="font-mono font-bold text-emerald-800 text-[11px]">
                              Total Settled: Rs {{ getVendorTotalPaid(v.vendor_id).toFixed(2) }}
                            </span>
                          </div>
                          <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs border-collapse">
                              <thead class="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b border-gray-200">
                                <tr>
                                  <th class="py-2 px-3">Payment Date</th>
                                  <th class="py-2 px-3">Method</th>
                                  <th class="py-2 px-3 text-right">Cash / Bank Paid</th>
                                  <th class="py-2 px-3 text-right">Debit Note Deduction</th>
                                  <th class="py-2 px-3 text-right">Settlement Total</th>
                                  <th class="py-2 px-3">Paid By</th>
                                  <th class="py-2 px-3">Notes</th>
                                </tr>
                              </thead>
                              <tbody class="divide-y divide-gray-100">
                                <tr v-for="pay in getPaymentsForVendor(v.vendor_id)" :key="pay.payment_id" class="hover:bg-emerald-50/20">
                                  <td class="py-2 px-3 font-mono text-gray-600 whitespace-nowrap">{{ formatDate(pay.created_at) }}</td>
                                  <td class="py-2 px-3">
                                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                      {{ pay.payment_method }}
                                    </span>
                                  </td>
                                  <td class="py-2 px-3 text-right font-mono font-bold text-gray-900">Rs {{ pay.amount.toFixed(2) }}</td>
                                  <td class="py-2 px-3 text-right font-mono font-bold text-indigo-700">
                                    {{ pay.debit_note_amount > 0 ? 'Rs ' + pay.debit_note_amount.toFixed(2) : '-' }}
                                  </td>
                                  <td class="py-2 px-3 text-right font-mono font-black text-emerald-800">
                                    Rs {{ (pay.amount + pay.debit_note_amount).toFixed(2) }}
                                  </td>
                                  <td class="py-2 px-3 text-gray-600">{{ pay.user_name || 'Store Manager' }}</td>
                                  <td class="py-2 px-3 text-gray-500 truncate max-w-xs">{{ pay.notes || '-' }}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section 2: Recent Vendor Payment Settlements History -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div class="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h3 class="font-extrabold text-sm text-gray-900 tracking-tight flex items-center gap-2">
                <i class="fas fa-receipt text-emerald-600"></i>
                <span>Past Vendor Payment Settlements & Debit Notes</span>
              </h3>
              <p class="text-xs text-gray-500 mt-0.5">Historical record of payouts, bank transfers, cheques, and damaged stock claims</p>
            </div>
            <span class="text-xs font-bold text-gray-500 font-mono">{{ vendorPayments.length }} payments recorded</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead class="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th class="py-3.5 px-4">Date & Time</th>
                  <th class="py-3.5 px-4">Supplier</th>
                  <th class="py-3.5 px-4">Payment Method</th>
                  <th class="py-3.5 px-4 text-right">Cash / Bank Paid</th>
                  <th class="py-3.5 px-4 text-right">Debit Note Credit</th>
                  <th class="py-3.5 px-4 text-right">Total Settlement</th>
                  <th class="py-3.5 px-4">Paid By</th>
                  <th class="py-3.5 px-4">Notes / PO Ref</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 font-medium text-xs">
                <tr v-if="vendorPayments.length === 0">
                  <td colspan="8" class="py-8 text-center text-gray-400">
                    No vendor payments recorded yet.
                  </td>
                </tr>
                <tr v-for="pay in vendorPayments" :key="pay.payment_id" class="hover:bg-slate-50/80 transition-colors">
                  <td class="py-3.5 px-4 font-mono text-gray-600 whitespace-nowrap">{{ formatDate(pay.created_at) }}</td>
                  <td class="py-3.5 px-4 font-bold text-gray-900">{{ pay.vendor_name }}</td>
                  <td class="py-3.5 px-4">
                    <span 
                      class="px-2 py-0.5 rounded text-[11px] font-bold border"
                      :class="pay.payment_method === 'Cash' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-blue-50 text-blue-800 border-blue-200'"
                    >
                      {{ pay.payment_method }}
                    </span>
                  </td>
                  <td class="py-3.5 px-4 font-mono font-bold text-gray-900 text-right">Rs {{ pay.amount.toFixed(2) }}</td>
                  <td class="py-3.5 px-4 font-mono font-bold text-indigo-700 text-right">
                    {{ pay.debit_note_amount > 0 ? 'Rs ' + pay.debit_note_amount.toFixed(2) : '-' }}
                  </td>
                  <td class="py-3.5 px-4 font-mono font-black text-[#00A09D] text-right">
                    Rs {{ (pay.amount + pay.debit_note_amount).toFixed(2) }}
                  </td>
                  <td class="py-3.5 px-4 text-gray-600">{{ pay.user_name || 'Store Manager' }}</td>
                  <td class="py-3.5 px-4 text-gray-500 text-xs truncate max-w-xs">{{ pay.notes || '-' }}</td>
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
