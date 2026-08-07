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
import { useNodeConfigStore } from './stores/useNodeConfigStore'

import NodeConfigView from './views/NodeConfigView.vue'
import InitialNodeSetupWizard from './components/setup/InitialNodeSetupWizard.vue'
import AppToast from './components/AppToast.vue'

const isReady = ref(false)
const errorMsg = ref('')

// Restore last active view from sessionStorage to survive HMR & full page reloads
const SESSION_VIEW_KEY = 'pos_active_view'
const _savedView = sessionStorage.getItem(SESSION_VIEW_KEY) as 'portal' | 'dashboard' | 'terminal' | 'node_config' | null
const currentAppView = ref<'portal' | 'dashboard' | 'terminal' | 'node_config'>(_savedView || 'portal')

const authStore = useAuthStore()
const masterDbStore = useMasterDbStore()
const nodeConfigStore = useNodeConfigStore()

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
    
    // Only override from URL if nothing was persisted in sessionStorage
    if (!_savedView) {
      const path = window.location.pathname.toLowerCase()
      const hash = window.location.hash.toLowerCase()
      if (path.includes('pos/ui') || path.includes('floor') || path.includes('register') || path.includes('ticket') || hash.includes('pos/ui')) {
        currentAppView.value = 'terminal'
      } else {
        currentAppView.value = 'portal'
      }
    }
    
    isReady.value = true
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to initialize Edge Database'
  }
})

watch(currentAppView, (newVal) => {
  // Persist view so it survives HMR and full page reloads
  sessionStorage.setItem(SESSION_VIEW_KEY, newVal)

  // Prevent invalid file:/// pushState in Electron / local file protocol
  if (window.location.protocol === 'file:') return

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

function handleRoleChanged() {
  currentAppView.value = 'portal'
}
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
    <!-- First-Time Initial Node Setup Wizard -->
    <InitialNodeSetupWizard v-if="!nodeConfigStore.isSetupCompleted" />

    <div class="h-screen w-screen flex flex-col overflow-hidden bg-gray-100 font-sans text-gray-800">
      <!-- Universal Master Top Bar for System Navigation & Role Badge -->
      <header class="h-10 bg-[#3f2538] text-white flex items-center justify-between px-3 text-xs font-semibold shrink-0 z-40 shadow-xs border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 font-bold cursor-pointer">
            <i class="fas fa-[#e0a96d] fa-shield-alt"></i>
            <span class="text-sm tracking-tight text-amber-200 font-extrabold">POS Enterprise</span>
          </div>


        </div>

        <div class="flex items-center gap-3">
          <!-- Active Mode Info -->
          <div class="text-[11px] text-amber-200/90 font-mono hidden md:block">
            Mode: <span class="font-bold text-white">{{ authStore.roleLabel }}</span>
          </div>

          <button 
            v-if="authStore.isDeveloper"
            @click="currentAppView = currentAppView === 'node_config' ? 'portal' : 'node_config'"
            :class="currentAppView === 'node_config' ? 'bg-emerald-600 text-white font-bold' : 'bg-white/10 text-white/80 hover:bg-white/20'"
            class="px-2.5 py-1 rounded text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <i class="fas fa-network-wired"></i> Node & Sync
          </button>

          <button @click="authStore.showLoginModal = true" class="px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold rounded text-xs flex items-center gap-1.5 shadow-xs transition-colors">
            <i class="fas fa-key"></i> Switch PIN / Account
          </button>
        </div>
      </header>

      <!-- Main Body View according to Role -->
      <div class="flex-1 overflow-hidden relative">
        <!-- NODE CONFIG & SYNC VIEW -->
        <NodeConfigView v-if="currentAppView === 'node_config'" />

        <!-- DEVELOPER ROLE VIEW -->
        <DeveloperPortalView v-else-if="authStore.isDeveloper && currentAppView !== 'terminal'" />

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
    <LoginModal 
      v-if="authStore.showLoginModal" 
      @close="authStore.showLoginModal = false" 
      @role-changed="handleRoleChanged"
    />
  </template>

  <!-- Global Toast Notifications (replaces all alert() dialogs) -->
  <AppToast />
</template>
