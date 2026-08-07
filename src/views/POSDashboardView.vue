<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSessionStore } from '../stores/useSessionStore'
import { useCartStore } from '../stores/useCartStore'
import { useSettingsStore, type POSMode } from '../stores/useSettingsStore'
import { useNodeConfigStore } from '../stores/useNodeConfigStore'
import { useToast } from '../composables/useToast'

const emit = defineEmits(['open-pos', 'open-orders', 'open-products', 'open-settings'])
const sessionStore = useSessionStore()
const cartStore = useCartStore()
const settingsStore = useSettingsStore()
const nodeConfigStore = useNodeConfigStore()
const toast = useToast()

const activeMenu = ref<string | null>(null)
const showOpeningFloatModal = ref(false)
const showNewTerminalModal = ref(false)
const openingFloatAmount = ref(1000)
const selectedShopName = ref('Main Store')

// New Terminal Form
const newTerminalName = ref('')
const newTerminalMode = ref<POSMode>('restaurant')

const toggleMenu = (menuName: string) => {
  if (activeMenu.value === menuName) {
    activeMenu.value = null
  } else {
    activeMenu.value = menuName
  }
}

const handleOpenRegisterClick = (shopName: string, mode: POSMode) => {
  selectedShopName.value = shopName
  settingsStore.setMode(mode)
  settingsStore.setStoreName(shopName)
  showOpeningFloatModal.value = true
}

const handleConfirmOpenSession = async () => {
  await sessionStore.openSession(openingFloatAmount.value)
  showOpeningFloatModal.value = false
  emit('open-pos')
}

const handleCreateTerminal = () => {
  if (!newTerminalName.value) {
    toast.warning('Please enter terminal name')
    return
  }
  settingsStore.addTerminal(newTerminalName.value, newTerminalMode.value)
  newTerminalName.value = ''
  showNewTerminalModal.value = false
}

const handleDeleteTerminal = (id: string, name: string) => {
  if (confirm(`Are you sure you want to delete terminal outlet "${name}"?`)) {
    settingsStore.deleteTerminal(id)
  }
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

// Dynamic terminals list
const activeTerminals = computed(() => {
  if (settingsStore.terminals.length > 0) {
    return settingsStore.terminals
  }
  return [
    {
      id: 'pos-setup-01',
      name: settingsStore.storeName || nodeConfigStore.config.branch_id || 'Main Store',
      mode: settingsStore.posMode || 'restaurant',
      status: 'closed' as const,
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
          <button @click="emit('open-pos')" class="px-3 py-1 hover:bg-white/10 rounded transition-colors text-white font-medium">
            New Order
          </button>
          
          <!-- Orders Dropdown -->
          <div class="relative h-full flex items-center">
            <button @click="toggleMenu('orders')" class="px-3 py-1 hover:bg-white/10 rounded transition-colors flex items-center gap-1">
              <span>Orders</span>
              <i class="fas fa-chevron-down text-[10px]"></i>
            </button>
            <div v-if="activeMenu === 'orders'" class="absolute top-10 left-0 bg-white text-gray-800 shadow-lg border border-gray-200 py-1 rounded w-44 z-50">
              <button @click="emit('open-orders'); activeMenu = null" class="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 font-medium">
                Orders & Receipts
              </button>
              <button @click="emit('open-orders'); activeMenu = null" class="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 font-medium">
                Cash Register Sessions
              </button>
            </div>
          </div>

          <!-- Products Dropdown -->
          <div class="relative h-full flex items-center">
            <button @click="toggleMenu('products')" class="px-3 py-1 hover:bg-white/10 rounded transition-colors flex items-center gap-1">
              <span>Products</span>
              <i class="fas fa-chevron-down text-[10px]"></i>
            </button>
            <div v-if="activeMenu === 'products'" class="absolute top-10 left-0 bg-white text-gray-800 shadow-lg border border-gray-200 py-1 rounded w-44 z-50">
              <button @click="emit('open-products'); activeMenu = null" class="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 font-medium">
                Product Catalog
              </button>
              <button @click="emit('open-products'); activeMenu = null" class="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 font-medium">
                BOM Recipes
              </button>
            </div>
          </div>

          <!-- Configuration Dropdown -->
          <div class="relative h-full flex items-center">
            <button @click="toggleMenu('config')" class="px-3 py-1 hover:bg-white/10 rounded transition-colors flex items-center gap-1">
              <span>Configuration</span>
              <i class="fas fa-chevron-down text-[10px]"></i>
            </button>
            <div v-if="activeMenu === 'config'" class="absolute top-10 left-0 bg-white text-gray-800 shadow-lg border border-gray-200 py-1 rounded w-48 z-50">
              <button @click="emit('open-settings'); activeMenu = null" class="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 font-medium">
                Settings & Database
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right System Info Badge -->
      <div class="flex items-center gap-3">
        <span class="text-xs text-amber-200 font-mono">Store: {{ settingsStore.storeName }}</span>
        <button 
          @click="showNewTerminalModal = true" 
          class="bg-amber-400 hover:bg-amber-300 text-gray-900 font-bold px-3 py-1 rounded text-xs transition-all shadow-xs flex items-center gap-1"
        >
          <i class="fas fa-plus"></i>
          <span>Create New POS Terminal</span>
        </button>
      </div>

    </header>

    <!-- Sub Header Controls Bar matching Odoo -->
    <div class="h-12 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 shadow-2xs">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-bold text-gray-900">Point of Sale Dashboard</h1>
        <span class="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-[#714B67] font-bold">
          {{ activeTerminals.length }} POS Outlet{{ activeTerminals.length === 1 ? '' : 's' }}
        </span>
      </div>

      <!-- Action Buttons & Search -->
      <div class="flex items-center gap-3 text-xs">
        <button 
          @click="showNewTerminalModal = true"
          class="px-3 py-1.5 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <i class="fas fa-plus"></i>
          <span>New POS Outlet</span>
        </button>
      </div>
    </div>

    <!-- Main Dashboard Content Grid matching Odoo 1:1 -->
    <main class="flex-1 p-6 overflow-y-auto bg-gray-100">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
        
        <!-- Dynamic POS Terminal Cards -->
        <div 
          v-for="terminal in activeTerminals" 
          :key="terminal.id"
          class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-all relative group"
        >
          <div>
            <div class="flex justify-between items-start mb-3">
              <div>
                <h3 class="font-bold text-gray-900 text-lg leading-tight">{{ terminal.name }}</h3>
                <span class="text-[11px] font-bold font-mono text-gray-500 uppercase">
                  {{ terminal.mode === 'restaurant' ? '🍽️ Restaurant POS' : '🛒 Store / Retail POS' }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 text-[10px] font-bold rounded uppercase" :class="sessionStore.isOpen ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-600'">
                  {{ sessionStore.isOpen ? 'Active Session' : 'Closed' }}
                </span>
                <button 
                  v-if="activeTerminals.length > 1"
                  @click.stop="handleDeleteTerminal(terminal.id, terminal.name)" 
                  class="text-gray-400 hover:text-rose-600 transition-colors p-1"
                  title="Delete Outlet"
                >
                  <i class="fas fa-trash-alt text-xs"></i>
                </button>
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
              @click="handleOpenRegisterClick(terminal.name, terminal.mode)" 
              class="px-5 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded text-xs transition-colors shadow-xs flex items-center gap-1.5"
            >
              <i class="fas fa-cash-register"></i>
              <span>Continue Selling</span>
            </button>
            <button 
              v-else
              @click="handleOpenRegisterClick(terminal.name, terminal.mode)" 
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
          <button @click="showOpeningFloatModal = false" class="text-white/80 hover:text-white text-lg font-bold">✕</button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4 text-xs text-gray-700">
          <p class="text-xs text-gray-600 leading-relaxed">
            Please specify the opening cash float amount in drawer for terminal <b>#{{ selectedShopName }}</b>.
          </p>

          <div>
            <label class="block font-bold text-gray-800 mb-1.5">Opening Float (Rs.)</label>
            <input 
              v-model.number="openingFloatAmount" 
              type="number" 
              class="w-full p-3 border border-gray-300 rounded-xl font-mono font-bold text-lg text-gray-900 focus:outline-none focus:border-[#714B67] bg-slate-50 focus:bg-white"
            />
          </div>
        </div>

        <!-- Footer with Back / Cancel & Confirm Buttons -->
        <div class="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <button 
            @click="showOpeningFloatModal = false" 
            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all"
          >
            ← Back to Dashboard
          </button>
          
          <button 
            @click="handleConfirmOpenSession" 
            class="px-5 py-2.5 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <i class="fas fa-play"></i>
            <span>Open Session & Start POS</span>
          </button>
        </div>

      </div>
    </div>

    <!-- Create New POS Terminal Modal -->
    <div v-if="showNewTerminalModal" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div class="px-6 py-4 bg-[#714B67] text-white flex justify-between items-center">
          <h3 class="font-bold text-base flex items-center gap-2">
            <i class="fas fa-plus-circle"></i> Create New POS Terminal
          </h3>
          <button @click="showNewTerminalModal = false" class="text-white/80 hover:text-white text-lg font-bold">✕</button>
        </div>

        <div class="p-6 space-y-4 text-xs text-gray-700">
          <div>
            <label class="block font-bold text-gray-800 mb-1">POS Terminal Name</label>
            <input 
              v-model="newTerminalName" 
              type="text" 
              placeholder="e.g. DHA Phase 5 Outlet or Counter 2 Register"
              class="w-full p-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#714B67]"
            />
          </div>

          <div>
            <label class="block font-bold text-gray-800 mb-1">POS System Mode</label>
            <select v-model="newTerminalMode" class="w-full p-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#714B67]">
              <option value="restaurant">🍽️ Restaurant POS (Table Canvas, KOT/KDS)</option>
              <option value="retail">🛒 Store / Retail POS (Barcode Scanner Grid)</option>
            </select>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
          <button @click="showNewTerminalModal = false" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded text-xs">
            Cancel
          </button>
          <button @click="handleCreateTerminal" class="px-5 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded-lg text-xs shadow-xs">
            Create Terminal
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
