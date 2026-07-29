<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import POSLayout from './components/POSLayout.vue'
import POSDashboardView from './views/POSDashboardView.vue'
import DeveloperPortalView from './views/DeveloperPortalView.vue'
import ManagerPortalView from './views/ManagerPortalView.vue'
import LoginModal from './components/modals/LoginModal.vue'
import { initDb } from './db/client'
import { runInitialSeed } from './db/seed'
import { useProductStore } from './stores/useProductStore'
import { useSessionStore } from './stores/useSessionStore'
import { useAuthStore } from './stores/useAuthStore'
import { useMasterDbStore } from './stores/useMasterDbStore'

const isReady = ref(false)
const errorMsg = ref('')
const currentAppView = ref<'portal' | 'dashboard' | 'terminal'>('portal')

const authStore = useAuthStore()
const masterDbStore = useMasterDbStore()

onMounted(async () => {
  try {
    await initDb()
    await runInitialSeed()
    
    // Load data into stores
    const productStore = useProductStore()
    await productStore.loadFromDb()
    
    const sessionStore = useSessionStore()
    await sessionStore.loadLatestSession()

    await authStore.loadUsers()
    await masterDbStore.loadSettingsAndNodes()
    await masterDbStore.testConnection()
    
    const path = window.location.pathname.toLowerCase()
    const hash = window.location.hash.toLowerCase()
    if (path.includes('pos/ui') || path.includes('floor') || path.includes('register') || path.includes('ticket') || hash.includes('pos/ui')) {
      currentAppView.value = 'terminal'
    } else {
      currentAppView.value = 'portal'
    }
    
    isReady.value = true
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to initialize Edge Database'
  }
})

watch(currentAppView, (newVal) => {
  if (newVal === 'terminal') {
    if (!window.location.pathname.includes('/pos/ui')) {
      window.history.pushState(null, '', '/pos/ui/2/floor')
    }
  } else {
    if (window.location.pathname !== '/odoo/point-of-sale') {
      window.history.pushState(null, '', '/odoo/point-of-sale')
    }
  }
})
</script>

<template>
  <div v-if="!isReady" class="h-screen w-screen flex flex-col items-center justify-center bg-gray-100 text-gray-800 font-sans">
    <div v-if="errorMsg" class="text-red-500 font-bold mb-2">Error: {{ errorMsg }}</div>
    <div v-else class="flex flex-col items-center">
      <i class="fas fa-circle-notch fa-spin text-4xl text-[#714B67] mb-4"></i>
      <div class="text-xl font-bold text-[#714B67]">Initializing Universal Point of Sale...</div>
    </div>
  </div>
  
  <template v-else>
    <div class="h-screen w-screen flex flex-col overflow-hidden bg-gray-100 font-sans text-gray-800">
      <!-- Universal Master Top Bar for System Navigation & Role Badge -->
      <header class="h-10 bg-[#3f2538] text-white flex items-center justify-between px-3 text-xs font-semibold shrink-0 z-40 shadow-xs border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 font-bold cursor-pointer">
            <i class="fas fa-[#e0a96d] fa-shield-alt"></i>
            <span class="text-sm tracking-tight text-amber-200 font-extrabold">POS Enterprise</span>
          </div>

          <!-- Role Switcher Badges -->
          <div class="flex items-center gap-1.5 ml-2">
            <button 
              @click="authStore.switchRole('DEVELOPER')" 
              :class="[authStore.activeRole === 'DEVELOPER' ? 'bg-purple-600 text-white font-bold' : 'bg-white/10 text-white/70 hover:bg-white/20']"
              class="px-2.5 py-1 rounded text-[11px] flex items-center gap-1 transition-all"
            >
              <i class="fas fa-code"></i> Developer
            </button>

            <button 
              @click="authStore.switchRole('MANAGER')" 
              :class="[authStore.activeRole === 'MANAGER' ? 'bg-blue-600 text-white font-bold' : 'bg-white/10 text-white/70 hover:bg-white/20']"
              class="px-2.5 py-1 rounded text-[11px] flex items-center gap-1 transition-all"
            >
              <i class="fas fa-user-tie"></i> Manager
            </button>

            <button 
              @click="authStore.switchRole('SALESPERSON')" 
              :class="[authStore.activeRole === 'SALESPERSON' ? 'bg-emerald-600 text-white font-bold' : 'bg-white/10 text-white/70 hover:bg-white/20']"
              class="px-2.5 py-1 rounded text-[11px] flex items-center gap-1 transition-all"
            >
              <i class="fas fa-cash-register"></i> Salesperson
            </button>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Active Mode Info -->
          <div class="text-[11px] text-amber-200/90 font-mono hidden md:block">
            Mode: <span class="font-bold text-white">{{ authStore.roleLabel }}</span>
          </div>

          <button @click="authStore.showLoginModal = true" class="px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold rounded text-xs flex items-center gap-1.5 shadow-xs transition-colors">
            <i class="fas fa-key"></i> Switch PIN / Account
          </button>
        </div>
      </header>

      <!-- Main Body View according to Role -->
      <div class="flex-1 overflow-hidden relative">
        <!-- DEVELOPER ROLE VIEW -->
        <DeveloperPortalView v-if="authStore.isDeveloper && currentAppView !== 'terminal'" />

        <!-- MANAGER ROLE VIEW -->
        <ManagerPortalView 
          v-else-if="authStore.isManager && currentAppView !== 'terminal'" 
          @open-pos="currentAppView = 'terminal'" 
        />

        <!-- SALESPERSON ROLE VIEW & POS TERMINAL -->
        <template v-else>
          <POSDashboardView 
            v-if="currentAppView !== 'terminal'" 
            @open-pos="currentAppView = 'terminal'"
            @open-orders="currentAppView = 'terminal'"
            @open-products="currentAppView = 'terminal'"
            @open-settings="currentAppView = 'terminal'"
          />
          <POSLayout v-else @back-to-dashboard="currentAppView = 'portal'" />
        </template>
      </div>
    </div>

    <!-- Login Modal -->
    <LoginModal v-if="authStore.showLoginModal" @close="authStore.showLoginModal = false" />
  </template>
</template>
