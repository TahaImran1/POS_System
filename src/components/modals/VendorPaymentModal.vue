<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  getVendors, 
  createVendor, 
  getDamagedExpiredHoldQueue, 
  processVendorPaymentWithDebitNote, 
  type Vendor, 
  type DamagedExpiredHoldItem, 
  type VendorPaymentPayload 
} from '../../services/vendorService'
import { useSessionStore } from '../../stores/useSessionStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useToast } from '../../composables/useToast'

const props = defineProps<{
  show: boolean
  initialVendorId?: string
  initialPoId?: string
  initialAmount?: number
}>()

const emit = defineEmits(['close', 'payment-success'])

const sessionStore = useSessionStore()
const authStore = useAuthStore()
const toast = useToast()

const vendors = ref<Vendor[]>([])
const selectedVendorId = ref<string>('')
const holdQueue = ref<DamagedExpiredHoldItem[]>([])
const selectedHoldIds = ref<string[]>([])

const amountPaid = ref<number>(0)
const paymentMethod = ref<string>('Cash')
const notes = ref<string>('')
const isProcessing = ref(false)
const isLoadingData = ref(false)

// New Vendor Modal State
const showAddVendor = ref(false)
const newVendor = ref({
  name: '',
  company_name: '',
  phone: '',
  email: '',
  address: '',
  opening_balance: 0
})

const selectedVendor = computed(() => {
  return vendors.value.find(v => v.vendor_id === selectedVendorId.value) || null
})

async function loadData() {
  isLoadingData.value = true
  try {
    vendors.value = await getVendors()
    holdQueue.value = await getDamagedExpiredHoldQueue('PENDING_CLAIM')

    if (props.initialVendorId) {
      selectedVendorId.value = props.initialVendorId
    } else if (vendors.value.length > 0 && !selectedVendorId.value) {
      selectedVendorId.value = vendors.value[0].vendor_id
    }

    if (props.initialAmount) {
      amountPaid.value = props.initialAmount
    }
  } catch (e) {
    console.error('Error loading vendor payment data:', e)
  } fontally: {
    isLoadingData.value = false
  }
}

watch(() => props.show, (isOpen) => {
  if (isOpen) {
    loadData()
    notes.value = props.initialPoId ? `Payment for Purchase Order (PO #${props.initialPoId})` : 'Vendor Account Settlement'
    selectedHoldIds.value = []
  }
}, { immediate: true })

// Calculate Debit Note Credit from selected hold items
const debitNoteTotal = computed(() => {
  return holdQueue.value
    .filter(h => selectedHoldIds.value.includes(h.hold_id))
    .reduce((sum, h) => sum + (h.quantity * h.cost_price), 0)
})

const totalSettlementReduction = computed(() => {
  return (amountPaid.value || 0) + debitNoteTotal.value
})

const projectedVendorBalance = computed(() => {
  if (!selectedVendor.value) return 0
  return selectedVendor.value.balance - totalSettlementReduction.value
})

function toggleHoldSelection(holdId: string) {
  if (selectedHoldIds.value.includes(holdId)) {
    selectedHoldIds.value = selectedHoldIds.value.filter(id => id !== holdId)
  } else {
    selectedHoldIds.value.push(holdId)
  }
}

function selectAllHoldItems() {
  selectedHoldIds.value = holdQueue.value.map(h => h.hold_id)
}

function clearHoldSelections() {
  selectedHoldIds.value = []
}

async function handleCreateNewVendor() {
  if (!newVendor.value.name.trim()) {
    toast.warning('Please enter Vendor Name.')
    return
  }
  try {
    const created = await createVendor(newVendor.value)
    vendors.value.unshift(created)
    selectedVendorId.value = created.vendor_id
    showAddVendor.value = false
    newVendor.value = { name: '', company_name: '', phone: '', email: '', address: '', opening_balance: 0 }
    toast.success(`Created vendor: ${created.name}`)
  } catch (e: any) {
    toast.error('Failed to create vendor: ' + e.message)
  }
}

async function handleSubmitPayment() {
  if (!selectedVendorId.value) {
    toast.warning('Please select a vendor.')
    return
  }

  if (totalSettlementReduction.value <= 0) {
    toast.warning('Please enter a payment amount or select damaged/expired hold items for Debit Note credit.')
    return
  }

  isProcessing.value = true
  try {
    const payload: VendorPaymentPayload = {
      vendor_id: selectedVendorId.value,
      po_id: props.initialPoId,
      session_id: sessionStore.sessionId,
      amount_paid: amountPaid.value || 0,
      payment_method: paymentMethod.value,
      selected_hold_ids: selectedHoldIds.value,
      user_name: authStore.currentUser?.name || 'Store Manager',
      notes: notes.value
    }

    const payId = await processVendorPaymentWithDebitNote(payload)
    toast.success(`Vendor payment processed successfully! (Ref #${payId.substr(0, 8).toUpperCase()})`)
    emit('payment-success', payId)
    emit('close')
  } catch (e: any) {
    toast.error('Payment processing failed: ' + (e.message || e))
  } finally {
    isProcessing.value = false
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-xs">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      
      <!-- Modal Header -->
      <div class="bg-[#714B67] text-white p-4 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <i class="fas fa-[#2ECC71] fa-file-invoice-dollar text-amber-300 text-xl"></i>
          <div>
            <h2 class="font-bold text-base">Vendor Payment & Debit Note Settlement</h2>
            <p class="text-xs text-white/80">Pay vendors, issue Debit Notes for damaged/expired goods, and reconcile accounts</p>
          </div>
        </div>

        <button @click="$emit('close')" class="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-lg font-bold">
          ✕
        </button>
      </div>

      <!-- Main Body -->
      <div class="flex-1 flex overflow-hidden bg-gray-50/50">

        <!-- Left Pane: Vendor Directory & Payment Controls -->
        <div class="flex-1 p-5 overflow-y-auto space-y-4 border-r border-gray-200 bg-white">
          
          <!-- Vendor Selector & Add Vendor Button -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="font-bold text-xs text-gray-700">Select Vendor / Supplier</label>
              <button 
                @click="showAddVendor = !showAddVendor"
                class="text-xs text-[#714B67] font-bold hover:underline flex items-center gap-1"
              >
                <i class="fas fa-plus"></i> + Add New Vendor
              </button>
            </div>

            <select 
              v-model="selectedVendorId"
              class="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:border-[#714B67] bg-white shadow-2xs"
            >
              <option v-for="v in vendors" :key="v.vendor_id" :value="v.vendor_id">
                {{ v.name }} {{ v.company_name ? ' (' + v.company_name + ')' : '' }} — Balance: Rs {{ v.balance.toFixed(2) }}
              </option>
            </select>
          </div>

          <!-- Add Vendor Inline Form -->
          <div v-if="showAddVendor" class="p-4 bg-purple-50 rounded-xl border border-purple-200 space-y-3 text-xs">
            <h4 class="font-bold text-purple-950">Add New Supplier Profile</h4>
            <div class="grid grid-cols-2 gap-2">
              <input v-model="newVendor.name" type="text" placeholder="Vendor Name *" class="px-2.5 py-1.5 bg-white border border-gray-300 rounded font-semibold" />
              <input v-model="newVendor.company_name" type="text" placeholder="Company / Brand" class="px-2.5 py-1.5 bg-white border border-gray-300 rounded font-semibold" />
              <input v-model="newVendor.phone" type="text" placeholder="Phone #" class="px-2.5 py-1.5 bg-white border border-gray-300 rounded font-semibold" />
              <input v-model="newVendor.opening_balance" type="number" placeholder="Opening Balance (Rs)" class="px-2.5 py-1.5 bg-white border border-gray-300 rounded font-semibold" />
            </div>
            <div class="flex justify-end gap-2 pt-1">
              <button @click="showAddVendor = false" class="px-3 py-1 bg-white border border-gray-300 rounded text-gray-700 font-bold">Cancel</button>
              <button @click="handleCreateNewVendor" class="px-3 py-1 bg-[#714B67] text-white rounded font-bold">Save Vendor</button>
            </div>
          </div>

          <!-- Vendor Balance Summary Box -->
          <div v-if="selectedVendor" class="p-4 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2 text-xs font-mono">
            <div class="flex justify-between items-center text-purple-950 font-bold font-sans">
              <span class="text-sm font-black">{{ selectedVendor.name }}</span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-purple-200 text-purple-900 uppercase">Vendor Ledger</span>
            </div>

            <div class="flex justify-between items-center text-gray-700 font-semibold border-t border-purple-100 pt-2">
              <span class="font-sans">Current Payable Balance:</span>
              <span class="font-bold text-sm" :class="selectedVendor.balance > 0 ? 'text-rose-700' : 'text-emerald-700'">
                Rs {{ selectedVendor.balance.toFixed(2) }}
              </span>
            </div>

            <div v-if="debitNoteTotal > 0" class="flex justify-between items-center text-indigo-900 border-t border-purple-100 pt-1.5">
              <span class="font-sans">Debit Note Claim Credit:</span>
              <span class="font-bold">-Rs {{ debitNoteTotal.toFixed(2) }}</span>
            </div>

            <div class="flex justify-between items-center text-gray-900 font-black border-t-2 border-purple-200 pt-2 font-sans text-sm">
              <span>Projected Balance After Settlement:</span>
              <span class="font-mono text-base font-black text-[#00A09D]">
                Rs {{ projectedVendorBalance.toFixed(2) }}
              </span>
            </div>
          </div>

          <!-- Payment Form -->
          <div class="space-y-3 pt-2 text-xs">
            <div>
              <label class="block font-bold text-gray-700 mb-1">Direct Cash / Bank Payment Amount (Rs)</label>
              <input 
                v-model.number="amountPaid"
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter amount paid..."
                class="w-full px-3 py-2 border border-gray-300 rounded-xl text-base font-mono font-black text-gray-900 focus:outline-none focus:border-[#714B67]"
              />
            </div>

            <div>
              <label class="block font-bold text-gray-700 mb-1">Payment Method</label>
              <select 
                v-model="paymentMethod"
                class="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold text-gray-900 focus:outline-none focus:border-[#714B67]"
              >
                <option value="Cash">💵 Cash Drawer Drop (CASH_OUT)</option>
                <option value="Bank">💳 Bank Transfer / Online</option>
                <option value="Cheque">📄 Cheque Settlement</option>
                <option value="Debit Note Credit">🏷️ Debit Note Offset Only</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-gray-700 mb-1">Payment Reference / Notes</label>
              <input 
                v-model="notes"
                type="text"
                placeholder="e.g. Settlement for PO #104 / Delivery payout"
                class="w-full px-3 py-2 border border-gray-300 rounded-xl font-semibold text-gray-900 focus:outline-none focus:border-[#714B67]"
              />
            </div>
          </div>

        </div>

        <!-- Right Pane: Damaged / Expired Hold Queue (Debit Note Claims) -->
        <aside class="w-[400px] bg-slate-50 border-l border-gray-200 flex flex-col h-full shrink-0">
          
          <div class="p-4 bg-gray-900 text-white font-bold text-xs flex justify-between items-center shrink-0">
            <div class="flex items-center gap-1.5">
              <i class="fas fa-biohazard text-rose-400"></i>
              <span>Damaged / Expired Hold Queue</span>
            </div>

            <div class="flex gap-1 text-[10px]">
              <button @click="selectAllHoldItems" class="px-2 py-0.5 bg-white/20 rounded hover:bg-white/30 font-bold">Select All</button>
              <button @click="clearHoldSelections" class="px-2 py-0.5 bg-white/20 rounded hover:bg-white/30 font-bold">Clear</button>
            </div>
          </div>

          <!-- Pending Items List -->
          <div class="flex-1 overflow-y-auto p-4 space-y-3">
            <div v-if="holdQueue.length === 0" class="p-8 text-center text-gray-400 text-xs">
              <i class="fas fa-check-circle text-3xl mb-2 text-emerald-400"></i>
              <p class="font-bold text-gray-600">No damaged/expired items in hold queue</p>
              <p class="text-[11px] text-gray-400 mt-1">Customer sales returns logged as Damaged or Expired will appear here for vendor Debit Note claims.</p>
            </div>

            <div v-else class="space-y-2">
              <p class="text-[11px] text-gray-500 font-semibold mb-2">
                Check items below to issue a <strong>Vendor Debit Note Claim</strong> (`VENDOR_RECLAIMED`):
              </p>

              <div 
                v-for="item in holdQueue"
                :key="item.hold_id"
                @click="toggleHoldSelection(item.hold_id)"
                class="p-3 bg-white border rounded-xl shadow-2xs transition-all cursor-pointer space-y-1.5"
                :class="selectedHoldIds.includes(item.hold_id) ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/30' : 'border-gray-200 hover:border-gray-300'"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <input 
                      type="checkbox"
                      :checked="selectedHoldIds.includes(item.hold_id)"
                      class="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <div>
                      <h5 class="font-bold text-xs text-gray-900 line-clamp-1">{{ item.product_name }}</h5>
                      <span class="text-[10px] text-gray-400 font-mono">Barcode: #{{ item.product_barcode || 'N/A' }}</span>
                    </div>
                  </div>

                  <span 
                    class="px-2 py-0.5 rounded text-[9px] font-black uppercase shrink-0"
                    :class="item.condition === 'EXPIRED_HOLD' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-rose-100 text-rose-900 border border-rose-300'"
                  >
                    {{ item.condition === 'EXPIRED_HOLD' ? '⚠️ Expired' : '🔴 Damaged' }}
                  </span>
                </div>

                <div class="flex justify-between items-center text-xs font-mono border-t border-gray-100 pt-1.5">
                  <span class="text-gray-600 font-sans">Return Qty: <strong>{{ item.quantity }} Pcs</strong></span>
                  <span class="font-bold text-purple-900">Claim: Rs {{ (item.quantity * item.cost_price).toFixed(2) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Total Settlement Footer -->
          <div class="p-4 bg-white border-t border-gray-200 space-y-3 shrink-0">
            <div class="p-3 rounded-xl bg-purple-50 border border-purple-200 space-y-1 text-xs font-mono">
              <div class="flex justify-between text-gray-700 font-sans font-semibold">
                <span>Direct Cash/Bank Payment:</span>
                <span class="font-bold">Rs {{ (amountPaid || 0).toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-indigo-700 font-sans font-semibold">
                <span>Debit Note Claim Credit:</span>
                <span class="font-bold">+Rs {{ debitNoteTotal.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-sm font-black text-purple-950 border-t border-purple-200 pt-1.5 font-sans">
                <span>Total Balance Reduction:</span>
                <span class="font-mono text-[#00A09D]">Rs {{ totalSettlementReduction.toFixed(2) }}</span>
              </div>
            </div>

            <button 
              @click="handleSubmitPayment"
              :disabled="totalSettlementReduction <= 0 || isProcessing"
              :class="[
                'w-full py-3 rounded-xl font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer',
                totalSettlementReduction > 0 ? 'bg-[#714B67] hover:bg-[#5c3d54] text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              ]"
            >
              <i v-if="isProcessing" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-check-circle"></i>
              <span>Confirm & Process Vendor Payment</span>
            </button>
          </div>

        </aside>

      </div>

    </div>
  </div>
</template>
