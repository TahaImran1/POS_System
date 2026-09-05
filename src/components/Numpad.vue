<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCartStore } from '../stores/useCartStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import CustomerModal, { type Customer } from './modals/CustomerModal.vue'
import TransferModal from './modals/TransferModal.vue'
import ActionsModal from './modals/ActionsModal.vue'
import QuotationModal from './modals/QuotationModal.vue'
import PricelistModal from './modals/PricelistModal.vue'
import SaleReturnModal from './modals/SaleReturnModal.vue'
import { useToast } from '../composables/useToast'

const props = defineProps<{
  isEmpty?: boolean
}>()

const emit = defineEmits(['select-table', 'set-tab'])
const cart = useCartStore()
const settingsStore = useSettingsStore()
import VendorPaymentModal from './modals/VendorPaymentModal.vue'

const toast = useToast()

const isRestaurant = computed(() => settingsStore.posMode === 'restaurant')
const isRetail = computed(() => settingsStore.posMode === 'retail')

const isCustomerModalOpen = ref(false)
const isTransferModalOpen = ref(false)
const isActionsModalOpen = ref(false)
const isQuotationModalOpen = ref(false)
const isPricelistModalOpen = ref(false)
const isSaleReturnModalOpen = ref(false)
const isVendorPaymentModalOpen = ref(false)
const selectedCustomer = ref<Customer | null>(null)
const guestCount = ref(1)

const handleKey = (val: string) => {
  cart.handleNumpadInput(val)
}

const handleSelectCustomer = (customer: Customer | null) => {
  selectedCustomer.value = customer
}

const handleTransfer = (targetTableId: number) => {
  toast.success(`Order transferred to Table ${targetTableId}!`)
}

function handleActionTrigger(act: string) {
  if (act === 'cancel') {
    cart.clearActiveCart()
  } else if (act === 'customer-note') {
    const note = prompt('Enter Customer Note / Item Serial:')
    if (note) toast.info(`Note added: "${note}"`)
  } else if (act === 'guests') {
    const g = prompt('Enter number of guests:', guestCount.value.toString())
    if (g) guestCount.value = parseInt(g) || 1
  } else if (act === 'transfer') {
    isTransferModalOpen.value = true
  } else if (act === 'edit-name') {
    const name = prompt('Edit Order Name:', cart.activeTicket?.name || 'Order')
    if (name && cart.activeTicket) cart.activeTicket.name = name
  } else if (act === 'quotation') {
    isQuotationModalOpen.value = true
  } else if (act === 'pricelist') {
    isPricelistModalOpen.value = true
  } else if (act === 'refund') {
    isSaleReturnModalOpen.value = true
  } else if (act === 'pay-vendor') {
    isVendorPaymentModalOpen.value = true
  }
}
</script>

<template>
  <div class="flex flex-col bg-white border-t border-gray-200 shrink-0 select-none">
    <!-- Action Row Tailored for Restaurant vs Retail -->
    <div class="grid grid-cols-5 gap-1 p-1 bg-gray-50 border-b border-gray-200 text-xs">
      <button 
        @click="isCustomerModalOpen = true"
        :class="[
          'py-0.5 border rounded font-medium transition-colors shadow-xs truncate px-1 text-center text-[10px] cursor-pointer',
          selectedCustomer ? 'bg-[#714B67] text-white border-[#714B67]' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
        ]"
        :title="selectedCustomer ? selectedCustomer.name : 'Customer'"
      >
        👤 {{ selectedCustomer ? selectedCustomer.name : 'Customer' }}
      </button>

      <button 
        @click="handleActionTrigger('customer-note')" 
        class="py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-100 shadow-xs text-[10px] cursor-pointer"
      >
        📝 Note
      </button>

      <!-- Restaurant Actions -->
      <template v-if="isRestaurant">
        <button 
          @click="handleActionTrigger('transfer-course')" 
          class="py-0.5 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-100 shadow-xs flex items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer"
          title="Transfer course"
        >
          <svg width="11" height="11" class="w-2.5 h-2.5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          <span>Shift</span>
        </button>

        <button 
          @click="handleActionTrigger('transfer-course')" 
          class="py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-100 shadow-xs text-[10px] cursor-pointer"
        >
          Course
        </button>
      </template>

      <!-- Retail Actions -->
      <template v-else>
        <button 
          @click="handleActionTrigger('pricelist')" 
          class="py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-100 shadow-xs text-[10px] cursor-pointer"
        >
          Pricelist
        </button>

        <button 
          @click="handleActionTrigger('refund')" 
          class="py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-100 shadow-xs text-[10px] cursor-pointer"
        >
          Refund
        </button>
      </template>

      <button 
        @click="isActionsModalOpen = true" 
        class="py-0.5 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-100 shadow-xs flex items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer"
        title="More Actions"
      >
        <svg width="11" height="11" class="w-2.5 h-2.5 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 12a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <span>More</span>
      </button>
    </div>

    <!-- Main Numpad & Big Payment Button Layout -->
    <div class="p-1 bg-white space-y-1">
      <div class="grid grid-cols-4 gap-1 h-[88px]">
        
        <!-- Numpad 1 to 9 Keys -->
        <div class="col-span-3 grid grid-cols-3 gap-1 h-full">
          <button @click="handleKey('1')" class="bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 rounded text-xs cursor-pointer">1</button>
          <button @click="handleKey('2')" class="bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 rounded text-xs cursor-pointer">2</button>
          <button @click="handleKey('3')" class="bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 rounded text-xs cursor-pointer">3</button>
          
          <button @click="handleKey('4')" class="bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 rounded text-xs cursor-pointer">4</button>
          <button @click="handleKey('5')" class="bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 rounded text-xs cursor-pointer">5</button>
          <button @click="handleKey('6')" class="bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 rounded text-xs cursor-pointer">6</button>
          
          <button @click="handleKey('7')" class="bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 rounded text-xs cursor-pointer">7</button>
          <button @click="handleKey('8')" class="bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 rounded text-xs cursor-pointer">8</button>
          <button @click="handleKey('9')" class="bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 rounded text-xs cursor-pointer">9</button>

          <button @click="handleKey('.')" class="bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 rounded text-xs cursor-pointer">.</button>
          <button @click="handleKey('0')" class="bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 rounded text-xs cursor-pointer">0</button>
          <button @click="handleKey('backspace')" class="bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 rounded flex items-center justify-center gap-0.5 cursor-pointer" title="Backspace">
            <svg width="14" height="14" class="w-3.5 h-3.5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414a2 2 0 011.414-.586H19a2 2 0 012 2v10a2 2 0 01-2 2H10.828a2 2 0 01-1.414-.586L3 12z"/>
            </svg>
            <span class="font-black text-[11px]">⌫</span>
          </button>
        </div>

        <!-- Right Mode Selectors (Qty | Disc | Price) -->
        <div class="flex flex-col gap-1 h-full">
          <button 
            @click="cart.setNumpadMode('qty')"
            :class="[
              'flex-1 font-bold text-[11px] rounded transition-colors flex items-center justify-center cursor-pointer',
              cart.numpadMode === 'qty' ? 'bg-[#714B67] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            ]"
          >
            Qty
          </button>
          <button 
            @click="cart.setNumpadMode('disc')"
            :class="[
              'flex-1 font-bold text-[11px] rounded transition-colors flex items-center justify-center cursor-pointer',
              cart.numpadMode === 'disc' ? 'bg-[#714B67] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            ]"
          >
            % Disc
          </button>
          <button 
            @click="cart.setNumpadMode('price')"
            :class="[
              'flex-1 font-bold text-[11px] rounded transition-colors flex items-center justify-center cursor-pointer',
              cart.numpadMode === 'price' ? 'bg-[#714B67] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            ]"
          >
            Price
          </button>
        </div>
      </div>

      <!-- Action Buttons Row (Payment & Fire Course) -->
      <div class="flex gap-1 pt-0.5 pb-0.5">
        <!-- Restaurant Fire Course Button -->
        <button 
          v-if="isRestaurant"
          @click="cart.fireCourse('Course 1')" 
          class="px-2 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1 shrink-0 cursor-pointer"
        >
          <span>🔥</span>
          <span>Fire Course</span>
        </button>

        <!-- Big Payment Button -->
        <button 
          @click="cart.isCheckoutOpen = true" 
          class="flex-1 py-2 bg-[#00A09D] hover:bg-[#008986] text-white font-extrabold text-xs rounded-lg shadow-md transition-colors tracking-wide flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <svg width="14" height="14" class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          <span>Pay {{ cart.total.toFixed(2) }} Rs.</span>
        </button>
      </div>
    </div>

    <!-- Modals -->
    <CustomerModal :show="isCustomerModalOpen" @close="isCustomerModalOpen = false" @select="handleSelectCustomer" />
    <TransferModal :show="isTransferModalOpen" @close="isTransferModalOpen = false" @transfer="handleTransfer" />
    <ActionsModal :show="isActionsModalOpen" @close="isActionsModalOpen = false" @action="handleActionTrigger" />
    <QuotationModal :show="isQuotationModalOpen" @close="isQuotationModalOpen = false" />
    <PricelistModal :show="isPricelistModalOpen" @close="isPricelistModalOpen = false" />
    <SaleReturnModal :show="isSaleReturnModalOpen" @close="isSaleReturnModalOpen = false" />
    <VendorPaymentModal :show="isVendorPaymentModalOpen" @close="isVendorPaymentModalOpen = false" />
  </div>
</template>
