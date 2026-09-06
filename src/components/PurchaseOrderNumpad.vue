<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePurchaseOrderStore } from '../stores/usePurchaseOrderStore'
import { useToast } from '../composables/useToast'

const emit = defineEmits(['submit-po'])
const poStore = usePurchaseOrderStore()
const toast = useToast()

const showVendorModal = ref(false)
const modalVendorId = ref(poStore.selectedVendorId)

const clearTooltip = computed(() => {
  if (poStore.numpadMode === 'qty') {
    return 'Reduce quantity (clears to 0, or removes item if already 0)'
  } else if (poStore.numpadMode === 'cost') {
    return 'Reset Cost Rate to 0.00'
  } else {
    return 'Reset Selling Rate to 0.00'
  }
})

const activeVendorName = computed(() => {
  if (poStore.activeItem?.vendor_name) return poStore.activeItem.vendor_name
  const v = poStore.vendors.find(x => x.vendor_id === poStore.selectedVendorId)
  return v?.name || 'Assign Vendor'
})

const handleKey = (val: string) => {
  poStore.handleNumpadInput(val)
}

const handleOpenVendorModal = () => {
  modalVendorId.value = poStore.selectedVendorId || (poStore.vendors[0]?.vendor_id || '')
  showVendorModal.value = true
}

const handleApplyVendorToAll = async () => {
  if (!modalVendorId.value) {
    toast.warning('Please select a vendor.')
    return
  }
  await poStore.assignVendorToAll(modalVendorId.value)
  showVendorModal.value = false
  const v = poStore.vendors.find(x => x.vendor_id === modalVendorId.value)
  toast.success(`Assigned "${v?.name || 'Vendor'}" to all items in PO cart!`)
}

const handleApplyVendorToSelected = async () => {
  if (!modalVendorId.value) {
    toast.warning('Please select a vendor.')
    return
  }
  if (!poStore.selectedItemId) {
    toast.warning('Please select a cart line item first.')
    return
  }
  await poStore.assignVendorToItem(poStore.selectedItemId, modalVendorId.value)
  showVendorModal.value = false
  const v = poStore.vendors.find(x => x.vendor_id === modalVendorId.value)
  toast.success(`Assigned "${v?.name || 'Vendor'}" to selected item!`)
}

const handleEditInvoiceRef = () => {
  const ref = prompt('Enter PO Reference / Supplier Invoice #:', poStore.invoiceRef)
  if (ref !== null) {
    poStore.invoiceRef = ref.trim() || 'Supplier Delivery & Restock'
  }
}
</script>

<template>
  <div class="flex flex-col bg-white border-t border-gray-200 shrink-0 select-none">
    <!-- Top Action Row: Vendor Assignment, Note, Direction Mode & Clear -->
    <div class="grid grid-cols-4 gap-1 p-1.5 bg-gray-50 border-b border-gray-200 text-xs">
      <!-- 1. Assign Vendor Button -->
      <button 
        @click="handleOpenVendorModal"
        class="py-1 px-1.5 bg-white border border-purple-300 hover:bg-purple-50 text-purple-950 font-bold rounded shadow-2xs flex items-center justify-center gap-1 text-[11px] cursor-pointer truncate"
        title="Assign Supplier / Vendor to Cart Items"
      >
        <i class="fas fa-truck text-purple-700"></i>
        <span class="truncate">{{ activeVendorName }}</span>
      </button>

      <!-- 2. PO Note / Ref Button -->
      <button 
        @click="handleEditInvoiceRef"
        class="py-1 px-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold rounded shadow-2xs flex items-center justify-center gap-1 text-[11px] cursor-pointer truncate"
        title="Edit PO Reference / Invoice Number"
      >
        <i class="fas fa-file-invoice text-gray-500"></i>
        <span class="truncate">{{ poStore.invoiceRef }}</span>
      </button>

      <!-- 3. Toggle Direction (+ Restock / - Reduce) -->
      <button 
        @click="poStore.toggleItemDirection()"
        :class="[
          'py-1 px-1.5 rounded font-black shadow-2xs flex items-center justify-center gap-1 text-[11px] cursor-pointer transition-colors',
          poStore.activeItem?.direction === '-' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
        ]"
        title="Toggle Restock (+) or Reduction (-)"
      >
        <span>{{ poStore.activeItem?.direction === '-' ? '🔴 Return (-)' : '🟢 Restock (+)' }}</span>
      </button>

      <!-- 4. Dynamic Target Clear (Qty Reduction/Remove, Zero Cost Rate, Zero Sell Rate) -->
      <button 
        @click="poStore.clearActiveTarget()"
        :disabled="poStore.items.length === 0"
        class="py-1 px-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold rounded shadow-2xs flex items-center justify-center gap-1 text-[11px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        :title="clearTooltip"
      >
        <i class="fas fa-eraser"></i>
        <span>Clear</span>
      </button>
    </div>

    <!-- Main Numpad & Rate Mode Selectors Layout -->
    <div class="p-1.5 bg-white space-y-1.5">
      <div class="grid grid-cols-4 gap-1.5 h-[115px]">
        
        <!-- Left: 1 to 9 Numpad Keys -->
        <div class="col-span-3 grid grid-cols-3 gap-1.5 h-full">
          <button @click="handleKey('1')" class="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 font-bold text-gray-800 rounded text-sm cursor-pointer transition-colors">1</button>
          <button @click="handleKey('2')" class="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 font-bold text-gray-800 rounded text-sm cursor-pointer transition-colors">2</button>
          <button @click="handleKey('3')" class="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 font-bold text-gray-800 rounded text-sm cursor-pointer transition-colors">3</button>
          
          <button @click="handleKey('4')" class="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 font-bold text-gray-800 rounded text-sm cursor-pointer transition-colors">4</button>
          <button @click="handleKey('5')" class="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 font-bold text-gray-800 rounded text-sm cursor-pointer transition-colors">5</button>
          <button @click="handleKey('6')" class="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 font-bold text-gray-800 rounded text-sm cursor-pointer transition-colors">6</button>
          
          <button @click="handleKey('7')" class="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 font-bold text-gray-800 rounded text-sm cursor-pointer transition-colors">7</button>
          <button @click="handleKey('8')" class="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 font-bold text-gray-800 rounded text-sm cursor-pointer transition-colors">8</button>
          <button @click="handleKey('9')" class="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 font-bold text-gray-800 rounded text-sm cursor-pointer transition-colors">9</button>

          <button @click="handleKey('.')" class="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 font-black text-gray-800 rounded text-sm cursor-pointer transition-colors">.</button>
          <button @click="handleKey('0')" class="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 font-bold text-gray-800 rounded text-sm cursor-pointer transition-colors">0</button>
          <button @click="handleKey('backspace')" class="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 font-bold text-gray-800 rounded flex items-center justify-center cursor-pointer transition-colors" title="Backspace">
            <i class="fas fa-backspace text-xs text-gray-700"></i>
          </button>
        </div>

        <!-- Right: Mode Selectors (Qty | Cost Rate | Selling Rate) -->
        <div class="flex flex-col gap-1.5 h-full">
          <!-- 1. Qty Mode Button -->
          <button 
            @click="poStore.setNumpadMode('qty')"
            :class="[
              'flex-1 font-black text-[11px] rounded transition-all flex items-center justify-center cursor-pointer shadow-2xs',
              poStore.numpadMode === 'qty' ? 'bg-[#714B67] text-white ring-2 ring-purple-300 scale-[1.02]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            ]"
          >
            <span>Qty</span>
          </button>

          <!-- 2. Cost Rate Mode Button -->
          <button 
            @click="poStore.setNumpadMode('cost')"
            :class="[
              'flex-1 font-black text-[11px] rounded transition-all flex items-center justify-center cursor-pointer shadow-2xs leading-tight text-center px-0.5',
              poStore.numpadMode === 'cost' ? 'bg-purple-900 text-white ring-2 ring-purple-400 scale-[1.02]' : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
            ]"
          >
            <span>Cost Rate</span>
          </button>

          <!-- 3. Selling Rate Mode Button -->
          <button 
            @click="poStore.setNumpadMode('price')"
            :class="[
              'flex-1 font-black text-[11px] rounded transition-all flex items-center justify-center cursor-pointer shadow-2xs leading-tight text-center px-0.5',
              poStore.numpadMode === 'price' ? 'bg-teal-700 text-white ring-2 ring-teal-300 scale-[1.02]' : 'bg-teal-50 text-teal-900 border border-teal-200 hover:bg-teal-100'
            ]"
          >
            <span>Sell Rate</span>
          </button>
        </div>
      </div>

      <!-- Bottom Submission Button: Big Green/Purple PO Receive Action -->
      <button 
        @click="$emit('submit-po')"
        :disabled="poStore.items.length === 0"
        class="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.99] text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-between px-4 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <div class="flex items-center gap-2">
          <i class="fas fa-boxes text-amber-300 text-sm"></i>
          <span>Confirm & Receive Purchase Order</span>
        </div>
        <div class="font-mono text-sm font-black bg-black/20 px-2 py-0.5 rounded">
          Rs {{ Math.abs(poStore.totalCost).toFixed(2) }}
        </div>
      </button>
    </div>

    <!-- Vendor Assignment Modal -->
    <div v-if="showVendorModal" class="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-purple-900/20 animate-in fade-in zoom-in-95 duration-150">
        <div class="bg-[#714B67] text-white p-4 flex justify-between items-center">
          <div class="flex items-center gap-2 font-black text-sm">
            <i class="fas fa-truck text-amber-400"></i>
            <span>Assign Supplier / Vendor</span>
          </div>
          <button @click="showVendorModal = false" class="text-white/80 hover:text-white font-bold text-base cursor-pointer">✕</button>
        </div>

        <div class="p-5 space-y-4 text-xs">
          <div>
            <label class="block font-bold text-gray-800 mb-1.5">Select Vendor</label>
            <select 
              v-model="modalVendorId" 
              class="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs text-gray-900 focus:outline-none focus:border-[#714B67]"
            >
              <option v-for="v in poStore.vendors" :key="v.vendor_id" :value="v.vendor_id">
                {{ v.name }} (Current Balance: Rs {{ v.balance.toFixed(2) }})
              </option>
            </select>
          </div>

          <div class="bg-purple-50 border border-purple-200 p-3 rounded-xl text-purple-950 text-[11px] leading-relaxed">
            <i class="fas fa-info-circle text-purple-700 mr-1"></i>
            Assigning a vendor automatically looks up their agreed purchase pricing for each product and updates the Cost Rate.
          </div>
        </div>

        <div class="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2 text-xs">
          <button 
            @click="showVendorModal = false"
            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button 
            @click="handleApplyVendorToSelected"
            :disabled="!poStore.selectedItemId"
            class="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-950 font-bold rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply to Selected Item
          </button>
          <button 
            @click="handleApplyVendorToAll"
            class="px-4 py-2 bg-[#714B67] hover:bg-[#5a3a52] text-white font-extrabold rounded-xl shadow-md cursor-pointer"
          >
            Apply to All Items ({{ poStore.items.length }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
