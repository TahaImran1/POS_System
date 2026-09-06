<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSessionStore, type SessionEndReportData } from '../../stores/useSessionStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useToast } from '../../composables/useToast'
import CashDenominationsModal from './CashDenominationsModal.vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close', 'session-closed'])
const sessionStore = useSessionStore()
const settings = useSettingsStore()
const toast = useToast()

const isLoading = ref(true)
const report = ref<SessionEndReportData | null>(null)
const countedCash = ref<number | ''>(0)
const closingNote = ref('')
const isClosing = ref(false)

// Denominations modal state
const showDenominationModal = ref(false)
const cashBreakdown = ref<Record<number, number> | null>(null)

// Expandable Cash In / Out details
const showCashInOutDetails = ref(false)

// Cash In / Out mini modal
const showCashInOutModal = ref(false)
const cashInOutType = ref<'CASH_IN' | 'CASH_OUT_SAFE'>('CASH_IN')
const cashInOutAmount = ref<number | ''>('')
const cashInOutReason = ref('')
const isSubmittingCashInOut = ref(false)

// Denominations requested: 5000, 1000, 500, 100, 50, 20, 10
const allowedDenominations = [5000, 1000, 500, 100, 50, 20, 10]

const activeBreakdownEntries = computed(() => {
  if (!cashBreakdown.value) return []
  return allowedDenominations
    .filter(d => (cashBreakdown.value?.[d] || 0) > 0)
    .map(d => ({
      denom: d,
      qty: cashBreakdown.value?.[d] || 0,
      total: d * (cashBreakdown.value?.[d] || 0)
    }))
})

const formatMoney = (val: number | null | undefined): string => {
  const num = Number(val || 0)
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Fetch fresh session report when modal opens
watch(() => props.show, async (newVal) => {
  if (newVal) {
    isLoading.value = true
    try {
      const data = await sessionStore.loadSessionReport()
      report.value = data
      countedCash.value = data.expectedClosingCash
      cashBreakdown.value = data.closingNotesBreakdown || null
      closingNote.value = data.closingNote || ''
      showCashInOutDetails.value = false
    } catch (err: any) {
      console.error('Error loading session report:', err)
      toast.error('Could not load session report data.')
    } finally {
      isLoading.value = false
    }
  }
}, { immediate: true })

const expectedCash = computed(() => {
  return report.value ? report.value.expectedClosingCash : (sessionStore.openingBalance + sessionStore.cashSalesTotal)
})

const variance = computed(() => {
  const counted = Number(countedCash.value) || 0
  return Number((counted - expectedCash.value).toFixed(2))
})

const netCashInOut = computed(() => {
  if (!report.value) return 0
  const out = (report.value.vendorPaymentsTotal || 0) + (report.value.salesReturnsTotal || 0) + (report.value.cashDropsTotal || 0)
  return -Number(out.toFixed(2))
})

const formatDateTime = (timestamp: number | null | undefined) => {
  if (!timestamp) return 'Just Now'
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const copyExpectedCash = () => {
  countedCash.value = Number(expectedCash.value.toFixed(2))
  toast.info(`Counted set to expected: ${formatMoney(expectedCash.value)} Rs.`)
}

const clearCashCount = () => {
  countedCash.value = 0
  cashBreakdown.value = null
}

const handlePrint = () => {
  window.print()
}

const handleDenominationsConfirmed = (payload: { total: number; breakdown: Record<number, number> }) => {
  countedCash.value = payload.total
  cashBreakdown.value = payload.breakdown
  showDenominationModal.value = false
  toast.success(`Counted cash bills updated: ${formatMoney(payload.total)} Rs.`)
}

const handleConfirmClose = async (eventOrSkip?: boolean | MouseEvent) => {
  const skipBreakdownCheck = typeof eventOrSkip === 'boolean' ? eventOrSkip : false
  if (countedCash.value === '' || isNaN(Number(countedCash.value))) {
    toast.warning('Please enter actual counted cash.')
    return
  }

  // If user hasn't counted cash bills yet, prompt them with the Coins/Notes modal first
  if (!cashBreakdown.value && !skipBreakdownCheck) {
    showDenominationModal.value = true
    toast.info('Please enter the cash bills quantity counted in drawer.')
    return
  }

  isClosing.value = true
  try {
    const finalCounted = Number(countedCash.value) || 0
    await sessionStore.closeSession(
      finalCounted,
      report.value || undefined,
      cashBreakdown.value || undefined,
      closingNote.value.trim() || undefined
    )
    toast.success(`Session closed successfully! Counted: ${formatMoney(finalCounted)} Rs.`)
    emit('session-closed')
    emit('close')
  } catch (err: any) {
    toast.error('Failed to close session: ' + (err.message || err))
  } finally {
    isClosing.value = false
  }
}

const handleSaveCashInOut = async () => {
  const amt = Number(cashInOutAmount.value)
  if (!amt || amt <= 0) {
    toast.warning('Please enter a valid amount.')
    return
  }

  isSubmittingCashInOut.value = true
  try {
    await sessionStore.addCashDrop(
      cashInOutType.value,
      amt,
      cashInOutReason.value.trim() || (cashInOutType.value === 'CASH_IN' ? 'Manual Cash In' : 'Manual Safe Drop / Expense')
    )
    toast.success('Cash movement recorded.')
    showCashInOutModal.value = false
    cashInOutAmount.value = ''
    cashInOutReason.value = ''
    // Refresh session data
    report.value = await sessionStore.loadSessionReport()
  } catch (err: any) {
    toast.error('Failed to record cash movement: ' + (err.message || err))
  } finally {
    isSubmittingCashInOut.value = false
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
    
    <!-- Modal Card Matching Odoo Actual UI 1:1 -->
    <div class="bg-white rounded-lg shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col my-auto border border-gray-200">
      
      <!-- Odoo Header: Left "Closing Register" | Right "X orders: XX,XXX.XX Rs." -->
      <div class="px-6 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 bg-white">
        <h2 class="text-xl font-bold text-gray-900 tracking-tight">Closing Register</h2>
        <div class="text-sm font-bold text-gray-900">
          {{ report?.totalSalesCount || 0 }} orders: {{ formatMoney(report?.grossSalesTotal || 0) }} Rs.
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="p-12 text-center text-gray-500 space-y-3">
        <i class="fas fa-circle-notch fa-spin text-2xl text-[#714B67]"></i>
        <p class="text-xs font-semibold">Loading session audit details...</p>
      </div>

      <!-- Odoo Body Content Area -->
      <div v-else-if="report" class="px-6 py-4 space-y-4 text-sm text-gray-800 bg-white max-h-[78vh] overflow-y-auto">
        
        <!-- 1) CASH SECTION -->
        <div class="space-y-1.5">
          <!-- Main Cash Row -->
          <div class="flex items-center justify-between font-bold text-gray-900 text-sm">
            <span>Cash</span>
            <span>{{ formatMoney(expectedCash) }} Rs.</span>
          </div>

          <!-- Indented Sublines -->
          <div class="pl-4 space-y-1.5 text-xs">
            <!-- Opening -->
            <div class="flex items-center justify-between">
              <span class="text-gray-500">Opening</span>
              <span class="text-gray-700">{{ formatMoney(report.openingCash) }} Rs.</span>
            </div>

            <!-- Payments in Cash -->
            <div class="flex items-center justify-between">
              <span class="text-gray-500">Payments in Cash</span>
              <span class="text-gray-700">{{ formatMoney(report.cashSalesTotal) }} Rs.</span>
            </div>

            <!-- Expandable Cash In / Out -->
            <div>
              <div 
                @click="showCashInOutDetails = !showCashInOutDetails"
                class="flex items-center justify-between cursor-pointer hover:text-gray-900 select-none group"
                title="Click to toggle Cash In/Out breakdown"
              >
                <span class="flex items-center gap-1.5 text-gray-500 group-hover:text-gray-800">
                  <i :class="['fas text-[9px] text-gray-400 transition-transform duration-150', showCashInOutDetails ? 'fa-caret-down' : 'fa-caret-right']"></i>
                  <span>Cash In / Out</span>
                </span>
                <span class="text-gray-700">
                  {{ netCashInOut >= 0 ? '+' : '' }} {{ formatMoney(netCashInOut) }} Rs.
                </span>
              </div>

              <!-- Expanded Sublines for Cash In / Out -->
              <div v-if="showCashInOutDetails" class="mt-1.5 ml-3 pl-3 border-l-2 border-gray-200 space-y-1 text-[11px] text-gray-500">
                <div v-if="report.vendorPaymentsTotal > 0" class="flex justify-between">
                  <span>Vendor Payments in Cash</span>
                  <span class="text-rose-600">-{{ formatMoney(report.vendorPaymentsTotal) }} Rs.</span>
                </div>
                <div v-if="report.salesReturnsTotal > 0" class="flex justify-between">
                  <span>Sales Returns in Cash</span>
                  <span class="text-rose-600">-{{ formatMoney(report.salesReturnsTotal) }} Rs.</span>
                </div>
                <div v-if="report.cashDropsTotal > 0" class="flex justify-between">
                  <span>Register Safe Drops / Expenses</span>
                  <span class="text-rose-600">-{{ formatMoney(report.cashDropsTotal) }} Rs.</span>
                </div>
                <div v-if="!report.vendorPaymentsTotal && !report.salesReturnsTotal && !report.cashDropsTotal" class="text-gray-400 italic">
                  No vendor payouts, sales returns or cash drops logged.
                </div>
              </div>
            </div>

            <!-- Counted Cash -->
            <div class="flex items-center justify-between">
              <span class="text-gray-500">Counted</span>
              <span class="text-gray-700">{{ formatMoney(Number(countedCash) || 0) }} Rs.</span>
            </div>

            <!-- Difference (Red if negative) -->
            <div class="flex items-center justify-between font-bold">
              <span :class="variance < 0 ? 'text-rose-600' : 'text-gray-900'">Difference</span>
              <span :class="variance < 0 ? 'text-rose-600' : (variance > 0 ? 'text-emerald-600' : 'text-gray-700')">
                {{ variance > 0 ? '+' : '' }}{{ formatMoney(variance) }} Rs.
              </span>
            </div>
          </div>
        </div>

        <!-- 2) CARD SECTION -->
        <div class="space-y-1.5 pt-1">
          <div class="flex items-center justify-between font-bold text-gray-900 text-sm">
            <span>Card</span>
            <span>{{ formatMoney(report.cardSalesTotal) }} Rs.</span>
          </div>

          <div class="pl-4 space-y-1.5 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-gray-500">Counted</span>
              <span class="text-gray-700">{{ formatMoney(report.cardSalesTotal) }} Rs.</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-500">Difference</span>
              <span class="text-gray-700">0.00 Rs.</span>
            </div>
          </div>
        </div>

        <!-- 3) CUSTOMER ACCOUNT (CREDIT) SECTION -->
        <div class="space-y-1.5 pt-1">
          <div class="flex items-center justify-between font-bold text-gray-900 text-sm">
            <span>Customer Account</span>
            <span>{{ formatMoney(report.creditSalesTotal) }} Rs.</span>
          </div>

          <div class="pl-4 space-y-1.5 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-gray-500">Counted</span>
              <span class="text-gray-700">{{ formatMoney(report.creditSalesTotal) }} Rs.</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-500">Difference</span>
              <span class="text-gray-700">0.00 Rs.</span>
            </div>
          </div>
        </div>

        <!-- 4) CASH COUNT INPUT & ACTION CONTROLS (ODDO STYLE) -->
        <div class="pt-2">
          <label class="block text-xs font-normal text-gray-700 mb-1.5">Cash Count</label>
          <div class="flex items-center gap-2">
            
            <!-- Cash Input Box with clear 'X' button -->
            <div class="relative flex-1 flex items-center border border-gray-300 rounded focus-within:border-gray-500 bg-white shadow-2xs">
              <input 
                v-model.number="countedCash" 
                type="number" 
                step="0.01" 
                min="0"
                class="w-full py-2 px-3 text-sm text-gray-900 outline-none bg-transparent"
                placeholder="0"
              />
              <button 
                v-if="countedCash !== '' && countedCash !== 0" 
                type="button"
                @click="clearCashCount" 
                class="px-2.5 py-2 text-gray-400 hover:text-gray-700 cursor-pointer transition-colors"
                title="Clear count"
              >
                <i class="fas fa-times text-xs"></i>
              </button>
            </div>

            <!-- [💵] Coins / Notes Denominations Modal Button -->
            <button 
              type="button" 
              @click="showDenominationModal = true" 
              class="w-10 h-10 border border-gray-300 hover:bg-gray-100 active:bg-gray-200 rounded flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors shadow-2xs cursor-pointer shrink-0"
              title="Count Coins/Notes (10, 20, 50, 100, 500, 1000, 5000 Rs.)"
            >
              <i class="far fa-money-bill-alt text-base"></i>
            </button>

            <!-- [📋] Copy Expected Amount Button -->
            <button 
              type="button" 
              @click="copyExpectedCash" 
              class="w-10 h-10 border border-gray-300 hover:bg-gray-100 active:bg-gray-200 rounded flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors shadow-2xs cursor-pointer shrink-0"
              title="Set to expected cash amount ({{ formatMoney(expectedCash) }} Rs.)"
            >
              <i class="far fa-copy text-sm"></i>
            </button>
          </div>

          <!-- Subtle notes breakdown pill indicator if bills counted -->
          <div v-if="cashBreakdown && activeBreakdownEntries.length > 0" class="mt-2 text-[11px] text-gray-600 flex items-center gap-1.5 flex-wrap">
            <span class="text-gray-500 font-medium">Counted notes:</span>
            <span 
              v-for="item in activeBreakdownEntries" 
              :key="item.denom"
              class="bg-gray-100 border border-gray-200 text-gray-700 px-2 py-0.5 rounded text-[11px] font-mono"
            >
              Rs {{ item.denom }} &times; {{ item.qty }}
            </span>
            <button 
              type="button" 
              @click="showDenominationModal = true" 
              class="text-[#714B67] hover:underline font-bold text-[10px] ml-1 cursor-pointer"
            >
              Edit
            </button>
          </div>
        </div>

        <!-- 5) CLOSING NOTE TEXTAREA -->
        <div class="pt-1">
          <label class="block text-xs font-normal text-gray-700 mb-1.5">Closing note</label>
          <textarea 
            v-model="closingNote" 
            rows="3" 
            placeholder="Add a closing note..." 
            class="w-full border border-gray-300 rounded p-2.5 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-gray-500 resize-none shadow-2xs"
          ></textarea>
        </div>

      </div>

      <!-- Odoo Footer: Left [Close Register] [Discard] | Right [Cash In/Out] [Daily Sale 📥] -->
      <div class="px-6 py-3.5 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div class="flex items-center gap-2">
          <button 
            @click="handleConfirmClose" 
            :disabled="isClosing || isLoading"
            class="px-4 py-2 bg-[#714B67] hover:bg-[#5c3d54] active:bg-[#4a3144] disabled:opacity-50 text-white font-bold rounded text-xs transition-colors shadow-2xs cursor-pointer"
          >
            {{ isClosing ? 'Closing...' : 'Close Register' }}
          </button>
          
          <button 
            @click="$emit('close')" 
            :disabled="isClosing"
            class="px-4 py-2 bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-300 text-gray-700 font-medium rounded text-xs transition-colors shadow-2xs cursor-pointer"
          >
            Discard
          </button>
        </div>

        <div class="flex items-center gap-2">
          <button 
            @click="showCashInOutModal = true" 
            type="button"
            class="px-3 py-2 bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-300 text-gray-700 font-medium rounded text-xs transition-colors shadow-2xs cursor-pointer"
          >
            Cash In/Out
          </button>

          <button 
            @click="handlePrint" 
            type="button"
            class="px-3 py-2 bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-300 text-gray-700 font-medium rounded text-xs transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="Print full Session End Closing Report slip"
          >
            <span>Daily Sale</span>
            <i class="fas fa-download text-[10px]"></i>
          </button>
        </div>
      </div>

    </div>

    <!-- Mini Modal: Cash In / Out (Odoo Register Money Flow) -->
    <div v-if="showCashInOutModal" class="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-3 backdrop-blur-xs">
      <div class="bg-white rounded-lg shadow-2xl w-full max-w-sm border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-150">
        <div class="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
          <h3 class="font-bold text-sm text-gray-900">Cash In / Out</h3>
          <button @click="showCashInOutModal = false" class="text-gray-400 hover:text-gray-700 cursor-pointer">
            <i class="fas fa-times text-xs"></i>
          </button>
        </div>

        <div class="p-5 space-y-3.5 text-xs">
          <!-- Flow Type Switcher -->
          <div class="grid grid-cols-2 gap-2">
            <button 
              type="button"
              @click="cashInOutType = 'CASH_IN'"
              :class="[
                'py-2 px-3 rounded font-bold border text-center transition-all cursor-pointer',
                cashInOutType === 'CASH_IN' 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-400' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              ]"
            >
              <i class="fas fa-arrow-down text-emerald-600 mr-1"></i> Cash In
            </button>

            <button 
              type="button"
              @click="cashInOutType = 'CASH_OUT_SAFE'"
              :class="[
                'py-2 px-3 rounded font-bold border text-center transition-all cursor-pointer',
                cashInOutType === 'CASH_OUT_SAFE' 
                  ? 'bg-rose-50 border-rose-500 text-rose-800 ring-1 ring-rose-400' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              ]"
            >
              <i class="fas fa-arrow-up text-rose-600 mr-1"></i> Cash Out / Safe
            </button>
          </div>

          <!-- Amount -->
          <div>
            <label class="block font-medium text-gray-700 mb-1">Amount (Rs.)</label>
            <input 
              v-model.number="cashInOutAmount" 
              type="number" 
              step="0.01" 
              min="0"
              placeholder="0.00" 
              class="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:border-gray-500 font-mono"
            />
          </div>

          <!-- Reason / Note -->
          <div>
            <label class="block font-medium text-gray-700 mb-1">Reason / Note</label>
            <input 
              v-model="cashInOutReason" 
              type="text" 
              placeholder="e.g. Added change, Bank deposit, Safe drop" 
              class="w-full border border-gray-300 rounded p-2 text-xs outline-none focus:border-gray-500"
            />
          </div>
        </div>

        <div class="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button 
            @click="showCashInOutModal = false"
            class="px-3 py-1.5 bg-white border border-gray-300 rounded text-gray-700 font-medium text-xs hover:bg-gray-100 cursor-pointer"
          >
            Cancel
          </button>
          <button 
            @click="handleSaveCashInOut"
            :disabled="isSubmittingCashInOut"
            class="px-4 py-1.5 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded text-xs transition-colors cursor-pointer"
          >
            {{ isSubmittingCashInOut ? 'Saving...' : 'Confirm' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Coins / Notes Denominations Modal (10, 20, 50, 100, 500, 1000, 5000) -->
    <CashDenominationsModal
      :show="showDenominationModal"
      :initialBreakdown="cashBreakdown || undefined"
      @close="showDenominationModal = false"
      @confirm="handleDenominationsConfirmed"
    />

    <!-- Hidden Thermal Printable Slip Template (80mm POS Slip) -->
    <div id="session-receipt-print" class="hidden print:block text-black p-4 font-mono text-[11px] leading-tight max-w-[80mm] mx-auto">
      <div class="text-center pb-2 border-b border-dashed border-black mb-2">
        <h2 class="font-black text-sm uppercase">{{ settings.storeName || 'POS RETAIL STORE' }}</h2>
        <p class="text-[10px]">SESSION END CLOSING REPORT</p>
        <p class="text-[10px]">Terminal: {{ report?.nodeId }}</p>
        <p class="text-[10px]">Session: #{{ report?.sessionId ? report.sessionId.substr(0, 8).toUpperCase() : '' }}</p>
        <p class="text-[10px]">Cashier: {{ report?.cashierName }}</p>
        <p class="text-[9px]">Printed: {{ formatDateTime(Date.now()) }}</p>
      </div>

      <div class="space-y-1.5 border-b border-dashed border-black pb-2 mb-2">
        <!-- 1) Opening Cash -->
        <div class="flex justify-between font-bold">
          <span>1. OPENING CASH FLOAT:</span>
          <span>Rs {{ formatMoney(report?.openingCash) }}</span>
        </div>

        <div class="border-t border-dotted border-gray-400 my-1"></div>

        <!-- 2) Total Sales -->
        <div class="font-bold">2. TOTAL SALES:</div>
        <div class="flex justify-between pl-2">
          <span>i) Cash Sales:</span>
          <span>Rs {{ formatMoney(report?.cashSalesTotal) }}</span>
        </div>
        <div class="flex justify-between pl-2">
          <span>ii) Credit Sales:</span>
          <span>Rs {{ formatMoney(report?.creditSalesTotal) }}</span>
        </div>
        <div class="flex justify-between pl-2">
          <span>iii) Card Sales:</span>
          <span>Rs {{ formatMoney(report?.cardSalesTotal) }}</span>
        </div>
        <div class="flex justify-between pl-2 font-bold text-gray-800">
          <span>iv) Sales Returns:</span>
          <span>-Rs {{ formatMoney(report?.salesReturnsTotal) }}</span>
        </div>
        <div class="flex justify-between font-bold border-t border-dotted border-gray-400 pt-1">
          <span>NET TOTAL SALES:</span>
          <span>Rs {{ formatMoney(report?.netSalesTotal) }}</span>
        </div>

        <div class="border-t border-dotted border-gray-400 my-1"></div>

        <!-- 3) Payments -->
        <div class="font-bold">3. PAYMENTS &amp; DROPS:</div>
        <div class="flex justify-between pl-2">
          <span>i) Vendors Payments:</span>
          <span>-Rs {{ formatMoney(report?.vendorPaymentsTotal) }}</span>
        </div>
        <div v-if="report && report.cashDropsTotal > 0" class="flex justify-between pl-2">
          <span>ii) Safe Drops / Exp:</span>
          <span>-Rs {{ formatMoney(report?.cashDropsTotal) }}</span>
        </div>
      </div>

      <!-- 4) Expected Closing Cash -->
      <div class="space-y-1.5 border-b-2 border-black pb-2 mb-3">
        <div class="flex justify-between font-black text-xs">
          <span>EXPECTED CLOSING CASH:</span>
          <span>Rs {{ formatMoney(report?.expectedClosingCash) }}</span>
        </div>
        <div class="flex justify-between font-bold">
          <span>ACTUAL COUNTED CASH:</span>
          <span>Rs {{ formatMoney(Number(countedCash) || 0) }}</span>
        </div>
        <div class="flex justify-between font-bold">
          <span>CASH VARIANCE:</span>
          <span>{{ variance > 0 ? '+' : '' }}{{ formatMoney(variance) }} Rs</span>
        </div>

        <!-- Cash Bills Denomination breakdown on print slip -->
        <div v-if="activeBreakdownEntries.length > 0" class="border-t border-dotted border-gray-500 pt-1 mt-1 text-[10px]">
          <div class="font-bold uppercase tracking-wider mb-0.5">CASH BILLS BREAKDOWN:</div>
          <div v-for="item in activeBreakdownEntries" :key="item.denom" class="flex justify-between pl-2 text-gray-800">
            <span>Rs {{ item.denom }} &times; {{ item.qty }}</span>
            <span>Rs {{ formatMoney(item.denom * item.qty) }}</span>
          </div>
        </div>

        <!-- Closing Note on slip if present -->
        <div v-if="closingNote.trim()" class="border-t border-dotted border-gray-500 pt-1 mt-1 text-[10px]">
          <div class="font-bold uppercase tracking-wider mb-0.5">CLOSING NOTE:</div>
          <p class="text-gray-800 italic pl-1">{{ closingNote }}</p>
        </div>
      </div>

      <!-- Signatures -->
      <div class="pt-4 space-y-6 text-[10px]">
        <div class="flex justify-between">
          <div class="w-28 border-t border-black text-center pt-1">Cashier Signature</div>
          <div class="w-28 border-t border-black text-center pt-1">Manager Signature</div>
        </div>
        <p class="text-center text-[8px] text-gray-500">End of Session Audit Slip</p>
      </div>
    </div>

  </div>
</template>

<style scoped>
@media print {
  body * {
    visibility: hidden;
  }
  #session-receipt-print, #session-receipt-print * {
    visibility: visible;
  }
  #session-receipt-print {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 10px;
  }
}
</style>
