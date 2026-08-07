<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAllInventoryLogs, restockProduct, type InventoryLogItem } from '../services/bomService'
import { useProductStore } from '../stores/useProductStore'
import { useAuthStore } from '../stores/useAuthStore'
import ManagerPinModal from '../components/modals/ManagerPinModal.vue'
import { useToast } from '../composables/useToast'

const productStore = useProductStore()
const authStore = useAuthStore()
const toast = useToast()

const logs = ref<InventoryLogItem[]>([])
const isLoading = ref(true)

const searchQuery = ref('')
const selectedTypeFilter = ref('ALL')
const selectedProductFilter = ref('ALL')

// Manager PIN Authorization Modal State
const isManagerPinModalOpen = ref(false)
const pendingTargetProductId = ref<string | undefined>(undefined)

// Restock Modal Form State
const isRestockModalOpen = ref(false)
const restockProductId = ref('')
const restockQty = ref<number>(10)
const restockNote = ref('Vendor Delivery Restock')
const isSubmittingRestock = ref(false)

async function fetchLogs() {
  isLoading.value = true
  try {
    await productStore.loadFromDb()
    logs.value = await getAllInventoryLogs()
  } catch (e) {
    console.error('Error fetching inventory history:', e)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchLogs()
})

// Filtered Inventory Logs
const filteredLogs = computed(() => {
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

    return matchesSearch && matchesType && matchesProduct
  })
})

// Summary Stats
const totalMovementsCount = computed(() => logs.value.length)
const totalRestockedQty = computed(() => {
  return logs.value
    .filter(l => l.movement_type === 'RESTOCK' || l.movement_type === 'INITIAL_SEED')
    .reduce((sum, l) => sum + Math.abs(l.quantity_change), 0)
})
const totalSoldQty = computed(() => {
  return logs.value
    .filter(l => l.movement_type === 'POS_SALE' || l.movement_type === 'BOM_DEDUCTION')
    .reduce((sum, l) => sum + Math.abs(l.quantity_change), 0)
})
const lowStockProductsCount = computed(() => {
  return productStore.products.filter(p => (p.stock || 0) <= 10).length
})

// Trigger Restock: Checks if user has Manager privileges first
function requestRestockAccess(productId?: string) {
  if (authStore.hasManagerPrivileges) {
    // Manager or Developer -> Direct Access
    openRestockModal(productId)
  } else {
    // Salesperson / Cashier -> Requires Manager PIN Authorization
    pendingTargetProductId.value = productId
    isManagerPinModalOpen.value = true
  }
}

function handleManagerAuthorized() {
  openRestockModal(pendingTargetProductId.value)
  pendingTargetProductId.value = undefined
}

// Open Restock Modal pre-filled
function openRestockModal(productId?: string) {
  if (productId) {
    restockProductId.value = productId
  } else if (productStore.products.length > 0) {
    restockProductId.value = productStore.products[0].id
  }
  restockQty.value = 50
  restockNote.value = 'Supplier Restock Delivery'
  isRestockModalOpen.value = true
}

async function handleConfirmRestock() {
  if (!restockProductId.value || restockQty.value <= 0) {
    toast.warning('Please select a valid product and enter a positive restock quantity.')
    return
  }

  isSubmittingRestock.value = true
  try {
    const operatorName = authStore.currentUser?.name || 'Store Manager'
    await restockProduct(restockProductId.value, restockQty.value, restockNote.value, operatorName)
    toast.success(`Successfully restocked ${restockQty.value} Pcs into inventory!`)
    isRestockModalOpen.value = false
    await fetchLogs()
  } catch (e: any) {
    toast.error('Failed to restock inventory: ' + (e.message || e))
  } finally {
    isSubmittingRestock.value = false
  }
}

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
    <div class="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between shrink-0 shadow-2xs">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-black text-gray-900 tracking-tight">📦 Inventory Stocking History</h1>
          <span class="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-[#714B67] font-bold">
            Audit Ledger
          </span>
          <span v-if="!authStore.hasManagerPrivileges" class="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-300">
            🔒 Manager PIN Required for Restock
          </span>
        </div>
        <p class="text-xs text-gray-500 mt-0.5">Real-time audit log of product restocks, POS sales deductions, and inventory adjustments</p>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="fetchLogs"
          class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs flex items-center gap-1.5 border border-gray-300 transition-all"
          title="Refresh Log Records"
        >
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
          <span>Refresh</span>
        </button>

        <button 
          @click="requestRestockAccess()"
          class="px-4 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <i class="fas" :class="authStore.hasManagerPrivileges ? 'fa-plus-circle' : 'fa-lock'"></i>
          <span>+ Restock Product Inventory</span>
        </button>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 p-6 overflow-y-auto space-y-6">

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
            <i class="fas fa-[#2ECC71] fa-arrow-down"></i>
          </div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between">
          <div>
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Deducted (Sales)</span>
            <div class="text-2xl font-black text-rose-700 mt-1 font-mono">-{{ totalSoldQty.toFixed(0) }} Pcs</div>
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
      <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        
        <!-- Search Input -->
        <div class="relative flex-1 min-w-[280px]">
          <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search by product name, barcode (#OD001), note, or user..." 
            class="w-full pl-10 pr-4 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:border-[#714B67] focus:bg-white"
          />
        </div>

        <!-- Filters Group -->
        <div class="flex items-center gap-3 text-xs">
          
          <!-- Movement Type Filter -->
          <div class="flex items-center gap-1.5">
            <label class="font-bold text-gray-600">Movement:</label>
            <select 
              v-model="selectedTypeFilter" 
              class="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 font-semibold focus:outline-none focus:border-[#714B67]"
            >
              <option value="ALL">All Movement Types</option>
              <option value="RESTOCK">🟢 Restock / Stock In</option>
              <option value="POS_SALE">🔴 POS Sale Deduction</option>
              <option value="BOM_DEDUCTION">🟣 BOM Ingredient Deduction</option>
              <option value="MANUAL_ADJUSTMENT">🔵 Manual Adjustment</option>
              <option value="INITIAL_SEED">⚙️ Initial Seed</option>
            </select>
          </div>

          <!-- Product Filter -->
          <div class="flex items-center gap-1.5">
            <label class="font-bold text-gray-600">Product:</label>
            <select 
              v-model="selectedProductFilter" 
              class="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 font-semibold focus:outline-none focus:border-[#714B67] max-w-[200px] truncate"
            >
              <option value="ALL">All Products</option>
              <option v-for="p in productStore.products" :key="p.id" :value="p.id">
                {{ p.name }} (Stock: {{ p.stock }})
              </option>
            </select>
          </div>

        </div>

      </div>

      <!-- Inventory Stocking History Table -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        
        <div v-if="isLoading" class="p-12 text-center text-gray-400 flex flex-col items-center">
          <i class="fas fa-circle-notch fa-spin text-3xl text-[#714B67] mb-3"></i>
          <span class="text-sm font-bold">Loading Inventory History Ledger...</span>
        </div>

        <div v-else-if="filteredLogs.length === 0" class="p-12 text-center text-gray-400 flex flex-col items-center">
          <i class="fas fa-boxes text-4xl text-gray-300 mb-3"></i>
          <p class="text-sm font-bold text-gray-600">No stocking history records found.</p>
          <p class="text-xs text-gray-400 mt-1">Try adjusting your search query or click "+ Restock Product Inventory" to log a new restock!</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-xs">
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
              <tr 
                v-for="item in filteredLogs" 
                :key="item.log_id"
                class="hover:bg-slate-50/80 transition-colors"
              >
                <!-- Date & Time -->
                <td class="py-3 px-4 font-mono text-gray-700 font-semibold whitespace-nowrap">
                  {{ formatDate(item.created_at) }}
                </td>

                <!-- Product Name -->
                <td class="py-3 px-4 font-bold text-gray-900">
                  {{ item.product_name }}
                </td>

                <!-- Barcode -->
                <td class="py-3 px-4 font-mono text-gray-500 font-bold">
                  {{ item.product_barcode ? `#${item.product_barcode}` : '-' }}
                </td>

                <!-- Movement Type Badge -->
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
                    <i class="fas fa-[#e74c3c] fa-arrow-up text-rose-600"></i>
                    <span>POS SALE</span>
                  </span>

                  <span 
                    v-else-if="item.movement_type === 'BOM_DEDUCTION'"
                    class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-300 flex items-center w-fit gap-1"
                  >
                    <i class="fas fa-utensils text-purple-600"></i>
                    <span>BOM USAGE</span>
                  </span>

                  <span 
                    v-else
                    class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-300 flex items-center w-fit gap-1"
                  >
                    <i class="fas fa-sliders-h text-blue-600"></i>
                    <span>ADJUSTMENT</span>
                  </span>
                </td>

                <!-- Quantity Change -->
                <td class="py-3 px-4 font-mono font-black text-right text-sm whitespace-nowrap" :class="item.quantity_change > 0 ? 'text-emerald-600' : 'text-rose-600'">
                  {{ item.quantity_change > 0 ? `+${item.quantity_change}` : item.quantity_change }} Pcs
                </td>

                <!-- Stock After -->
                <td class="py-3 px-4 font-mono font-bold text-gray-900 text-right text-sm whitespace-nowrap">
                  {{ item.quantity_after }} Pcs
                </td>

                <!-- Reference Note -->
                <td class="py-3 px-4 text-gray-600 text-xs">
                  {{ item.reference_note || '-' }}
                </td>

                <!-- Operator User -->
                <td class="py-3 px-4 text-gray-700 font-semibold">
                  {{ item.user_name || 'System' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>

    <!-- Manager Authorization PIN Modal -->
    <ManagerPinModal 
      :show="isManagerPinModalOpen" 
      title="Manager Authorization Required"
      actionDescription="Only Store Manager can add and restock inventory stock. Please enter Manager PIN code."
      @close="isManagerPinModalOpen = false"
      @authorized="handleManagerAuthorized"
    />

    <!-- Restock Inventory Action Modal -->
    <div v-if="isRestockModalOpen" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        <div class="px-6 py-4 bg-[#714B67] text-white flex justify-between items-center">
          <div class="flex items-center gap-2 font-bold text-base">
            <i class="fas fa-plus-circle"></i>
            <span>Restock Product Inventory</span>
          </div>
          <span class="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-400 text-gray-900 rounded">
            Manager Authorized
          </span>
        </div>

        <div class="p-6 space-y-4 text-xs">
          <div>
            <label class="block font-bold text-gray-800 mb-1">Select Product to Restock</label>
            <select 
              v-model="restockProductId" 
              class="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:border-[#714B67]"
            >
              <option v-for="p in productStore.products" :key="p.id" :value="p.id">
                {{ p.name }} (Current Stock: {{ p.stock }} Pcs)
              </option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-gray-800 mb-1">Restock Quantity (Pcs)</label>
            <input 
              v-model.number="restockQty" 
              type="number" 
              min="1"
              class="w-full p-2.5 border border-gray-300 rounded-lg font-mono font-bold text-base text-gray-900 focus:outline-none focus:border-[#714B67]"
              placeholder="e.g. 50"
            />
          </div>

          <div>
            <label class="block font-bold text-gray-800 mb-1">Supplier Reference / Note</label>
            <input 
              v-model="restockNote" 
              type="text" 
              class="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#714B67]"
              placeholder="e.g. Vendor Invoice #PO-2026-901"
            />
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
          <button @click="isRestockModalOpen = false" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-xs">
            Cancel
          </button>
          <button 
            @click="handleConfirmRestock" 
            :disabled="isSubmittingRestock"
            class="px-5 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded-lg text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <i v-if="isSubmittingRestock" class="fas fa-circle-notch fa-spin"></i>
            <span>Confirm Restock & Save Log</span>
          </button>
        </div>

      </div>
    </div>

  </div>
</template>
