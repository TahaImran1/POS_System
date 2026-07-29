<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSessionStore } from '../stores/useSessionStore'
import { useCartStore } from '../stores/useCartStore'

const emit = defineEmits(['open-pos', 'open-orders', 'open-products', 'open-settings'])
const sessionStore = useSessionStore()
const cartStore = useCartStore()

const activeMenu = ref<string | null>(null)
const showOpeningFloatModal = ref(false)
const openingFloatAmount = ref(1000)
const selectedShopName = ref('pyora')

const toggleMenu = (menuName: string) => {
  if (activeMenu.value === menuName) {
    activeMenu.value = null
  } else {
    activeMenu.value = menuName
  }
}

const handleOpenRegisterClick = (shopName: string) => {
  selectedShopName.value = shopName
  showOpeningFloatModal.value = true
}

const handleConfirmOpenSession = async () => {
  await sessionStore.openSession(openingFloatAmount.value)
  showOpeningFloatModal.value = false
  emit('open-pos')
}

// Dynamic real-time calculations matching Odoo backend pos.session engine
const ongoingTicketsCount = computed(() => cartStore.tickets.length)
const ongoingTicketsTotal = computed(() => {
  return cartStore.tickets.reduce((sum, ticket) => {
    const ticketSub = ticket.items.reduce((itemSum, item) => itemSum + (item.product.price * item.quantity), 0)
    const ticketTax = ticket.items.reduce((taxSum, item) => taxSum + (item.product.taxAmount * item.quantity), 0)
    return sum + ticketSub + ticketTax
  }, 0)
})
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-[#f8f9fa] font-sans text-gray-800 overflow-hidden select-none">
    
    <!-- Top Navbar matching Odoo /odoo/point-of-sale -->
    <header class="h-10 bg-[#714B67] text-white flex items-center justify-between px-3 text-xs font-semibold shrink-0 z-40 shadow-xs">
      
      <!-- Left Branding & Menus -->
      <div class="flex items-center gap-4 h-full relative">
        <!-- Store Icon & App Title -->
        <div class="flex items-center gap-1.5 font-bold cursor-pointer hover:opacity-90">
          <i class="fas fa-store text-amber-300 text-sm"></i>
          <span class="text-sm tracking-tight">Point of Sale</span>
        </div>

        <!-- Navbar Menu Tabs -->
        <div class="flex items-center gap-1 h-full">
          <!-- Dashboard Tab -->
          <button @click="activeMenu = null" class="px-2.5 py-1 rounded hover:bg-white/10 transition-colors font-bold text-white">
            Dashboard
          </button>

          <!-- Orders Dropdown -->
          <div class="relative">
            <button @click="toggleMenu('orders')" class="px-2.5 py-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1">
              <span>Orders</span>
              <i class="fas fa-chevron-down text-[9px] opacity-70"></i>
            </button>
            <div v-if="activeMenu === 'orders'" class="absolute left-0 top-full mt-1 w-48 bg-white text-gray-800 rounded-md shadow-lg py-1 border border-gray-200 z-50 text-xs">
              <a href="#orders" @click="activeMenu = null; emit('open-orders')" class="block px-3 py-1.5 hover:bg-gray-100 font-medium">Orders</a>
              <a href="#sessions" @click="activeMenu = null" class="block px-3 py-1.5 hover:bg-gray-100">Sessions</a>
              <a href="#payments" @click="activeMenu = null" class="block px-3 py-1.5 hover:bg-gray-100">Payments</a>
              <a href="#prep" @click="activeMenu = null" class="block px-3 py-1.5 hover:bg-gray-100">Preparation Display</a>
              <a href="#customers" @click="activeMenu = null" class="block px-3 py-1.5 hover:bg-gray-100">Customers</a>
            </div>
          </div>

          <!-- Products Dropdown -->
          <div class="relative">
            <button @click="toggleMenu('products')" class="px-2.5 py-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1">
              <span>Products</span>
              <i class="fas fa-chevron-down text-[9px] opacity-70"></i>
            </button>
            <div v-if="activeMenu === 'products'" class="absolute left-0 top-full mt-1 w-48 bg-white text-gray-800 rounded-md shadow-lg py-1 border border-gray-200 z-50 text-xs">
              <a href="#products" @click="activeMenu = null; emit('open-products')" class="block px-3 py-1.5 hover:bg-gray-100 font-medium">Products</a>
              <a href="#variants" @click="activeMenu = null" class="block px-3 py-1.5 hover:bg-gray-100">Product Variants</a>
              <a href="#combo" @click="activeMenu = null" class="block px-3 py-1.5 hover:bg-gray-100">Combo Choices</a>
              <a href="#pricelists" @click="activeMenu = null" class="block px-3 py-1.5 hover:bg-gray-100">Pricelists</a>
            </div>
          </div>

          <!-- Reporting Dropdown -->
          <div class="relative">
            <button @click="toggleMenu('reporting')" class="px-2.5 py-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1">
              <span>Reporting</span>
              <i class="fas fa-chevron-down text-[9px] opacity-70"></i>
            </button>
            <div v-if="activeMenu === 'reporting'" class="absolute left-0 top-full mt-1 w-48 bg-white text-gray-800 rounded-md shadow-lg py-1 border border-gray-200 z-50 text-xs">
              <a href="#rep-orders" @click="activeMenu = null" class="block px-3 py-1.5 hover:bg-gray-100">Orders</a>
              <a href="#details" @click="activeMenu = null" class="block px-3 py-1.5 hover:bg-gray-100">Sales Details</a>
              <a href="#sess-report" @click="activeMenu = null" class="block px-3 py-1.5 hover:bg-gray-100">Session Report</a>
            </div>
          </div>

          <!-- Configuration Dropdown -->
          <div class="relative">
            <button @click="toggleMenu('config')" class="px-2.5 py-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1">
              <span>Configuration</span>
              <i class="fas fa-chevron-down text-[9px] opacity-70"></i>
            </button>
            <div v-if="activeMenu === 'config'" class="absolute left-0 top-full mt-1 w-56 bg-white text-gray-800 rounded-md shadow-lg py-1 border border-gray-200 z-50 text-xs">
              <a href="#settings" @click="activeMenu = null; emit('open-settings')" class="block px-3 py-1.5 hover:bg-gray-100 font-medium">Settings</a>
              <a href="#payments" @click="activeMenu = null" class="block px-3 py-1.5 hover:bg-gray-100">Payment Methods</a>
              <a href="#coins" @click="activeMenu = null" class="block px-3 py-1.5 hover:bg-gray-100">Coins/Bills</a>
              <a href="#pos" @click="activeMenu = null" class="block px-3 py-1.5 hover:bg-gray-100">Point of Sales</a>
              <a href="#floors" @click="activeMenu = null" class="block px-3 py-1.5 hover:bg-gray-100">Floor Plans</a>
            </div>
          </div>
        </div>
      </div>

      <!-- Right User Controls -->
      <div class="flex items-center gap-3">
        <i class="fas fa-bell text-gray-300 hover:text-white cursor-pointer"></i>
        <i class="fas fa-clock text-gray-300 hover:text-white cursor-pointer"></i>
        <div class="flex items-center gap-1">
          <span class="text-xs">pyora</span>
          <div class="w-5 h-5 bg-[#C59B27] text-white rounded-full flex items-center justify-center font-bold text-[10px]">
            A
          </div>
        </div>
      </div>
    </header>

    <!-- Subheader Action Bar matching Odoo -->
    <div class="h-10 bg-white border-b border-gray-200 flex items-center justify-between px-4 text-xs text-gray-600 shrink-0">
      <div class="flex items-center gap-2">
        <span class="font-bold text-gray-800 text-sm">Point of Sale</span>
        <button @click="emit('open-settings')" class="text-gray-500 hover:text-gray-800">
          <i class="fas fa-cog text-sm"></i>
        </button>
      </div>

      <div class="flex items-center gap-4">
        <!-- Search Input -->
        <div class="relative w-64">
          <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
          <input 
            type="text" 
            placeholder="Search..." 
            class="w-full pl-7 pr-3 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-[#714B67]"
          />
        </div>
        <span class="text-gray-400">1-2 / 2</span>
        <!-- Views Switcher -->
        <div class="flex items-center border border-gray-300 rounded overflow-hidden">
          <button class="px-2 py-1 bg-gray-200 text-gray-800"><i class="fas fa-th-large"></i></button>
          <button class="px-2 py-1 bg-white text-gray-500 hover:bg-gray-100"><i class="fas fa-list"></i></button>
        </div>
      </div>
    </div>

    <!-- Main Dashboard Content Grid matching Odoo 1:1 -->
    <main class="flex-1 p-6 overflow-y-auto bg-gray-100">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
        
        <!-- Shop Card 1: pyora (Retail POS Card) -->
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div class="flex justify-between items-start mb-4">
              <h3 class="font-bold text-gray-900 text-lg">pyora</h3>
              <span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-medium rounded">Closing Date: {{ sessionStore.lastClosedDate }}</span>
            </div>

            <div class="space-y-1 text-xs text-gray-600 mb-6">
              <div class="flex justify-between">
                <span>Closing Balance</span>
                <span class="font-bold text-gray-900 font-mono">{{ sessionStore.lastClosedBalance.toFixed(2) }} Rs.</span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-4 border-t border-gray-100">
            <button 
              @click="handleOpenRegisterClick('pyora')" 
              class="px-5 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded text-xs transition-colors shadow-xs"
            >
              Open Register
            </button>
          </div>
        </div>

        <!-- Shop Card 2: Restaurant POS Card (Dynamic Calculations) -->
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div class="flex justify-between items-start mb-4">
              <h3 class="font-bold text-gray-900 text-lg">Restaurant</h3>
              <span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded">
                {{ sessionStore.isOpen ? 'Active Session' : 'Closed' }}
              </span>
            </div>

            <!-- Dynamic Session Metrics computed from Pinia / SQLite database -->
            <div class="space-y-1.5 text-xs text-gray-600 mb-4">
              <div class="flex justify-between">
                <span>Opening</span>
                <span class="font-bold text-gray-900 font-mono">{{ sessionStore.openingBalance.toFixed(2) }} Rs.</span>
              </div>

              <div class="flex justify-between">
                <span>Sold</span>
                <span class="font-bold text-gray-900 font-mono">
                  {{ sessionStore.completedSalesTotal.toFixed(2) }} Rs. ({{ sessionStore.completedSalesCount }} order{{ sessionStore.completedSalesCount === 1 ? '' : 's' }})
                </span>
              </div>

              <div class="flex justify-between">
                <span>Ongoing</span>
                <span class="font-bold text-emerald-600 font-mono font-semibold">
                  {{ ongoingTicketsTotal.toFixed(2) }} Rs. ({{ ongoingTicketsCount }} order{{ ongoingTicketsCount === 1 ? '' : 's' }})
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-4 border-t border-gray-100">
            <button 
              @click="emit('open-pos')" 
              class="px-5 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded text-xs transition-colors shadow-xs"
            >
              Continue Selling
            </button>
            <div class="w-6 h-6 bg-[#C59B27] text-white rounded-full flex items-center justify-center font-bold text-[10px]">
              A
            </div>
          </div>
        </div>

      </div>
    </main>

    <!-- Cash Opening Float Control Modal matching Odoo -->
    <div v-if="showOpeningFloatModal" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div class="px-6 py-4 bg-[#714B67] text-white flex justify-between items-center">
          <h3 class="font-bold text-base flex items-center gap-2">
            <i class="fas fa-cash-register"></i> Opening Cash Control
          </h3>
          <button @click="showOpeningFloatModal = false" class="text-white/80 hover:text-white">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="p-6 space-y-4">
          <p class="text-xs text-gray-600">Please specify the opening cash float amount in drawer for session <b>#{{ selectedShopName }}</b>.</p>
          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Opening Cash (Rs.)</label>
            <input 
              v-model.number="openingFloatAmount" 
              type="number" 
              step="1"
              min="0"
              class="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#714B67]"
            />
          </div>
        </div>

        <div class="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
          <button @click="showOpeningFloatModal = false" class="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded text-xs hover:bg-gray-100">
            Cancel
          </button>
          <button @click="handleConfirmOpenSession" class="px-5 py-2 bg-[#714B67] text-white font-bold rounded text-xs hover:bg-[#5c3d54] shadow-xs">
            Open Session
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
