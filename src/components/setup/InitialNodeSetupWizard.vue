<template>
  <div class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 font-sans text-slate-800">
    <div class="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-purple-900/20">
      
      <!-- Header Banner -->
      <div class="bg-gradient-to-r from-[#3f2538] to-[#714B67] p-6 text-white flex justify-between items-center relative">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-400 text-gray-900 shadow-sm">
              App Deployment Setup
            </span>
            <span class="text-xs text-amber-200/90 font-mono font-bold">Step {{ step }} of 4</span>
          </div>
          <h1 class="text-2xl font-black tracking-tight text-white">Universal POS Setup Wizard</h1>
          <p class="text-xs text-purple-100/80">Configure deployment role, workspace mode, store profile & developer PIN</p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 text-2xl font-bold shadow-inner">
          <i class="fas" :class="step === 1 ? 'fa-laptop' : (step === 2 ? 'fa-store' : (step === 3 ? 'fa-code' : 'fa-rocket'))"></i>
        </div>
      </div>

      <!-- Step Navigation Bar -->
      <div class="grid grid-cols-4 bg-gray-100 border-b border-gray-200 text-[11px] font-bold text-center">
        <div 
          :class="[
            'py-2.5 border-b-2 transition-all flex items-center justify-center space-x-1.5',
            step === 1 ? 'border-[#714B67] text-[#714B67] bg-white' : (step > 1 ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-gray-400')
          ]"
        >
          <i class="fas" :class="step > 1 ? 'fa-check-circle text-emerald-600' : 'fa-laptop'"></i>
          <span>1. Deployment</span>
        </div>

        <div 
          :class="[
            'py-2.5 border-b-2 transition-all flex items-center justify-center space-x-1.5',
            step === 2 ? 'border-[#714B67] text-[#714B67] bg-white' : (step > 2 ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-gray-400')
          ]"
        >
          <i class="fas" :class="step > 2 ? 'fa-check-circle text-emerald-600' : 'fa-store'"></i>
          <span>2. Store & POS Mode</span>
        </div>

        <div 
          :class="[
            'py-2.5 border-b-2 transition-all flex items-center justify-center space-x-1.5',
            step === 3 ? 'border-[#714B67] text-[#714B67] bg-white' : (step > 3 ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-gray-400')
          ]"
        >
          <i class="fas" :class="step > 3 ? 'fa-check-circle text-emerald-600' : 'fa-code'"></i>
          <span>3. Dev PIN</span>
        </div>

        <div 
          :class="[
            'py-2.5 border-b-2 transition-all flex items-center justify-center space-x-1.5',
            step === 4 ? 'border-[#714B67] text-[#714B67] bg-white' : 'border-transparent text-gray-400'
          ]"
        >
          <i class="fas fa-rocket"></i>
          <span>4. Launch</span>
        </div>
      </div>

      <!-- Step Content Container -->
      <div class="p-6 flex-1 overflow-y-auto space-y-6 bg-slate-50">

        <!-- STEP 1: SELECT APPLICATION DEPLOYMENT ROLE -->
        <div v-if="step === 1" class="space-y-4">
          <div class="flex items-center justify-between border-b pb-2">
            <div>
              <h2 class="text-sm font-bold text-gray-800 uppercase tracking-wider">Step 1: Select Application Deployment Role</h2>
              <p class="text-xs text-gray-500">Choose the role for this system installation</p>
            </div>
            <span class="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1.5 shadow-xs">
              <i class="fas fa-check-circle text-emerald-600"></i>
              <span>Active Target: POS Terminal</span>
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            
            <!-- STANDALONE POS / POS TERMINAL CARD -->
            <div 
              @click="selectDeploymentRole('STANDALONE_POS')"
              :class="[
                'p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between shadow-sm',
                selectedRole === 'STANDALONE_POS'
                  ? 'border-[#714B67] bg-purple-50/40 ring-4 ring-[#714B67]/10 shadow-md'
                  : 'border-gray-200 bg-white hover:border-purple-300'
              ]"
            >
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div class="w-10 h-10 rounded-xl bg-[#714B67] text-white flex items-center justify-center text-lg font-bold shadow-sm">
                    ⚡
                  </div>
                  <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Ready
                  </span>
                </div>
                <h3 class="font-bold text-base text-gray-900">POS Terminal</h3>
                <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                  Direct counter terminal with offline SQLite engine, product catalog, cart management, receipt printing, and local cash control.
                </p>
              </div>

              <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold text-[#714B67]">
                <span>Select & Proceed</span>
                <i class="fas fa-arrow-right"></i>
              </div>
            </div>

            <!-- MULTI-BRANCH SERVER CARD (PHASE 2) -->
            <div 
              @click="selectDeploymentRole('BRANCH_SERVER')"
              :class="[
                'p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between opacity-60 shadow-sm',
                selectedRole === 'BRANCH_SERVER'
                  ? 'border-blue-600 bg-blue-50/40 ring-4 ring-blue-500/10'
                  : 'border-gray-200 bg-white hover:border-blue-300'
              ]"
            >
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg font-bold shadow-sm">
                    🏢
                  </div>
                  <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                    Phase 2
                  </span>
                </div>
                <h3 class="font-bold text-base text-gray-900">Branch Server</h3>
                <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                  Acts as local master hub inside a branch coordinating multiple registers, inventory balance, and centralizing sales.
                </p>
              </div>

              <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold text-blue-600">
                <span>Multi-Terminal Hub</span>
                <i class="fas fa-lock"></i>
              </div>
            </div>

            <!-- ENTERPRISE HQ CARD (PHASE 2) -->
            <div 
              @click="selectDeploymentRole('LEAF_POS')"
              :class="[
                'p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between opacity-60 shadow-sm',
                selectedRole === 'LEAF_POS'
                  ? 'border-amber-600 bg-amber-50/40 ring-4 ring-amber-500/10'
                  : 'border-gray-200 bg-white hover:border-amber-300'
              ]"
            >
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div class="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center text-lg font-bold shadow-sm">
                    🌐
                  </div>
                  <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                    Phase 2
                  </span>
                </div>
                <h3 class="font-bold text-base text-gray-900">Cloud Sync HQ</h3>
                <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                  Syncs sales reports, multi-branch catalogs, and cash audits with central cloud VPS server.
                </p>
              </div>

              <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold text-amber-600">
                <span>Cloud Sync Mode</span>
                <i class="fas fa-lock"></i>
              </div>
            </div>

          </div>

          <div v-if="notImplementedNotice" class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center space-x-2">
            <i class="fas fa-info-circle text-amber-600"></i>
            <div>
              <span class="font-bold">Notice:</span> Server and HQ sync modes are for multi-terminal networks. Please select <strong>POS Terminal</strong> to configure your local terminal workspace.
            </div>
          </div>
        </div>

        <!-- STEP 2: STORE DETAILS & POS MODE -->
        <div v-else-if="step === 2" class="space-y-5">
          <div class="flex items-center justify-between border-b pb-2">
            <div>
              <h2 class="text-sm font-bold text-gray-800 uppercase tracking-wider">Step 2: Store Details & POS Mode</h2>
              <p class="text-xs text-gray-500">Configure your store name, outlet workspace mode, and local database storage location</p>
            </div>
            <span class="text-[11px] font-extrabold px-3 py-1 rounded-full bg-purple-100 text-[#714B67] border border-purple-300 flex items-center space-x-1.5 shadow-xs">
              <i class="fas fa-store text-[#714B67]"></i>
              <span>Terminal Setup</span>
            </span>
          </div>

          <!-- Store Name & Local DB Storage Inputs -->
          <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4 text-xs">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-gray-700 font-bold mb-1">Store / Outlet Name</label>
                <input 
                  v-model="storeForm.storeName" 
                  type="text" 
                  class="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-gray-900 font-semibold focus:outline-none focus:border-[#714B67] focus:bg-white text-sm" 
                  placeholder="e.g. Main Flagship Store"
                  required
                />
              </div>

              <div>
                <label class="block text-gray-700 font-bold mb-1">Primary Local Database Storage Folder</label>
                <div class="flex gap-2">
                  <input 
                    v-model="storeForm.db_storage_path" 
                    type="text" 
                    class="flex-1 bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-gray-900 font-mono text-xs focus:outline-none focus:border-[#714B67] focus:bg-white" 
                    placeholder="F:\POS_Data"
                  />
                  <button 
                    type="button" 
                    @click="handleSelectFolderInWizard" 
                    class="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-xl font-bold flex items-center gap-1.5 text-xs transition-colors shrink-0 cursor-pointer"
                    title="Select Folder on Disk"
                  >
                    <i class="fas fa-folder-open"></i>
                    <span>Browse</span>
                  </button>
                </div>
                <p class="text-[11px] text-gray-500 mt-1">
                  📁 Live SQLite file (<code class="bg-gray-100 px-1 rounded text-gray-800 font-mono">pos.sqlite</code>) location on disk.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Select POS Workspace Mode</label>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <!-- RESTAURANT POS CARD -->
              <div 
                @click="storeForm.posMode = 'restaurant'"
                :class="[
                  'p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between shadow-sm',
                  storeForm.posMode === 'restaurant'
                    ? 'border-[#714B67] bg-purple-50/40 ring-4 ring-[#714B67]/10 shadow-md'
                    : 'border-gray-200 bg-white hover:border-purple-300'
                ]"
              >
                <div>
                  <div class="flex justify-between items-start mb-3">
                    <div class="w-12 h-12 rounded-xl bg-[#714B67] text-white flex items-center justify-center text-xl font-bold shadow-sm">
                      🍽️
                    </div>
                    <span 
                      v-if="storeForm.posMode === 'restaurant'" 
                      class="text-[11px] font-black uppercase px-2.5 py-1 rounded-full bg-[#714B67] text-white shadow-xs"
                    >
                      SELECTED
                    </span>
                  </div>
                  <h3 class="font-bold text-base text-gray-900">Restaurant POS</h3>
                  <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                    Optimized for restaurants, cafés, and food outlets. Includes Floor Plan table canvas, Kitchen Order Tickets (KOT), and BOM recipe ingredient tracking.
                  </p>
                </div>

                <div class="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-[#714B67]">Table Canvas</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-[#714B67]">Kitchen KOT</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-[#714B67]">BOM Recipes</span>
                </div>
              </div>

              <!-- STORE / RETAIL POS CARD -->
              <div 
                @click="storeForm.posMode = 'retail'"
                :class="[
                  'p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between shadow-sm',
                  storeForm.posMode === 'retail'
                    ? 'border-[#00A09D] bg-teal-50/40 ring-4 ring-[#00A09D]/10 shadow-md'
                    : 'border-gray-200 bg-white hover:border-teal-300'
                ]"
              >
                <div>
                  <div class="flex justify-between items-start mb-3">
                    <div class="w-12 h-12 rounded-xl bg-[#00A09D] text-white flex items-center justify-center text-xl font-bold shadow-sm">
                      🛒
                    </div>
                    <span 
                      v-if="storeForm.posMode === 'retail'" 
                      class="text-[11px] font-black uppercase px-2.5 py-1 rounded-full bg-[#00A09D] text-white shadow-xs"
                    >
                      SELECTED
                    </span>
                  </div>
                  <h3 class="font-bold text-base text-gray-900">Store / Retail POS</h3>
                  <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                    Optimized for retail stores, supermarkets, and shops. Includes fast barcode scanner checkout grid, direct inventory management, and stock control.
                  </p>
                </div>

                <div class="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-[#00A09D]">Barcode Scanner</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-[#00A09D]">Quick Grid</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-[#00A09D]">Stock Control</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- STEP 3: DEVELOPER PIN SETUP -->
        <div v-else-if="step === 3" class="space-y-4">
          <div class="border-b pb-2">
            <h2 class="text-sm font-bold text-gray-800 uppercase tracking-wider">Step 3: Setup Developer PIN & System Account</h2>
            <p class="text-xs text-gray-500">Set the master credentials and PIN code for system developer & super admin access</p>
          </div>

          <div class="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 text-xs">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-gray-700 font-bold mb-1">Developer Full Name</label>
                <input 
                  v-model="devForm.name" 
                  type="text" 
                  class="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-gray-900 font-semibold focus:outline-none focus:border-[#714B67] focus:bg-white" 
                  placeholder="e.g. Super Developer"
                  required
                />
              </div>

              <div>
                <label class="block text-gray-700 font-bold mb-1">Developer Username</label>
                <input 
                  v-model="devForm.username" 
                  type="text" 
                  class="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-gray-900 font-semibold focus:outline-none focus:border-[#714B67] focus:bg-white" 
                  placeholder="e.g. dev"
                  required
                />
              </div>
            </div>

            <div>
              <label class="block text-gray-700 font-bold mb-1">Set Developer PIN Code (4-8 Digits)</label>
              <input 
                v-model="devForm.pin" 
                type="password" 
                maxLength="8"
                class="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-purple-950 font-mono tracking-widest focus:outline-none focus:border-[#714B67] focus:bg-white text-lg font-bold" 
                placeholder="e.g. 1234"
                required
              />
              <p class="text-[11px] text-gray-500 mt-1">
                🔑 Developer PIN grants full access to Developer Settings, User Management, DB export/purge, and system configuration.
              </p>
            </div>
          </div>
        </div>

        <!-- STEP 4: COMPLETE SETUP & LAUNCH -->
        <div v-else-if="step === 4" class="space-y-4 text-center py-4">
          <div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-300 flex items-center justify-center text-3xl mx-auto mb-2 shadow-inner">
            <i class="fas fa-check"></i>
          </div>
          <h2 class="text-xl font-bold text-gray-900">Setup Ready to Launch!</h2>
          <p class="text-xs text-gray-500 max-w-md mx-auto">
            Your store workspace and developer credentials are ready to initialize. Additional users and roles can be created anytime via User Management.
          </p>

          <div class="bg-white p-5 rounded-2xl border border-gray-200 text-xs font-mono text-left max-w-md mx-auto space-y-2.5 shadow-sm">
            <div class="flex justify-between items-center border-b pb-2">
              <span class="text-gray-500 font-sans font-bold">Deployment Role:</span> 
              <span class="font-bold text-[#714B67]">POS Terminal</span>
            </div>
            <div class="flex justify-between items-center border-b pb-2">
              <span class="text-gray-500 font-sans font-bold">Developer Admin:</span> 
              <span class="font-bold text-blue-700">{{ devForm.name }} (PIN: {{ devForm.pin }})</span>
            </div>
            <div class="flex justify-between"><span class="text-gray-500 font-sans">Store Name:</span> <span class="text-gray-900 font-semibold">{{ storeForm.storeName }}</span></div>
            <div class="flex justify-between"><span class="text-gray-500 font-sans">POS Mode:</span> <span class="text-gray-900 font-semibold uppercase">{{ storeForm.posMode }}</span></div>
            <div class="flex justify-between"><span class="text-gray-500 font-sans">Local DB Path:</span> <span class="text-gray-900 font-semibold text-[11px] truncate max-w-[200px]">{{ storeForm.db_storage_path || 'Default AppData' }}</span></div>
          </div>
        </div>

      </div>

      <!-- Wizard Footer Controls -->
      <div class="p-4 bg-white border-t border-gray-200 flex justify-between items-center">
        <button 
          v-if="step > 1"
          @click="step--"
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all border border-gray-300 cursor-pointer"
        >
          ← Back
        </button>
        <div v-else></div>

        <button 
          @click="handleNext"
          class="px-6 py-2.5 bg-gradient-to-r from-[#714B67] to-[#714B67]/90 hover:opacity-90 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center space-x-2 cursor-pointer"
        >
          <span>{{ step === 4 ? 'Complete Setup & Launch POS App →' : 'Next Step →' }}</span>
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore, type POSMode } from '../../stores/useSettingsStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useNodeConfigStore } from '../../stores/useNodeConfigStore'
import { useSessionStore } from '../../stores/useSessionStore'
import { useMasterDbStore } from '../../stores/useMasterDbStore'
import { useToast } from '../../composables/useToast'
import type { NodeRole } from '../../types/nodeConfig'

const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const nodeConfigStore = useNodeConfigStore()
const sessionStore = useSessionStore()
const masterDbStore = useMasterDbStore()
const toast = useToast()

const step = ref(1)
const selectedRole = ref<NodeRole>('STANDALONE_POS')
const notImplementedNotice = ref(false)

// Developer Form
const devForm = ref({
  name: 'Super Developer',
  username: 'dev',
  pin: '1234'
})

// Store Configuration
const storeForm = ref({
  storeName: settingsStore.storeName || 'Main Flagship Store',
  posMode: 'restaurant' as POSMode,
  db_storage_path: 'F:\\tempdb'
})

function selectDeploymentRole(role: NodeRole) {
  selectedRole.value = role
  if (role === 'BRANCH_SERVER' || role === 'LEAF_POS') {
    notImplementedNotice.value = true
  } else {
    notImplementedNotice.value = false
  }
}

async function handleSelectFolderInWizard() {
  if ((window as any).electronAPI && (window as any).electronAPI.openDirectoryDialog) {
    const selected = await (window as any).electronAPI.openDirectoryDialog()
    if (selected) {
      storeForm.value.db_storage_path = selected
      toast.success(`Selected DB Storage Folder: ${selected}`)
    }
  } else {
    toast.info('Directory picker is active in Electron desktop application mode.')
  }
}

async function handleNext() {
  if (selectedRole.value === 'BRANCH_SERVER' || selectedRole.value === 'LEAF_POS') {
    notImplementedNotice.value = true
    return
  }

  if (step.value === 1) {
    step.value = 2
  } else if (step.value === 2) {
    if (!storeForm.value.storeName || !storeForm.value.storeName.trim()) {
      toast.warning('Please enter a Store / Outlet Name.')
      return
    }
    step.value = 3
  } else if (step.value === 3) {
    if (!devForm.value.pin || !devForm.value.username || !devForm.value.name) {
      toast.warning('Please fill in Developer credentials and set a PIN code.')
      return
    }
    step.value = 4
  } else if (step.value === 4) {
    // 1. Save Settings & POS mode
    settingsStore.setMode(storeForm.value.posMode)
    settingsStore.setStoreName(storeForm.value.storeName.trim())

    // Reset session so store starts in clean closed status
    sessionStore.resetSessionState()
    sessionStore.cashierName = devForm.value.name

    // Store ONLY the single created terminal
    settingsStore.setSingleTerminal(storeForm.value.storeName.trim(), storeForm.value.posMode)

    // 2. Save Branch Hierarchy Nodes to DB
    try {
      if (masterDbStore.nodes.length >= 2) {
        await masterDbStore.updateNode(masterDbStore.nodes[0].node_id, { location_name: `${storeForm.value.storeName.trim()} HQ` })
        await masterDbStore.updateNode(masterDbStore.nodes[1].node_id, { location_name: `${storeForm.value.storeName.trim()} POS Terminal` })
      } else {
        await masterDbStore.addNode({ location_name: `${storeForm.value.storeName.trim()} HQ`, node_type: 'ROOT' })
        await masterDbStore.addNode({ location_name: `${storeForm.value.storeName.trim()} POS Terminal`, node_type: 'POS' })
      }
    } catch (e) {
      console.warn('Branch hierarchy node setup handled:', e)
    }

    // 3. Save / Update Developer Account
    try {
      await authStore.loadUsers()

      const devAccount = await authStore.addUser({
        username: devForm.value.username.trim(),
        name: devForm.value.name.trim(),
        pin: devForm.value.pin.trim(),
        role: 'DEVELOPER'
      })

      // Set logged-in Developer Account by default
      if (devAccount) {
        authStore.currentUser = devAccount
      }
      authStore.activeRole = 'DEVELOPER'
      authStore.isAuthenticated = true
    } catch (e) {
      console.warn('User account creation handled:', e)
    }

    // 4. Mark Setup as Completed
    nodeConfigStore.completeSetup('STANDALONE_POS', {
      branch_id: storeForm.value.storeName.trim(),
      pos_id: 'Register 1',
      db_storage_path: storeForm.value.db_storage_path
    })

    toast.success('POS System setup completed successfully!')
  }
}
</script>
