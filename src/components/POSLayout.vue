<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import FloorPlanView from '../views/FloorPlanView.vue'
import OrdersView from '../views/OrdersView.vue'
import LeftPane from './LeftPane.vue'
import RightPane from './RightPane.vue'
import SessionModal from './modals/SessionModal.vue'
import CheckoutModal from './modals/CheckoutModal.vue'
import ReceiptModal from './modals/ReceiptModal.vue'
import SettingsModal from './modals/SettingsModal.vue'
import HeaderMenuModal from './modals/HeaderMenuModal.vue'
import ProductInfoModal from './modals/ProductInfoModal.vue'
import CreateProductModal from './modals/CreateProductModal.vue'
import ClosingCashModal from './modals/ClosingCashModal.vue'
import { useCartStore } from '../stores/useCartStore'
import { useTableStore } from '../stores/useTableStore'
import { useProductStore, type Product } from '../stores/useProductStore'

const emit = defineEmits(['back-to-dashboard'])

const cart = useCartStore()
const tableStore = useTableStore()
const productStore = useProductStore()

const currentView = ref<'tables' | 'register' | 'orders'>('register')
const receiptData = ref<any>(null)
const isReceiptOpen = ref(false)
const isSettingsOpen = ref(false)
const isHeaderMenuOpen = ref(false)
const isCreateProductOpen = ref(false)
const isClosingCashOpen = ref(false)
const selectedInfoProduct = ref<Product | null>(null)
const isProductInfoOpen = ref(false)

const activeOrderCount = computed(() => {
  return cart.tickets.length
})

onMounted(() => {
  const path = window.location.pathname.toLowerCase()
  const hash = window.location.hash.toLowerCase()
  if (path.includes('floor') || hash.includes('floor') || path.includes('tables')) {
    currentView.value = 'tables'
  } else if (path.includes('orders') || hash.includes('orders') || path.includes('ticket')) {
    currentView.value = 'orders'
  } else {
    currentView.value = 'register'
  }
})

watch(currentView, (newVal) => {
  const targetPath = newVal === 'tables' ? '/floor' : newVal === 'orders' ? '/ticket' : '/register'
  if (window.location.pathname !== targetPath) {
    window.history.pushState(null, '', targetPath)
  }
})

const handleSelectTable = (tableId: number) => {
  const tableName = tableId.toString()
  const existing = cart.tickets.find(t => t.name === tableName)
  if (existing) {
    cart.switchTicket(existing.id)
  } else {
    cart.createNewTicket(tableName)
  }
  currentView.value = 'register'
}

const handleNewOrder = () => {
  cart.createNewTicket()
  currentView.value = 'register'
}

const handleLoadOrder = (orderId: string) => {
  currentView.value = 'register'
}

const handleCheckoutSuccess = (data: any) => {
  cart.isCheckoutOpen = false
  receiptData.value = data
  isReceiptOpen.value = true
}

const handleMenuAction = (act: string) => {
  if (act === 'create-product') {
    isCreateProductOpen.value = true
  } else if (act === 'orders') {
    currentView.value = 'orders'
  } else if (act === 'settings') {
    isSettingsOpen.value = true
  } else if (act === 'close-session') {
    isClosingCashOpen.value = true
  } else if (act === 'cash-in-out') {
    const amt = prompt('Enter Cash In / Out Amount (e.g. 500 or -200):')
    if (amt) alert(`Cash movement recorded: Rs${amt}`)
  }
}

const handleSessionClosed = () => {
  emit('back-to-dashboard')
}
</script>

<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden bg-gray-100 font-sans">
    <!-- Odoo Top Navigation Bar -->
    <header class="h-12 bg-[#e9ecef] border-b border-gray-300 flex items-center justify-between px-4 shrink-0 z-30 shadow-xs">
      
      <!-- Left: Navigation Tabs (Tables | Register | Orders) -->
      <div class="flex items-center gap-1 h-full py-1">
        <button 
          @click="currentView = 'tables'"
          :class="[
            'h-full px-5 flex items-center justify-center font-bold text-sm rounded-md transition-all',
            currentView === 'tables' 
              ? 'bg-white text-gray-900 shadow-sm border border-gray-300' 
              : 'text-gray-700 hover:bg-gray-200/70'
          ]"
        >
          Tables
        </button>

        <button 
          @click="currentView = 'register'"
          :class="[
            'h-full px-5 flex items-center justify-center font-bold text-sm rounded-md transition-all',
            currentView === 'register' 
              ? 'bg-white text-gray-900 shadow-sm border border-gray-300' 
              : 'text-gray-700 hover:bg-gray-200/70'
          ]"
        >
          Register
        </button>

        <button 
          @click="currentView = 'orders'"
          :class="[
            'h-full px-5 flex items-center justify-center font-bold text-sm rounded-md transition-all gap-2',
            currentView === 'orders' 
              ? 'bg-white text-gray-900 shadow-sm border border-gray-300' 
              : 'text-gray-700 hover:bg-gray-200/70'
          ]"
        >
          <span>Orders</span>
          <span 
            v-if="activeOrderCount > 0"
            class="w-5 h-5 bg-[#56C5B6] text-white rounded-full text-xs flex items-center justify-center font-bold"
          >
            {{ activeOrderCount }}
          </span>
        </button>

        <!-- Active Order Badge (Direct Sale / Table Name) matching Odoo -->
        <span v-if="cart.activeTicket" class="px-3 py-1 bg-[#017E84] text-white rounded-full text-xs font-bold shadow-xs ml-1">
          {{ cart.activeTicket.name === 'Direct Sale' ? 'Direct Sale' : (isNaN(Number(cart.activeTicket.name)) ? cart.activeTicket.name : `Table ${cart.activeTicket.name}`) }}
        </span>
        <span v-else class="px-3 py-1 bg-[#017E84] text-white rounded-full text-xs font-bold shadow-xs ml-1">
          Direct Sale
        </span>
      </div>

      <!-- Center: Odoo Branding -->
      <div 
        @click="emit('back-to-dashboard')"
        class="flex items-center gap-1 font-bold text-2xl tracking-tighter text-[#714B67] select-none cursor-pointer hover:opacity-80"
        title="Return to Odoo POS Dashboard Hub"
      >
        <span>odoo</span>
      </div>

      <!-- Right: Search Bar & Utility Icons -->
      <div class="flex items-center gap-3">
        <!-- Search bar (visible in Register mode) -->
        <div v-if="currentView === 'register'" class="relative w-80">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
          <input 
            type="text" 
            placeholder="Search products..." 
            class="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#714B67]"
          />
        </div>

        <!-- User Avatar -->
        <div class="w-7 h-7 bg-[#C59B27] text-white rounded-md flex items-center justify-center font-bold text-xs shadow-sm">
          A
        </div>

        <!-- Hamburger Menu Button -->
        <button 
          @click="isHeaderMenuOpen = true"
          class="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-200 rounded transition-colors"
          title="Odoo Menu"
        >
          <i class="fas fa-bars text-lg"></i>
        </button>
      </div>
    </header>

    <!-- Main Dynamic Content Body -->
    <main class="flex-1 flex overflow-hidden relative">
      <!-- 1. Tables Floor Plan View -->
      <FloorPlanView 
        v-if="currentView === 'tables'" 
        @select-table="handleSelectTable"
        @new-order="handleNewOrder"
      />

      <!-- 2. Register Order View (Dual Pane) -->
      <div v-else-if="currentView === 'register'" class="flex-1 flex w-full h-full overflow-hidden">
        <LeftPane @new-order="handleNewOrder" />
        <RightPane />
      </div>

      <!-- 3. Orders History & Loader View -->
      <OrdersView 
        v-else-if="currentView === 'orders'" 
        @load-order="handleLoadOrder"
      />
    </main>

    <!-- Modals -->
    <SessionModal />
    <CheckoutModal :show="cart.isCheckoutOpen" @close="cart.isCheckoutOpen = false" @success="handleCheckoutSuccess" />
    <SettingsModal :show="isSettingsOpen" @close="isSettingsOpen = false" />
    <HeaderMenuModal :show="isHeaderMenuOpen" @close="isHeaderMenuOpen = false" @action="handleMenuAction" />
    <CreateProductModal :show="isCreateProductOpen" @close="isCreateProductOpen = false" />
    <ClosingCashModal :show="isClosingCashOpen" @close="isClosingCashOpen = false" @session-closed="handleSessionClosed" />
    <ProductInfoModal 
      :show="isProductInfoOpen" 
      :product="selectedInfoProduct"
      @close="isProductInfoOpen = false" 
      @add-to-cart="p => cart.addProduct(p)"
    />
    <ReceiptModal 
      :show="isReceiptOpen" 
      @close="isReceiptOpen = false"
      :total="receiptData?.total || 0"
      :tendered="receiptData?.tendered || 0"
      :change="receiptData?.change || 0"
      :method="receiptData?.method || 'Cash'"
      :ticketName="receiptData?.ticketName || ''"
    />
  </div>
</template>
