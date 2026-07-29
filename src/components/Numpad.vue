<script setup lang="ts">
import { ref } from 'vue'
import { useCartStore } from '../stores/useCartStore'
import CustomerModal, { type Customer } from './modals/CustomerModal.vue'
import TransferModal from './modals/TransferModal.vue'
import ActionsModal from './modals/ActionsModal.vue'
import QuotationModal from './modals/QuotationModal.vue'
import PricelistModal from './modals/PricelistModal.vue'

const props = defineProps<{
  isEmpty?: boolean
}>()

const emit = defineEmits(['select-table', 'set-tab'])
const cart = useCartStore()

const isCustomerModalOpen = ref(false)
const isTransferModalOpen = ref(false)
const isActionsModalOpen = ref(false)
const isQuotationModalOpen = ref(false)
const isPricelistModalOpen = ref(false)
const selectedCustomer = ref<Customer | null>(null)
const guestCount = ref(1)

const handleKey = (val: string) => {
  cart.handleNumpadInput(val)
}

const handleSelectCustomer = (customer: Customer | null) => {
  selectedCustomer.value = customer
}

const handleTransfer = (targetTableId: number) => {
  alert(`Order transferred to Table ${targetTableId}!`)
}

const handleActionTrigger = (act: string) => {
  if (act === 'cancel') {
    cart.clearActiveCart()
  } else if (act === 'customer-note') {
    const note = prompt('Enter Customer Note:')
    if (note) alert(`Note added: "${note}"`)
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
    alert('Select past order to refund!')
  }
}
</script>

<template>
  <div class="flex flex-col bg-white border-t border-gray-200">
    <!-- Action Row (Customer, Note, Upload Icon, Course, ...) -->
    <div class="grid grid-cols-5 gap-1 p-2 bg-gray-50 border-b border-gray-200 text-sm">
      <button 
        @click="isCustomerModalOpen = true"
        :class="[
          'py-2 border rounded font-medium transition-colors shadow-xs truncate px-1 text-center text-xs',
          selectedCustomer ? 'bg-[#714B67] text-white border-[#714B67]' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
        ]"
        :title="selectedCustomer ? selectedCustomer.name : 'Customer'"
      >
        {{ selectedCustomer ? selectedCustomer.name : 'Customer' }}
      </button>

      <button 
        @click="handleActionTrigger('customer-note')" 
        class="py-2 bg-white border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-100 shadow-xs text-xs"
      >
        Note
      </button>

      <button 
        @click="handleActionTrigger('transfer-course')" 
        class="py-2 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-100 shadow-xs flex items-center justify-center text-xs"
        title="Transfer course"
      >
        <i class="fas fa-upload text-gray-700"></i>
      </button>

      <button 
        @click="handleActionTrigger('transfer-course')" 
        class="py-2 bg-white border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-100 shadow-xs text-xs"
      >
        Course
      </button>

      <button 
        @click="isActionsModalOpen = true" 
        class="py-2 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-100 shadow-xs flex items-center justify-center text-xs"
        title="Actions"
      >
        <i class="fas fa-ellipsis-v text-gray-700"></i>
      </button>
    </div>

    <!-- Collapsible Numpad Grid (only expanded when items exist or non-empty) -->
    <div v-if="!isEmpty" class="grid grid-cols-4 bg-gray-200 gap-px transition-all">
      <!-- Row 1 -->
      <button @click="handleKey('1')" class="h-12 bg-white text-gray-800 font-bold text-lg hover:bg-gray-100">1</button>
      <button @click="handleKey('2')" class="h-12 bg-white text-gray-800 font-bold text-lg hover:bg-gray-100">2</button>
      <button @click="handleKey('3')" class="h-12 bg-white text-gray-800 font-bold text-lg hover:bg-gray-100">3</button>
      <button 
        @click="cart.setNumpadMode('qty')"
        :class="['h-12 font-bold text-sm transition-colors', cart.numpadMode === 'qty' ? 'bg-[#56C5B6] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200']"
      >
        Qty
      </button>

      <!-- Row 2 -->
      <button @click="handleKey('4')" class="h-12 bg-white text-gray-800 font-bold text-lg hover:bg-gray-100">4</button>
      <button @click="handleKey('5')" class="h-12 bg-white text-gray-800 font-bold text-lg hover:bg-gray-100">5</button>
      <button @click="handleKey('6')" class="h-12 bg-white text-gray-800 font-bold text-lg hover:bg-gray-100">6</button>
      <button 
        @click="cart.setNumpadMode('disc')"
        :class="['h-12 font-bold text-base transition-colors', cart.numpadMode === 'disc' ? 'bg-[#56C5B6] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200']"
      >
        %
      </button>

      <!-- Row 3 -->
      <button @click="handleKey('7')" class="h-12 bg-white text-gray-800 font-bold text-lg hover:bg-gray-100">7</button>
      <button @click="handleKey('8')" class="h-12 bg-white text-gray-800 font-bold text-lg hover:bg-gray-100">8</button>
      <button @click="handleKey('9')" class="h-12 bg-white text-gray-800 font-bold text-lg hover:bg-gray-100">9</button>
      <button 
        @click="cart.setNumpadMode('price')"
        :class="['h-12 font-bold text-sm transition-colors', cart.numpadMode === 'price' ? 'bg-[#56C5B6] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200']"
      >
        Price
      </button>

      <!-- Row 4 -->
      <button @click="handleKey('+/-')" class="h-12 bg-[#FFF3C4] text-gray-800 font-bold text-sm hover:bg-[#FFE899]">+/-</button>
      <button @click="handleKey('0')" class="h-12 bg-white text-gray-800 font-bold text-lg hover:bg-gray-100">0</button>
      <button @click="handleKey('.')" class="h-12 bg-white text-gray-800 font-bold text-lg hover:bg-gray-100">.</button>
      <button @click="handleKey('backspace')" class="h-12 bg-[#F88379] hover:bg-[#E0665C] text-white flex items-center justify-center font-bold text-xl">
        ⌫
      </button>
    </div>

    <!-- Bottom Actions: Set Table / Set Tab / Payment OR Fire Course / Payment matching Odoo -->
    <div v-if="!cart.activeTicket || cart.activeTicket.name === 'Direct Sale'" class="grid grid-cols-4 gap-2 p-2 bg-gray-100 border-t border-gray-200">
      <button 
        @click="$emit('select-table')" 
        class="py-3 bg-[#563550] hover:bg-[#43293e] text-white font-bold rounded-lg shadow-sm text-center text-xs"
      >
        Set Table
      </button>
      <button 
        @click="$emit('set-tab')" 
        class="py-3 bg-[#563550] hover:bg-[#43293e] text-white font-bold rounded-lg shadow-sm text-center text-xs"
      >
        Set Tab
      </button>
      <button 
        @click="cart.isCheckoutOpen = true" 
        class="col-span-2 py-3 bg-[#563550] hover:bg-[#43293e] text-white font-bold rounded-lg shadow-md text-center text-base"
      >
        Payment
      </button>
    </div>

    <div v-else class="grid grid-cols-2 gap-2 p-2 bg-gray-100 border-t border-gray-200">
      <button 
        @click="cart.fireCourse('Course 1')" 
        class="py-3 bg-[#563550] hover:bg-[#43293e] text-white font-bold rounded-lg shadow-sm text-center text-sm"
      >
        Fire Course 1
      </button>

      <button 
        @click="cart.isCheckoutOpen = true" 
        class="py-3 bg-[#e9ecef] hover:bg-gray-300 text-gray-800 font-bold rounded-lg shadow-sm text-center text-base"
      >
        Payment
      </button>
    </div>

    <!-- Modals -->
    <CustomerModal 
      :show="isCustomerModalOpen" 
      :selectedCustomer="selectedCustomer"
      @close="isCustomerModalOpen = false" 
      @select-customer="handleSelectCustomer"
    />
    <TransferModal 
      :show="isTransferModalOpen" 
      @close="isTransferModalOpen = false"
      @transfer="handleTransfer"
    />
    <ActionsModal 
      :show="isActionsModalOpen" 
      :guestCount="guestCount"
      @close="isActionsModalOpen = false"
      @action="handleActionTrigger"
    />
    <QuotationModal 
      :show="isQuotationModalOpen" 
      @close="isQuotationModalOpen = false"
    />
    <PricelistModal 
      :show="isPricelistModalOpen" 
      @close="isPricelistModalOpen = false"
    />
  </div>
</template>
