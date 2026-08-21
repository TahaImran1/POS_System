<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
import { useSettingsStore } from '../stores/useSettingsStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useToast } from '../composables/useToast'

const emit = defineEmits(['back-to-dashboard'])

const cart = useCartStore()
const tableStore = useTableStore()
const productStore = useProductStore()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const toast = useToast()

const isRestaurant = computed(() => settingsStore.posMode === 'restaurant')
const isRetail = computed(() => settingsStore.posMode === 'retail')

const currentView = ref<'tables' | 'register' | 'orders'>('register')
const barcodeQuery = ref('')

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

// Hardware Barcode Scanner Buffer State
let scannerBuffer = ''
let lastKeyTime = 0
let scannerTimer: any = null

const processScannedBarcode = (code: string) => {
  const cleanCode = code.trim().toLowerCase()
  if (!cleanCode) return

  const match = productStore.products.find(p => 
    (p.barcode && p.barcode.trim().toLowerCase() === cleanCode) || 
    (p.sku && p.sku.trim().toLowerCase() === cleanCode) ||
    p.id.toLowerCase() === cleanCode
  )

  if (match) {
    cart.addProduct(match)
    toast.success(`Scanned: ${match.name} (Rs ${match.price})`)
  } else {
    toast.warning(`Scanned code "${code}" not found in product database.`)
  }
}

// Global physical keyboard & barcode scanner event listener
const handleGlobalKeydown = (e: KeyboardEvent) => {
  // Ignore if user is currently typing in an input/textarea/select field
  const target = e.target as HTMLElement
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
    return
  }

  // Handle open modal Esc key
  if (isSettingsOpen.value || isHeaderMenuOpen.value || isCreateProductOpen.value || isClosingCashOpen.value || isProductInfoOpen.value || isReceiptOpen.value) {
    if (e.key === 'Escape') {
      isSettingsOpen.value = false
      isHeaderMenuOpen.value = false
      isCreateProductOpen.value = false
      isClosingCashOpen.value = false
      isProductInfoOpen.value = false
      isReceiptOpen.value = false
      e.preventDefault()
    }
    return
  }

  // If checkout modal is open, let CheckoutModal handle keydown
  if (cart.isCheckoutOpen) return

  const now = performance.now()
  const elapsed = lastKeyTime ? (now - lastKeyTime) : 9999
  lastKeyTime = now

  // Hardware USB/Bluetooth scanners fire key events at < 50ms intervals
  const isScannerSpeed = elapsed < 50

  // Enter key finishes a barcode scan
  if (e.key === 'Enter') {
    if (scannerBuffer.length >= 3) {
      const scannedCode = scannerBuffer
      scannerBuffer = ''
      processScannedBarcode(scannedCode)
      e.preventDefault()
      return
    }
    scannerBuffer = ''
    
    // Normal Enter key behavior (Open checkout if cart not empty)
    if (cart.items.length > 0 && !cart.isCheckoutOpen) {
      cart.isCheckoutOpen = true
      e.preventDefault()
    }
    return
  }

  // Single printable character (digits, letters, symbols)
  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    if (isScannerSpeed || scannerBuffer.length > 0) {
      scannerBuffer += e.key

      // Clear buffer if idle for > 200ms
      clearTimeout(scannerTimer)
      scannerTimer = setTimeout(() => {
        if (scannerBuffer.length >= 6) {
          processScannedBarcode(scannerBuffer)
        }
        scannerBuffer = ''
      }, 200)

      e.preventDefault()
      return
    }
  }

  // If buffer is empty, proceed to regular POS numpad & keyboard shortcuts
  if (scannerBuffer.length === 0) {
    // Numpad Digits '0'-'9'
    if (e.key >= '0' && e.key <= '9') {
      cart.handleNumpadInput(e.key)
      e.preventDefault()
      return
    }

    // Decimal Point '.' or ','
    if (e.key === '.' || e.key === ',') {
      cart.handleNumpadInput('.')
      e.preventDefault()
      return
    }

    // Backspace or Delete
    if (e.key === 'Backspace' || e.key === 'Delete') {
      cart.handleNumpadInput('backspace')
      e.preventDefault()
      return
    }

    // Mode shortcuts
    const k = e.key.toLowerCase()
    if (k === 'q') {
      cart.setNumpadMode('qty')
      e.preventDefault()
      return
    }
    if (k === 'd' || e.key === '%') {
      cart.setNumpadMode('disc')
      e.preventDefault()
      return
    }
    if (k === 'p') {
      cart.setNumpadMode('price')
      e.preventDefault()
      return
    }
  }
}

onMounted(async () => {
  try {
    await productStore.loadFromDb()
    await cart.fetchActiveBillTaxes()
  } catch (e) {
    console.warn('POSLayout failed to load products/taxes:', e)
  }
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
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

const handleBarcodeSearch = () => {
  if (!barcodeQuery.value) return
  const q = barcodeQuery.value.trim().toLowerCase()
  const match = productStore.products.find(p => 
    (p.barcode && p.barcode.trim().toLowerCase() === q) || 
    (p.sku && p.sku.trim().toLowerCase() === q) ||
    p.id.toLowerCase() === q ||
    p.name.toLowerCase().includes(q)
  )
  if (match) {
    cart.addProduct(match)
    toast.success(`Scanned: ${match.name} (Rs ${match.price})`)
    barcodeQuery.value = ''
  } else {
    toast.warning(`No product found matching barcode or SKU: "${barcodeQuery.value}"`)
  }
}

const handleMenuAction = (act: string) => {
  if (act === 'switch-user') {
    authStore.showLoginModal = true
  } else if (act === 'create-product') {
    isCreateProductOpen.value = true
  } else if (act === 'orders') {
    currentView.value = 'orders'
  } else if (act === 'settings') {
    isSettingsOpen.value = true
  } else if (act === 'close-session') {
    isClosingCashOpen.value = true
  } else if (act === 'cash-in-out') {
    const amt = prompt('Enter Cash In / Out Amount (e.g. 500 or -200):')
    if (amt) toast.info(`Cash movement recorded: Rs${amt}`)
  }
}

const handleSessionClosed = () => {
  emit('back-to-dashboard')
}
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-hidden bg-gray-100 font-sans">
    <!-- Top Navigation Bar -->
    <header class="h-12 bg-[#e9ecef] border-b border-gray-300 flex items-center justify-between px-4 shrink-0 z-30 shadow-xs">
      
      <!-- Left: Back + Navigation Tabs -->
      <div class="flex items-center gap-1.5 h-full py-1">
        <!-- ← Back to Dashboard Button -->
        <button
          @click="emit('back-to-dashboard')"
          class="h-full px-3 flex items-center gap-1 font-bold text-xs text-gray-700 hover:bg-gray-200/80 rounded-md transition-all cursor-pointer"
          title="Back to POS Dashboard"
        >
          <svg class="w-3.5 h-3.5 text-[#714B67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          <span>Back</span>
        </button>

        <!-- Divider -->
        <div class="w-px h-5 bg-gray-300"></div>

        <!-- Mode Badge -->
        <span 
          class="px-2.5 py-1 rounded text-[11px] font-black uppercase text-white shadow-2xs tracking-wider flex items-center gap-1 shrink-0"
          :class="isRestaurant ? 'bg-[#714B67]' : 'bg-[#00A09D]'"
        >
          <span>{{ isRestaurant ? '🍽️ Restaurant POS' : '🛒 Store / Retail POS' }}</span>
        </span>

        <!-- Restaurant Mode: Tables Canvas Button -->
        <button 
          v-if="isRestaurant"
          @click="currentView = 'tables'"
          :class="[
            'h-full px-3 flex items-center justify-center font-bold text-xs rounded-md transition-all cursor-pointer',
            currentView === 'tables' 
              ? 'bg-white text-gray-900 shadow-sm border border-gray-300' 
              : 'text-gray-700 hover:bg-gray-200/70'
          ]"
        >
          Tables Canvas
        </button>

        <!-- Register View Button -->
        <button 
          @click="currentView = 'register'"
          :class="[
            'h-full px-3 flex items-center justify-center font-bold text-xs rounded-md transition-all cursor-pointer',
            currentView === 'register' 
              ? 'bg-white text-gray-900 shadow-sm border border-gray-300' 
              : 'text-gray-700 hover:bg-gray-200/70'
          ]"
        >
          Register
        </button>

        <!-- Orders View Button -->
        <button 
          @click="currentView = 'orders'"
          :class="[
            'h-full px-3 flex items-center justify-center font-bold text-xs rounded-md transition-all gap-1.5 cursor-pointer',
            currentView === 'orders' 
              ? 'bg-white text-gray-900 shadow-sm border border-gray-300' 
              : 'text-gray-700 hover:bg-gray-200/70'
          ]"
        >
          <span>Orders</span>
          <span 
            v-if="activeOrderCount > 0"
            class="w-4 h-4 bg-[#00A09D] text-white rounded-full text-[10px] flex items-center justify-center font-bold"
          >
            {{ activeOrderCount }}
          </span>
        </button>

        <!-- Active Ticket Badge -->
        <span v-if="cart.activeTicket" class="px-3 py-1 bg-[#714B67] text-white rounded-full text-xs font-bold shadow-xs ml-1">
          {{ isRestaurant ? (cart.activeTicket.name === 'Direct Sale' ? 'Direct Sale' : `Table ${cart.activeTicket.name}`) : `Retail Sale #${cart.activeTicket.name}` }}
        </span>
      </div>

      <!-- Right: Store Branding & Search Bar & Utility Icons -->
      <div class="flex items-center gap-3">
        <!-- Store Branding -->
        <div 
          @click="emit('back-to-dashboard')"
          class="flex items-center gap-1.5 font-black text-lg tracking-tight text-[#714B67] select-none cursor-pointer hover:opacity-80 truncate"
          title="Return to POS Dashboard"
        >
          <span>{{ settingsStore.storeName || 'Main Flagship Store' }}</span>
        </div>

        <!-- Retail Mode: Barcode Scanner Instant Input -->
        <div v-if="isRetail" class="relative w-64">
          <i class="fas fa-barcode absolute left-2.5 top-1/2 -translate-y-1/2 text-teal-700 text-xs"></i>
          <input 
            v-model="barcodeQuery"
            @keyup.enter="handleBarcodeSearch"
            type="text"
            placeholder="🔍 Scan Barcode or SKU..."
            class="w-full pl-8 pr-3 py-1.5 bg-white border border-teal-400 rounded-md text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
            autofocus
          />
        </div>

        <!-- Create Product Quick Button (Manager Only) -->
        <button 
          v-if="authStore.hasManagerPrivileges"
          @click="isCreateProductOpen = true"
          class="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 font-bold rounded text-xs flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
          title="Create New Product"
        >
          <span class="text-sm font-bold">+</span>
          <span>Add Product</span>
        </button>

        <!-- Settings Quick Button -->
        <button 
          @click="isSettingsOpen = true"
          class="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-200 rounded transition-colors cursor-pointer"
          title="POS Settings"
        >
          <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </button>

        <!-- Hamburger Menu Button -->
        <button 
          @click="isHeaderMenuOpen = true"
          class="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-200 rounded transition-colors cursor-pointer"
          title="POS Menu"
        >
          <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Main Dynamic Content Body -->
    <main class="flex-1 flex overflow-hidden relative">
      <!-- 1. Tables Floor Plan View (Restaurant Only) -->
      <FloorPlanView 
        v-if="isRestaurant && currentView === 'tables'" 
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
    <SessionModal @back-to-dashboard="emit('back-to-dashboard')" />
    <CheckoutModal :show="cart.isCheckoutOpen" @close="cart.isCheckoutOpen = false" @success="handleCheckoutSuccess" />
    <SettingsModal :show="isSettingsOpen" @close="isSettingsOpen = false" />
    <HeaderMenuModal :show="isHeaderMenuOpen" @close="isHeaderMenuOpen = false" @action="handleMenuAction" @back-to-dashboard="emit('back-to-dashboard')" />
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
      :subtotal="receiptData?.subtotal || 0"
      :itemTaxes="receiptData?.itemTaxes || 0"
      :globalGst="receiptData?.globalGst || 0"
      :totalTaxes="receiptData?.totalTaxes || 0"
      :items="receiptData?.items || []"
      :tendered="receiptData?.tendered || receiptData?.total || 0"
      :change="receiptData?.change || 0"
      :method="receiptData?.method || 'Cash'"
      :ticketName="receiptData?.ticketName || '1'"
    />
  </div>
</template>
