<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSessionStore } from '../stores/useSessionStore'
import { useCartStore } from '../stores/useCartStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useNodeConfigStore } from '../stores/useNodeConfigStore'

const emit = defineEmits(['open-pos', 'open-orders', 'open-products', 'open-settings'])
const sessionStore = useSessionStore()
const cartStore = useCartStore()
const settingsStore = useSettingsStore()
const nodeConfigStore = useNodeConfigStore()

const activeMenu = ref<string | null>(null)
const showOpeningFloatModal = ref(false)
const openingFloatAmount = ref(1000)
const selectedShopName = ref('Main Store')

const toggleMenu = (menuName: string) => {
  if (activeMenu.value === menuName) {
    activeMenu.value = null
  } else {
    activeMenu.value = menuName
  }
}

const handleOpenRegisterClick = () => {
  selectedShopName.value = settingsStore.storeName || 'Main Store'
  showOpeningFloatModal.value = true
}

const handleConfirmOpenSession = async () => {
  await sessionStore.openSession(openingFloatAmount.value)
  showOpeningFloatModal.value = false
  emit('open-pos')
}

// Dynamic real-time calculations matching Odoo backend pos.session engine
const activeTickets = computed(() => cartStore.tickets.filter(t => t.items.length > 0))
const ongoingTicketsCount = computed(() => activeTickets.value.length)
const ongoingTicketsTotal = computed(() => {
  return activeTickets.value.reduce((sum, ticket) => {
    const ticketSub = ticket.items.reduce((itemSum, item) => itemSum + (item.product.price * item.quantity), 0)
    const ticketTax = ticket.items.reduce((taxSum, item) => taxSum + (item.product.taxAmount * item.quantity), 0)
    return sum + ticketSub + ticketTax
  }, 0)
})

import { onMounted } from 'vue'

onMounted(async () => {
  await sessionStore.loadLatestSession()
})

// Installed immutable terminal
const activeTerminals = computed(() => {
  return [
    {
      id: 'pos-setup-01',
      name: settingsStore.storeName || nodeConfigStore.config.branch_id || 'Main Store',
      mode: settingsStore.posMode || 'retail',
      status: (sessionStore.isOpen ? 'active' : 'closed') as 'active' | 'closed',
      lastClosedDate: sessionStore.lastClosedDate || new Date().toLocaleDateString(),
      lastClosedBalance: sessionStore.lastClosedBalance || 0
    }
  ]
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
          <span class="text-sm tracking-tight">Point of Sale Workspace</span>
        </div>

        <!-- Navbar Menu Tabs -->
        <div class="flex items-center gap-1 h-full">
          <button @click="emit('open-pos')" class="px-3 py-1 hover:bg-white/10 rounded transition-colors text-white font-medium cursor-pointer">
            New Order
          </button>
          
          <!-- Orders Dropdown -->
          <div class="relative h-full flex items-center">
            <button @click="toggleMenu('orders')" class="px-3 py-1 hover:bg-white/10 rounded transition-colors flex items-center gap-1 cursor-pointer">
              <span>Orders</span>
              <i class="fas fa-chevron-down text-[10px]"></i>
            </button>
            <div v-if="activeMenu === 'orders'" class="absolute top-10 left-0 bg-white text-gray-800 shadow-lg border border-gray-200 py-1 rounded w-44 z-50">
              <button @click="emit('open-orders'); activeMenu = null" class="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 font-medium cursor-pointer">
                Orders & Receipts
              </button>
              <button @click="emit('open-orders'); activeMenu = null" class="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 font-medium cursor-pointer">
                Cash Register Sessions
              </button>
            </div>
          </div>

          <!-- Products Dropdown -->
          <div class="relative h-full flex items-center">
            <button @click="toggleMenu('products')" class="px-3 py-1 hover:bg-white/10 rounded transition-colors flex items-center gap-1 cursor-pointer">
              <span>Products</span>
              <i class="fas fa-chevron-down text-[10px]"></i>
            </button>
            <div v-if="activeMenu === 'products'" class="absolute top-10 left-0 bg-white text-gray-800 shadow-lg border border-gray-200 py-1 rounded w-44 z-50">
              <button @click="emit('open-products'); activeMenu = null" class="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 font-medium cursor-pointer">
                Product Catalog
              </button>
              <button @click="emit('open-products'); activeMenu = null" class="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 font-medium cursor-pointer">
                BOM Recipes
              </button>
            </div>
          </div>

          <!-- Configuration Dropdown -->
          <div class="relative h-full flex items-center">
            <button @click="toggleMenu('config')" class="px-3 py-1 hover:bg-white/10 rounded transition-colors flex items-center gap-1 cursor-pointer">
              <span>Configuration</span>
              <i class="fas fa-chevron-down text-[10px]"></i>
            </button>
            <div v-if="activeMenu === 'config'" class="absolute top-10 left-0 bg-white text-gray-800 shadow-lg border border-gray-200 py-1 rounded w-48 z-50">
              <button @click="emit('open-settings'); activeMenu = null" class="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 font-medium cursor-pointer">
                Settings & Database
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right System Info Badge (Locked to Installed Store Identity) -->
      <div class="flex items-center gap-2">
        <span class="text-xs text-amber-200 font-mono font-bold">Store: {{ settingsStore.storeName || 'Main Store' }}</span>
        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white border border-white/20 flex items-center gap-1">
          <i class="fas fa-lock text-[8px] text-amber-300"></i>
          <span>{{ settingsStore.posMode === 'restaurant' ? 'Restaurant Mode' : 'Retail Store Mode' }}</span>
        </span>
      </div>

    </header>

    <!-- Sub Header Controls Bar matching Odoo -->
    <div class="h-12 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 shadow-2xs">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-bold text-gray-900">Point of Sale Dashboard</h1>
        <span class="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-[#714B67] font-bold flex items-center gap-1">
          <i class="fas fa-check-circle text-emerald-600 text-[10px]"></i>
          <span>Installed Terminal</span>
        </span>
      </div>

      <div class="flex items-center gap-2 text-xs text-gray-500 font-medium">
        <i class="fas fa-shield-alt text-purple-700"></i>
        <span>Terminal Configuration Locked</span>
      </div>
    </div>

    <!-- Main Dashboard Content Grid matching Odoo 1:1 -->
    <main class="flex-1 p-6 overflow-y-auto bg-gray-100">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
        
        <!-- Installed POS Terminal Card -->
        <div 
          v-for="terminal in activeTerminals" 
          :key="terminal.id"
          class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-all relative group"
        >
          <div>
            <div class="flex justify-between items-start mb-3">
              <div>
                <h3 class="font-bold text-gray-900 text-lg leading-tight">{{ terminal.name }}</h3>
                <span class="text-[11px] font-bold font-mono text-gray-500 uppercase flex items-center gap-1 mt-0.5">
                  <i class="fas fa-lock text-[9px] text-gray-400"></i>
                  <span>{{ terminal.mode === 'restaurant' ? '🍽️ Restaurant POS' : '🛒 Store / Retail POS' }}</span>
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 text-[10px] font-bold rounded uppercase" :class="sessionStore.isOpen ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-600'">
                  {{ sessionStore.isOpen ? 'Active Session' : 'Closed' }}
                </span>
              </div>
            </div>

            <div class="space-y-1.5 text-xs text-gray-600 my-4 bg-slate-50 p-3 rounded-lg border border-gray-100">
              <div class="flex justify-between">
                <span>Opening Cash Float:</span>
                <span class="font-bold text-gray-900 font-mono">{{ sessionStore.isOpen ? sessionStore.openingBalance.toFixed(2) : '0.00' }} Rs.</span>
              </div>
              <div class="flex justify-between">
                <span>Total Sales:</span>
                <span class="font-bold text-gray-900 font-mono">{{ sessionStore.isOpen ? sessionStore.completedSalesTotal.toFixed(2) : '0.00' }} Rs.</span>
              </div>
              <div v-if="ongoingTicketsCount > 0" class="flex justify-between text-emerald-700 font-semibold">
                <span>Ongoing Tickets:</span>
                <span class="font-mono">{{ ongoingTicketsTotal.toFixed(2) }} Rs. ({{ ongoingTicketsCount }})</span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-4 border-t border-gray-100">
            <button 
              v-if="sessionStore.isOpen"
              @click="emit('open-pos')" 
              class="px-5 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <i class="fas fa-cash-register"></i>
              <span>Continue Selling</span>
            </button>
            <button 
              v-else
              @click="handleOpenRegisterClick" 
              class="px-5 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <i class="fas fa-play"></i>
              <span>Open Register Session</span>
            </button>
          </div>
        </div>

      </div>
    </main>

    <!-- Cash Opening Float Control Modal matching Odoo -->
    <div v-if="showOpeningFloatModal" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-purple-900/20">
        
        <!-- Header with Back Button -->
        <div class="px-6 py-4 bg-[#714B67] text-white flex justify-between items-center relative">
          <div class="flex items-center gap-2 font-bold text-base">
            <i class="fas fa-cash-register"></i> 
            <span>Opening Cash Control</span>
          </div>
          <button @click="showOpeningFloatModal = false" class="text-white/80 hover:text-white transition-colors cursor-pointer text-sm font-bold">
            ✕
          </button>
        </div>

        <div class="p-6 space-y-5">
          <div class="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-[#714B67] text-white flex items-center justify-center text-lg font-bold">
              💰
            </div>
            <div>
              <h4 class="font-bold text-gray-900 text-sm">{{ selectedShopName }}</h4>
              <p class="text-xs text-gray-500">Enter cash drawer opening balance</p>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Opening Cash (Rs.)</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 font-mono">Rs</span>
              <input 
                v-model.number="openingFloatAmount"
                type="number" 
                min="0"
                step="100"
                class="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-mono text-xl font-black text-gray-900 focus:outline-none focus:border-[#714B67] focus:bg-white transition-all"
                placeholder="1000"
              />
            </div>
          </div>

          <!-- Quick Preset Amounts -->
          <div class="grid grid-cols-4 gap-2">
            <button 
              v-for="amt in [0, 1000, 2000, 5000]" 
              :key="amt"
              type="button"
              @click="openingFloatAmount = amt"
              :class="[
                'py-2 rounded-lg text-xs font-bold font-mono transition-all border cursor-pointer',
                openingFloatAmount === amt 
                  ? 'bg-[#714B67] text-white border-[#714B67] shadow-xs' 
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              ]"
            >
              {{ amt === 0 ? '0' : amt }}
            </button>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
          <button 
            @click="showOpeningFloatModal = false"
            class="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            Discard
          </button>
          <button 
            @click="handleConfirmOpenSession"
            class="px-6 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded-xl text-xs transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <span>Open Session &amp; Launch POS</span>
            <i class="fas fa-arrow-right text-[10px]"></i>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
