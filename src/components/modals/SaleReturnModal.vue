<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  searchSalesForReturn, 
  processSalesReturnExchange, 
  type SaleForReturnDetails, 
  type ReturnExchangePayload 
} from '../../services/bomService'
import { useProductStore, type Product } from '../../stores/useProductStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useSessionStore } from '../../stores/useSessionStore'
import { useToast } from '../../composables/useToast'
import ManagerPinModal from './ManagerPinModal.vue'

const props = defineProps<{
  show: boolean
  initialSaleId?: string
}>()

const emit = defineEmits(['close', 'return-success'])

const productStore = useProductStore()
const authStore = useAuthStore()
const sessionStore = useSessionStore()
const toast = useToast()

const searchQuery = ref('')
const matchingSales = ref<SaleForReturnDetails[]>([])
const selectedSale = ref<SaleForReturnDetails | null>(null)
const isSearching = ref(false)

// Return Line Items
export interface ReturnLineState {
  sale_item_id: string
  product_id: string
  product_name: string
  product_barcode: string
  qty_purchased: number
  old_unit_price: number
  qty_already_returned: number
  qty_available_to_return: number
  return_qty: number
  item_condition: 'RESTOCKABLE' | 'DAMAGED' | 'EXPIRED' | 'DEFECTIVE_VENDOR_CLAIM'
}

const returnLines = ref<ReturnLineState[]>([])

// Exchange Items
export interface ExchangeLineState {
  product: Product
  qty: number
  unit_price: number
  price_rate_mode: 'NEW_RATE' | 'OLD_RATE'
  old_price?: number
  new_price: number
}

const exchangeLines = ref<ExchangeLineState[]>([])
const showExchangeCatalog = ref(false)
const exchangeSearchQuery = ref('')

const refundMethod = ref('Cash')
const returnReason = ref('Customer Return / Exchange')
const isProcessing = ref(false)
const isManagerPinOpen = ref(false)

async function handleSearchSales() {
  isSearching.value = true
  try {
    matchingSales.value = await searchSalesForReturn(searchQuery.value)
    if (matchingSales.value.length === 1) {
      selectSaleForReturn(matchingSales.value[0])
    }
  } catch (e) {
    console.error('Search sales error:', e)
  } finally {
    isSearching.value = false
  }
}

function selectSaleForReturn(sale: SaleForReturnDetails) {
  selectedSale.value = sale
  returnLines.value = sale.items.map(item => ({
    sale_item_id: item.sale_item_id,
    product_id: item.product_id,
    product_name: item.product_name,
    product_barcode: item.product_barcode,
    qty_purchased: item.qty_purchased,
    old_unit_price: item.old_unit_price,
    qty_already_returned: item.qty_already_returned,
    qty_available_to_return: item.qty_available_to_return,
    return_qty: 0,
    item_condition: 'RESTOCKABLE'
  }))
}

function resetReturnModal() {
  searchQuery.value = ''
  matchingSales.value = []
  selectedSale.value = null
  returnLines.value = []
  exchangeLines.value = []
  showExchangeCatalog.value = false
  refundMethod.value = 'Cash'
  returnReason.value = 'Customer Return / Exchange'
}

watch(() => props.show, async (isOpen) => {
  if (isOpen) {
    resetReturnModal()
    if (props.initialSaleId) {
      searchQuery.value = props.initialSaleId
      await handleSearchSales()
    } else {
      await handleSearchSales()
    }
  }
}, { immediate: true })

// Add Product to Exchange List
function addExchangeItem(product: Product) {
  const existing = exchangeLines.value.find(e => e.product.id === product.id)
  if (existing) {
    existing.qty += 1
  } else {
    const origLine = selectedSale.value?.items.find(i => i.product_id === product.id)
    const oldPrice = origLine ? origLine.old_unit_price : undefined
    const newPrice = product.price

    // If returned items include DAMAGED or EXPIRED, cashier can charge OLD_RATE or NEW_RATE
    const hasDamagedOrExpired = returnLines.value.some(l => l.return_qty > 0 && (l.item_condition === 'DAMAGED' || l.item_condition === 'EXPIRED'))

    const defaultRateMode = (hasDamagedOrExpired && oldPrice !== undefined) ? 'OLD_RATE' : 'NEW_RATE'
    const initialUnitPrice = (defaultRateMode === 'OLD_RATE' && oldPrice !== undefined) ? oldPrice : newPrice

    exchangeLines.value.push({
      product,
      qty: 1,
      unit_price: initialUnitPrice,
      price_rate_mode: defaultRateMode,
      old_price: oldPrice,
      new_price: newPrice
    })
  }
}

function setExchangeRateMode(line: ExchangeLineState, mode: 'NEW_RATE' | 'OLD_RATE') {
  line.price_rate_mode = mode
  if (mode === 'OLD_RATE' && line.old_price !== undefined) {
    line.unit_price = line.old_price
  } else {
    line.unit_price = line.new_price
  }
}

function removeExchangeItem(productId: string) {
  exchangeLines.value = exchangeLines.value.filter(e => e.product.id !== productId)
}

// Calculations
const totalRefundCredit = computed(() => {
  return returnLines.value.reduce((sum, item) => {
    const qty = Math.min(item.qty_available_to_return, Math.max(0, item.return_qty || 0))
    return sum + (qty * item.old_unit_price)
  }, 0)
})

const totalNewCharges = computed(() => {
  return exchangeLines.value.reduce((sum, item) => {
    return sum + (Math.max(1, item.qty) * item.unit_price)
  }, 0)
})

const netSettlement = computed(() => {
  return totalNewCharges.value - totalRefundCredit.value
})

const hasActiveReturns = computed(() => {
  return returnLines.value.some(l => l.return_qty > 0)
})

// Trigger Return Submit
function handleRequestReturn() {
  if (!hasActiveReturns.value) {
    toast.warning('Please select at least 1 item to return (increase Return Qty > 0).')
    return
  }

  // Permission Check: Check if user has void_orders right
  if (authStore.hasRight('void_orders')) {
    executeSubmitReturn()
  } else {
    // Non-authorized user requires Manager PIN
    isManagerPinOpen.value = true
  }
}

async function executeSubmitReturn() {
  if (!selectedSale.value) return

  isProcessing.value = true
  try {
    const activeReturnedItems = returnLines.value
      .filter(l => l.return_qty > 0)
      .map(l => ({
        sale_item_id: l.sale_item_id,
        product_id: l.product_id,
        quantity_returned: l.return_qty,
        old_unit_price: l.old_unit_price,
        item_condition: l.item_condition,
        reason: returnReason.value
      }))

    const activeExchangeItems = exchangeLines.value.map(e => ({
      product_id: e.product.id,
      quantity: e.qty,
      current_price: e.unit_price
    }))

    const payload: ReturnExchangePayload = {
      origin_sale_id: selectedSale.value.sale_id,
      session_id: sessionStore.sessionId,
      node_id: sessionStore.nodeId,
      returned_items: activeReturnedItems,
      exchange_items: activeExchangeItems,
      refund_method: refundMethod.value,
      user_name: authStore.currentUser?.name || 'Store Operator',
      reason: returnReason.value
    }

    const returnId = await processSalesReturnExchange(payload)
    
    toast.success(`Sales Return / Exchange processed successfully! (Ref #${returnId.substr(0, 8).toUpperCase()})`)
    emit('return-success', returnId)
    emit('close')
  } catch (e: any) {
    toast.error('Failed to process return: ' + (e.message || e))
  } finally {
    isProcessing.value = false
  }
}

// Filtered Exchange Catalog Products
const exchangeProducts = computed(() => {
  const q = exchangeSearchQuery.value.toLowerCase().trim()
  return productStore.products.filter(p => {
    return !q || p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q))
  })
})
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-[75] flex items-center justify-center p-4 backdrop-blur-xs">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      
      <!-- Modal Header -->
      <div class="bg-[#714B67] text-white p-4 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <i class="fas fa-undo text-amber-300 text-lg"></i>
          <div>
            <h2 class="font-bold text-base">Sales Order Return & Exchange Register</h2>
            <p class="text-xs text-white/80">Original sale remains 100% untouched. Return at OLD price, exchange at CURRENT rate.</p>
          </div>
        </div>

        <button @click="$emit('close')" class="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-lg font-bold">
          ✕
        </button>
      </div>

      <!-- Search & Filters Bar -->
      <div class="p-4 bg-purple-50/50 border-b border-purple-100 flex items-center gap-3 shrink-0 text-xs">
        <div class="relative flex-1">
          <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input 
            v-model="searchQuery"
            @keyup.enter="handleSearchSales"
            type="text" 
            placeholder="🔍 Enter Receipt # (POS-F47AC10B), Order ID, or Product name..."
            class="w-full pl-10 pr-4 py-2 bg-white border border-purple-200 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#714B67]"
          />
        </div>

        <button 
          @click="handleSearchSales"
          class="px-4 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <i class="fas" :class="isSearching ? 'fa-spinner fa-spin' : 'fa-search'"></i>
          <span>Lookup Order</span>
        </button>

        <button 
          v-if="selectedSale"
          @click="selectedSale = null"
          class="px-3 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold rounded-lg transition-colors"
        >
          ← Back to Order Results
        </button>
      </div>

      <!-- Main Body -->
      <div class="flex-1 flex overflow-hidden bg-gray-50/50">

        <!-- CASE A: ORDER LIST / SEARCH RESULTS -->
        <div v-if="!selectedSale" class="flex-1 p-6 overflow-y-auto space-y-4">
          <h3 class="font-bold text-sm text-gray-800">Select Sale Order to Process Return</h3>
          
          <div v-if="matchingSales.length === 0" class="p-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            <i class="fas fa-search text-4xl mb-2 text-gray-300"></i>
            <p class="font-bold text-sm text-gray-600">No matching sales orders found</p>
            <p class="text-xs text-gray-400 mt-1">Enter a valid receipt code or product name above to lookup past sales.</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              v-for="s in matchingSales"
              :key="s.sale_id"
              @click="selectSaleForReturn(s)"
              class="bg-white border border-gray-200 hover:border-[#714B67] rounded-xl p-4 shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-2.5 group"
            >
              <div class="flex justify-between items-start">
                <div>
                  <span class="font-mono font-black text-sm text-[#714B67] group-hover:underline">{{ s.receipt_code }}</span>
                  <div class="text-[11px] text-gray-500 font-mono">{{ new Date(s.created_at).toLocaleString() }}</div>
                </div>

                <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase">
                  {{ s.payment_method }}
                </span>
              </div>

              <div class="border-t border-gray-100 pt-2 space-y-1 text-xs">
                <div v-for="item in s.items" :key="item.sale_item_id" class="flex justify-between text-gray-700">
                  <span class="font-medium truncate max-w-[200px]">{{ item.product_name }}</span>
                  <span class="font-mono text-gray-500">{{ item.qty_purchased }}x @ Rs{{ item.old_unit_price.toFixed(2) }}</span>
                </div>
              </div>

              <div class="border-t border-gray-100 pt-2 flex justify-between items-center text-xs">
                <span class="text-gray-500 font-semibold">Original Net Total:</span>
                <strong class="font-mono text-base text-gray-900">Rs {{ s.net_total.toFixed(2) }}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- CASE B: PRE-LOADED RETURN REGISTER (POS CART STYLE) -->
        <div v-else class="flex-1 flex w-full h-full overflow-hidden">
          
          <!-- Left Side: Pre-Loaded Sale Order Items & Exchange Catalog -->
          <div class="flex-1 flex flex-col border-r border-gray-200 overflow-hidden bg-white">
            
            <!-- Order Header Info -->
            <div class="px-5 py-3 bg-slate-50 border-b border-gray-200 flex justify-between items-center shrink-0 text-xs">
              <div>
                <span class="font-bold text-gray-600">Origin Sale: </span>
                <strong class="font-mono text-[#714B67] text-sm font-black">{{ selectedSale.receipt_code }}</strong>
                <span class="text-gray-400 ml-2 font-mono text-[11px]">({{ new Date(selectedSale.created_at).toLocaleDateString() }})</span>
              </div>

              <button 
                @click="showExchangeCatalog = !showExchangeCatalog"
                :class="[
                  'px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5',
                  showExchangeCatalog ? 'bg-amber-500 text-white shadow-2xs' : 'bg-purple-100 text-purple-900 hover:bg-purple-200'
                ]"
              >
                <i class="fas" :class="showExchangeCatalog ? 'fa-arrow-left' : 'fa-exchange-alt'"></i>
                <span>{{ showExchangeCatalog ? '← Back to Return Items' : '+ Add Exchange Items (Catalog)' }}</span>
              </button>
            </div>

            <!-- Pre-Loaded Items List OR Exchange Catalog -->
            <div class="flex-1 overflow-y-auto p-5">
              
              <!-- Option A: Return Items List -->
              <div v-if="!showExchangeCatalog" class="space-y-4">
                <h3 class="font-bold text-xs text-gray-800 uppercase tracking-wider">
                  Original Purchased Items (Pre-Loaded at Sale Price)
                </h3>

                <div 
                  v-for="line in returnLines" 
                  :key="line.sale_item_id"
                  class="border rounded-xl p-4 transition-all space-y-3"
                  :class="line.return_qty > 0 ? 'border-[#714B67] bg-purple-50/40 ring-1 ring-[#714B67]/20 shadow-xs' : 'border-gray-200 bg-white'"
                >
                  <div class="flex justify-between items-start">
                    <div>
                      <h4 class="font-bold text-sm text-gray-900">{{ line.product_name }}</h4>
                      <span class="text-[11px] text-gray-500 font-mono">
                        Barcode: #{{ line.product_barcode || 'N/A' }} | Paid Qty: <strong>{{ line.qty_purchased }} Pcs</strong>
                      </span>
                    </div>

                    <!-- OLD Sale Price Badge -->
                    <div class="text-right">
                      <span class="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200 block mb-0.5">
                        Sale Rate (OLD): Rs {{ line.old_unit_price.toFixed(2) }}
                      </span>
                      <span v-if="line.qty_already_returned > 0" class="text-[10px] text-amber-700 font-semibold">
                        (Already Returned: {{ line.qty_already_returned }} Pcs)
                      </span>
                    </div>
                  </div>

                  <!-- Return Controls -->
                  <div class="grid grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-gray-200 text-xs">
                    <!-- Quantity to Return -->
                    <div>
                      <label class="block font-bold text-gray-700 mb-1">Return Quantity (Max {{ line.qty_available_to_return }})</label>
                      <div class="flex items-center gap-2">
                        <input 
                          v-model.number="line.return_qty"
                          type="number"
                          min="0"
                          :max="line.qty_available_to_return"
                          class="w-24 px-3 py-1.5 border border-gray-300 rounded font-mono font-bold text-sm text-gray-900 focus:outline-none focus:border-[#714B67]"
                        />
                        <button 
                          @click="line.return_qty = line.qty_available_to_return"
                          class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded text-[11px] font-bold text-gray-700"
                        >
                          Max
                        </button>
                      </div>
                    </div>

                    <!-- Item Condition Selector -->
                    <div>
                      <label class="block font-bold text-gray-700 mb-1">Item Condition & Stock Action</label>
                      <select 
                        v-model="line.item_condition"
                        class="w-full px-3 py-1.5 border border-gray-300 rounded text-xs font-bold text-gray-900 focus:outline-none focus:border-[#714B67]"
                      >
                        <option value="RESTOCKABLE">🟢 Good / Resellable (Restock +Qty)</option>
                        <option value="DAMAGED">🔴 Damaged / Broken (Loss Deduction)</option>
                        <option value="EXPIRED">⚠️ Expired Product (Expiry Deduction)</option>
                      </select>
                    </div>
                  </div>

                  <!-- Refund Subtotal -->
                  <div v-if="line.return_qty > 0" class="flex justify-between items-center text-xs font-bold pt-1 text-purple-950">
                    <span>Refund Credit at OLD Rate:</span>
                    <span class="font-mono text-sm text-[#714B67]">+Rs {{ (line.return_qty * line.old_unit_price).toFixed(2) }}</span>
                  </div>
                </div>
              </div>

              <!-- Option B: Exchange Catalog Selection Grid -->
              <div v-else class="space-y-4">
                <div class="flex items-center justify-between">
                  <h3 class="font-bold text-xs text-gray-800 uppercase tracking-wider">
                    Add Exchange Items from Catalog (Charged at CURRENT NEW Rate)
                  </h3>
                  <input 
                    v-model="exchangeSearchQuery"
                    type="text"
                    placeholder="Search catalog..."
                    class="px-3 py-1 border border-gray-300 rounded text-xs font-semibold"
                  />
                </div>

                <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div 
                    v-for="p in exchangeProducts"
                    :key="p.id"
                    @click="addExchangeItem(p)"
                    class="bg-white border border-gray-200 rounded-xl p-3 hover:border-amber-500 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <h4 class="font-bold text-xs text-gray-900 group-hover:text-amber-600 truncate">{{ p.name }}</h4>
                    <div class="flex justify-between items-center mt-2 text-[11px]">
                      <span class="text-gray-400 font-mono">Stock: {{ p.stock || 0 }}</span>
                      <strong class="font-mono text-emerald-700">Rs {{ p.price }}</strong>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>

          <!-- Right Side: Net Settlement & Exchange Cart Summary Drawer -->
          <aside class="w-[380px] bg-slate-50 border-l border-gray-200 flex flex-col h-full shrink-0 shadow-lg">
            
            <div class="p-4 bg-gray-900 text-white font-bold text-xs flex justify-between items-center shrink-0">
              <span>Return & Exchange Summary</span>
              <span class="text-amber-400 font-mono text-[11px]">Dynamic Dual Pricing</span>
            </div>

            <!-- Scrollable Summary -->
            <div class="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              
              <!-- Returned Items Summary (OLD Rates) -->
              <div class="bg-white p-3.5 rounded-xl border border-purple-200 space-y-2 shadow-2xs">
                <div class="font-bold text-purple-950 flex justify-between border-b border-purple-100 pb-1.5">
                  <span>Returned Items Credit (OLD Rates)</span>
                  <span class="font-mono text-purple-700">Rs {{ totalRefundCredit.toFixed(2) }}</span>
                </div>

                <div v-if="!hasActiveReturns" class="text-gray-400 text-[11px] italic">
                  No return quantities selected yet.
                </div>

                <div v-else class="space-y-1 text-[11px]">
                  <div v-for="l in returnLines.filter(x => x.return_qty > 0)" :key="l.sale_item_id" class="flex justify-between text-gray-700">
                    <span class="truncate max-w-[180px]">{{ l.return_qty }}x {{ l.product_name }}</span>
                    <span class="font-mono font-bold">Rs {{ (l.return_qty * l.old_unit_price).toFixed(2) }}</span>
                  </div>
                </div>
              </div>

              <!-- New Exchange Replacement Items Summary (Rate Mode Toggle) -->
              <div v-if="exchangeLines.length > 0" class="bg-white p-3.5 rounded-xl border border-amber-200 space-y-2.5 shadow-2xs">
                <div class="font-bold text-amber-950 flex justify-between border-b border-amber-100 pb-1.5">
                  <span>Exchange Replacement Items</span>
                  <span class="font-mono text-amber-700">Rs {{ totalNewCharges.toFixed(2) }}</span>
                </div>

                <div class="space-y-2 text-[11px]">
                  <div 
                    v-for="e in exchangeLines" 
                    :key="e.product.id" 
                    class="bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/80 space-y-1.5"
                  >
                    <!-- Name & Qty Controls -->
                    <div class="flex justify-between items-center text-gray-900 font-bold">
                      <div class="flex items-center gap-1.5">
                        <button @click="removeExchangeItem(e.product.id)" class="text-rose-500 hover:bg-rose-100 px-1 rounded font-bold">✕</button>
                        <span class="truncate max-w-[140px] text-xs">{{ e.product.name }}</span>
                      </div>
                      
                      <div class="flex items-center gap-1">
                        <button @click="e.qty = Math.max(1, e.qty - 1)" class="w-5 h-5 bg-white border border-gray-300 rounded flex items-center justify-center font-bold text-gray-700 cursor-pointer">-</button>
                        <span class="font-mono font-bold w-5 text-center text-xs">{{ e.qty }}</span>
                        <button @click="e.qty += 1" class="w-5 h-5 bg-white border border-gray-300 rounded flex items-center justify-center font-bold text-gray-700 cursor-pointer">+</button>
                      </div>
                    </div>

                    <!-- Rate Selection Toggle (OLD Rate vs NEW Rate) -->
                    <div class="flex items-center justify-between text-[10px] bg-white p-1.5 rounded border border-amber-200/80 gap-1">
                      <span class="font-bold text-gray-600 shrink-0">Rate Charged:</span>
                      <div class="flex gap-1 shrink-0">
                        <button 
                          @click="setExchangeRateMode(e, 'NEW_RATE')"
                          :class="e.price_rate_mode === 'NEW_RATE' ? 'bg-emerald-600 text-white font-black shadow-2xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                          class="px-1.5 py-0.5 rounded transition-all cursor-pointer"
                          title="Charge current store catalog rate"
                        >
                          NEW (Rs {{ e.new_price.toFixed(2) }})
                        </button>
                        <button 
                          v-if="e.old_price !== undefined"
                          @click="setExchangeRateMode(e, 'OLD_RATE')"
                          :class="e.price_rate_mode === 'OLD_RATE' ? 'bg-purple-700 text-white font-black shadow-2xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                          class="px-1.5 py-0.5 rounded transition-all cursor-pointer"
                          title="Charge original purchase rate (for damaged/expired item exchange)"
                        >
                          OLD (Rs {{ e.old_price.toFixed(2) }})
                        </button>
                      </div>
                    </div>

                    <!-- Unit Price Edit & Subtotal -->
                    <div class="flex justify-between items-center text-[10px] text-gray-600 pt-0.5 font-mono">
                      <div class="flex items-center gap-1 font-sans">
                        <span>Unit Rate:</span>
                        <input 
                          v-model.number="e.unit_price"
                          type="number"
                          min="0"
                          step="0.01"
                          class="w-16 px-1 py-0.5 border border-gray-300 rounded font-mono font-bold text-gray-900 text-right text-[10px]"
                        />
                      </div>
                      <strong class="font-mono text-xs text-amber-900">Total: Rs {{ (e.qty * e.unit_price).toFixed(2) }}</strong>
                    </div>

                  </div>
                </div>
              </div>

              <!-- Refund Method & Reason -->
              <div class="space-y-2.5 bg-white p-3.5 rounded-xl border border-gray-200">
                <div>
                  <label class="block font-bold text-gray-700 mb-1">Refund Method</label>
                  <select 
                    v-model="refundMethod"
                    class="w-full px-3 py-1.5 border border-gray-300 rounded text-xs font-bold text-gray-900 focus:outline-none focus:border-[#714B67]"
                  >
                    <option value="Cash">💵 Cash Refund / Cash Settlement</option>
                    <option value="Card">💳 Card / Electronic Refund</option>
                    <option value="Store Credit">🏷️ Store Credit Voucher</option>
                  </select>
                </div>

                <div>
                  <label class="block font-bold text-gray-700 mb-1">Return Reason / Note</label>
                  <input 
                    v-model="returnReason"
                    type="text" 
                    placeholder="e.g. Size exchange / Customer choice" 
                    class="w-full px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#714B67]"
                  />
                </div>
              </div>

            </div>

            <!-- Net Settlement Footer -->
            <div class="p-4 bg-white border-t border-gray-200 space-y-3 shrink-0 shadow-lg">
              <div class="p-3 rounded-xl border space-y-1" :class="netSettlement <= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'">
                <div class="text-[10px] font-bold uppercase tracking-wider" :class="netSettlement <= 0 ? 'text-emerald-800' : 'text-amber-800'">
                  {{ netSettlement <= 0 ? 'Customer Cash Refund Due' : 'Customer Balance Payable' }}
                </div>
                <div class="text-2xl font-black font-mono" :class="netSettlement <= 0 ? 'text-emerald-700' : 'text-amber-700'">
                  Rs {{ Math.abs(netSettlement).toFixed(2) }}
                </div>
              </div>

              <button 
                @click="handleRequestReturn"
                :disabled="!hasActiveReturns || isProcessing"
                :class="[
                  'w-full py-3 rounded-xl font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer',
                  hasActiveReturns ? 'bg-[#714B67] hover:bg-[#5c3d54] text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                ]"
              >
                <i v-if="isProcessing" class="fas fa-spinner fa-spin"></i>
                <i v-else class="fas fa-check-circle"></i>
                <span>Confirm Sales Return & Exchange</span>
              </button>
            </div>

          </aside>

        </div>

      </div>

    </div>

    <!-- Manager PIN Authorization Modal for Non-Authorized Users -->
    <ManagerPinModal 
      :show="isManagerPinOpen" 
      title="Manager PIN Authorization Required"
      actionDescription="Staff account requires Manager PIN approval to perform sales returns and refunds."
      @close="isManagerPinOpen = false"
      @authorized="executeSubmitReturn"
    />
  </div>
</template>
