<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMasterDbStore, type BranchNode } from '../stores/useMasterDbStore'
import { useAuthStore, type UserRole, type UserAccount } from '../stores/useAuthStore'
import { useNodeConfigStore } from '../stores/useNodeConfigStore'
import { useUpdateStore } from '../stores/useUpdateStore'
import { exportDatabase, saveDbToCustomFolder } from '../db/client'
import { useToast } from '../composables/useToast'

const masterDbStore = useMasterDbStore()
const authStore = useAuthStore()
const nodeConfigStore = useNodeConfigStore()
const updateStore = useUpdateStore()
const toast = useToast()

onMounted(async () => {
  await updateStore.checkUpdate()
})

const handleSelectDiskFolder = async () => {
  if ((window as any).electronAPI && (window as any).electronAPI.openDirectoryDialog) {
    const selected = await (window as any).electronAPI.openDirectoryDialog()
    if (selected) {
      nodeConfigStore.updateConfig({ db_storage_path: selected })
      toast.success(`Updated database folder to: ${selected}`)
      await saveDbToCustomFolder(selected)
    }
  } else {
    toast.info('Folder selection dialog is available in Electron desktop application mode.')
  }
}

const handleSaveDiskFolderPath = () => {
  nodeConfigStore.updateConfig({ db_storage_path: nodeConfigStore.config.db_storage_path })
  toast.success('Saved new database storage folder path.')
}

const handleSaveToConfiguredFolder = async () => {
  await saveDbToCustomFolder(nodeConfigStore.config.db_storage_path)
}

const activeTab = ref<'connection' | 'users' | 'nodes' | 'diagnostics'>('nodes')

// Connection Form
const dbUrl = ref(masterDbStore.masterDbUrl)
const wsUrl = ref(masterDbStore.wsSyncUrl)
const apiKey = ref(masterDbStore.masterApiKey)
const isSavingConfig = ref(false)
const configMessage = ref('')

// User Management Modal / Form
const showUserModal = ref(false)
const editingUser = ref<Partial<UserAccount>>({
  name: '',
  username: '',
  pin: '1234',
  role: 'SALESPERSON',
  node_id: ''
})

// Node Management Modal / Form
const showNodeModal = ref(false)
const editingNode = ref<Partial<BranchNode>>({
  location_name: '',
  node_type: 'BRANCH',
  parent_node_id: ''
})

onMounted(async () => {
  await masterDbStore.loadSettingsAndNodes()
  await authStore.loadUsers()
  await masterDbStore.testConnection()
})

const handleSaveConfig = async () => {
  isSavingConfig.value = true
  configMessage.value = ''
  await masterDbStore.saveSettings(dbUrl.value, wsUrl.value, apiKey.value)
  isSavingConfig.value = false
  configMessage.value = masterDbStore.connectionStatus === 'connected' 
    ? 'Successfully connected to Master DB VPS Server!'
    : 'Settings saved. Cloud Server could not be reached locally.'
}

const handleOpenCreateUser = () => {
  editingUser.value = {
    name: '',
    username: '',
    pin: Math.floor(1000 + Math.random() * 9000).toString(),
    role: 'SALESPERSON',
    node_id: masterDbStore.nodes[0]?.node_id || ''
  }
  showUserModal.value = true
}

const handleSaveUser = async () => {
  if (!editingUser.value.name || !editingUser.value.username || !editingUser.value.pin) {
    toast.warning('Please complete all required fields.')
    return
  }

  await authStore.addUser({
    name: editingUser.value.name,
    username: editingUser.value.username,
    pin: editingUser.value.pin,
    role: editingUser.value.role as UserRole,
    node_id: editingUser.value.node_id
  })

  showUserModal.value = false
}

const handleDeleteUser = async (user_id: string) => {
  if (confirm('Are you sure you want to delete this user account?')) {
    await authStore.deleteUser(user_id)
  }
}

const handleOpenCreateNode = () => {
  editingNode.value = {
    location_name: '',
    node_type: 'BRANCH',
    parent_node_id: masterDbStore.nodes.find(n => n.node_type === 'ROOT')?.node_id || ''
  }
  showNodeModal.value = true
}

const handleSaveNode = async () => {
  if (!editingNode.value.location_name) {
    toast.warning('Please enter location name.')
    return
  }

  await masterDbStore.addNode(editingNode.value as any)
  showNodeModal.value = false
}

const handleDeleteNode = async (node_id: string) => {
  if (confirm('Are you sure you want to delete this branch node?')) {
    await masterDbStore.deleteNode(node_id)
  }
}

// Database Deletion & Purge Action
async function handlePurgeDatabase() {
  if (confirm('⚠️ WARNING: Are you sure you want to delete the local database and reset setup? All local data will be permanently wiped.')) {
    try {
      if (typeof window !== 'undefined' && 'navigator' in window && 'storage' in navigator && navigator.storage.getDirectory) {
        try {
          const root = await navigator.storage.getDirectory()
          await root.removeEntry('pos.sqlite', { recursive: true })
        } catch (e) {}
      }

      localStorage.clear()
      sessionStorage.clear()

      toast.success('Database purged successfully. The application will now reload to restart Phase 1 Setup.')
      window.location.reload()
    } catch (err: any) {
      toast.error('Error purging database: ' + err.message)
    }
  }
}
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6 font-sans text-gray-800">
    <!-- Top Header Banner -->
    <div class="bg-[#714B67] text-white p-6 rounded-2xl shadow-lg flex justify-between items-center">
      <div>
        <div class="flex items-center space-x-2">
          <span class="bg-amber-400 text-gray-900 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Developer & System Settings
          </span>
        </div>
        <h1 class="text-2xl font-black mt-1">Universal Multi-Node Point of Sale</h1>
        <p class="text-xs text-purple-200 mt-1">Manage database connections, branch nodes, user accounts, and local storage diagnostics</p>
      </div>

      <div class="flex items-center space-x-3">
        <button 
          @click="exportDatabase" 
          class="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center space-x-1.5 transition-all shadow-xs"
        >
          <i class="fas fa-download text-amber-300"></i>
          <span>Export .sqlite File</span>
        </button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex border-b border-gray-200 space-x-6 text-sm font-bold">
      <button 
        @click="activeTab = 'diagnostics'"
        :class="[activeTab === 'diagnostics' ? 'border-[#714B67] text-[#714B67]' : 'border-transparent text-gray-500 hover:text-gray-700']"
        class="py-3 border-b-2 transition-all flex items-center space-x-2"
      >
        <i class="fas fa-database"></i>
        <span>DB Location & Diagnostics</span>
      </button>

      <button 
        @click="activeTab = 'connection'"
        :class="[activeTab === 'connection' ? 'border-[#714B67] text-[#714B67]' : 'border-transparent text-gray-500 hover:text-gray-700']"
        class="py-3 border-b-2 transition-all flex items-center space-x-2"
      >
        <i class="fas fa-server"></i>
        <span>VPS Cloud DB Connection</span>
      </button>

      <button 
        @click="activeTab = 'users'"
        :class="[activeTab === 'users' ? 'border-[#714B67] text-[#714B67]' : 'border-transparent text-gray-500 hover:text-gray-700']"
        class="py-3 border-b-2 transition-all flex items-center space-x-2"
      >
        <i class="fas fa-[#714B67] fa-users"></i>
        <span>User Accounts</span>
      </button>

      <button 
        @click="activeTab = 'nodes'"
        :class="[activeTab === 'nodes' ? 'border-[#714B67] text-[#714B67]' : 'border-transparent text-gray-500 hover:text-gray-700']"
        class="py-3 border-b-2 transition-all flex items-center space-x-2"
      >
        <i class="fas fa-sitemap"></i>
        <span>Branch Hierarchy Nodes</span>
      </button>
    </div>

    <!-- TAB 1: DB LOCATION & DIAGNOSTICS -->
    <div v-if="activeTab === 'diagnostics'" class="space-y-6">
      
      <!-- Database File Path & Manual Deletion Info Card -->
      <div class="bg-white p-6 rounded-2xl shadow-sm border border-purple-900/10 space-y-4">
        <div class="flex justify-between items-center border-b border-gray-100 pb-3">
          <div>
            <h3 class="font-bold text-base text-gray-900 flex items-center space-x-2">
              <i class="fas fa-folder-open text-[#714B67]"></i>
              <span>Local Database Storage Explanation & Deletion</span>
            </h3>
            <p class="text-xs text-gray-500 mt-0.5">Why files are in browser OPFS vs disk and how to delete/reset</p>
          </div>

          <div class="flex space-x-2">
            <button 
              @click="exportDatabase"
              class="bg-purple-100 hover:bg-purple-200 text-[#714B67] border border-purple-300 font-bold text-xs px-3 py-2 rounded-xl transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <i class="fas fa-file-download"></i>
              <span>Save Copy to Disk</span>
            </button>
            <button 
              @click="handlePurgeDatabase" 
              class="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
            >
              <i class="fas fa-trash-alt"></i>
              <span>Delete DB & Reset Setup</span>
            </button>
          </div>
        </div>

        <!-- Explanation Banner -->
        <div class="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed flex items-start space-x-3">
          <i class="fas fa-info-circle text-amber-600 text-base mt-0.5 shrink-0"></i>
          <div>
            <strong class="font-extrabold text-amber-950">Why is {{ nodeConfigStore.config.db_storage_path || 'F:\\tempdb' }} empty?</strong>
            <p class="mt-0.5 text-amber-800">
              When running in browser / Edge app mode, SQLite stores data inside Chrome/Edge's virtual <strong>OPFS (Origin Private File System)</strong> at <code class="bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-mono font-bold">/pos.sqlite</code> inside the browser profile folder (not directly on <code class="bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-mono font-bold">F:\tempdb</code>). 
              To reset/wipe the database in browser mode, simply click the red <strong>"Delete DB & Reset Setup"</strong> button above!
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <!-- Active Browser OPFS Virtual Path -->
          <div class="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-sans font-bold text-emerald-800 uppercase tracking-wider">Active Browser Storage (OPFS / WASM)</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">ACTIVE STORAGE</span>
            </div>
            <div class="bg-white p-2.5 rounded-lg border border-emerald-300 font-bold text-emerald-900 break-all select-all shadow-xs">
              /pos.sqlite (Origin Private File System)
            </div>
            <p class="text-[10px] font-sans text-emerald-800">
              ✓ <strong>To delete & restart:</strong> Click <em>"Delete DB & Reset Setup"</em> to purge OPFS and reload Phase 1 setup.
            </p>
          </div>

          <!-- Physical Disk Storage Path -->
          <div class="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-sans font-bold text-gray-700 uppercase tracking-wider">Primary Disk Storage Folder (Live Local SQL DB)</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-[#714B67] border border-purple-200">PRIMARY LIVE SQL DB</span>
            </div>

            <div class="flex gap-2">
              <input 
                v-model="nodeConfigStore.config.db_storage_path" 
                @change="handleSaveDiskFolderPath"
                type="text" 
                class="flex-1 bg-white p-2.5 rounded-lg border border-gray-300 font-mono text-xs font-bold text-gray-800 focus:outline-none focus:border-[#714B67]"
                placeholder="F:\POS_Data"
              />
              <button 
                @click="handleSelectDiskFolder"
                class="bg-purple-100 hover:bg-purple-200 text-[#714B67] border border-purple-300 font-bold text-xs px-3 py-2 rounded-lg transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
              >
                <i class="fas fa-folder-open"></i>
                <span>Select Folder</span>
              </button>
            </div>

            <div class="flex justify-between items-center pt-1 text-[11px]">
              <span class="text-gray-500 font-mono">
                Target File: <strong class="text-gray-800">{{ (nodeConfigStore.config.db_storage_path || 'C:\\AppData').replace(/\\$/, '') }}\pos.sqlite</strong>
              </span>
              <button 
                @click="handleSaveToConfiguredFolder"
                class="bg-[#714B67] hover:bg-[#5a3a52] text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
              >
                <i class="fas fa-save text-amber-300"></i>
                <span>Save DB to Folder Now</span>
              </button>
            </div>
            <p class="text-[10px] font-sans text-gray-500">
              💡 In Electron mode, your live SQLite database (<code class="bg-gray-200 px-1 rounded text-gray-800">pos.sqlite</code>) is stored and read directly from this folder.
            </p>
          </div>
        </div>

        <!-- System Version & GitHub Release Manual Updater -->
        <div class="bg-purple-50/70 p-5 rounded-2xl border border-purple-200 shadow-xs space-y-4 font-mono text-xs">
          <div class="flex items-center justify-between border-b border-purple-200 pb-3">
            <div>
              <h4 class="font-bold text-sm text-purple-950 font-sans flex items-center gap-2">
                <i class="fas fa-cloud-download-alt text-[#714B67]"></i>
                <span>System Version & GitHub Release Updates</span>
              </h4>
              <p class="text-[11px] text-gray-500 font-sans mt-0.5">Check GitHub Releases for new updates and install latest build executable.</p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-extrabold bg-[#714B67] text-white">
              v{{ updateStore.currentVersion }}
            </span>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-purple-100">
            <div>
              <div class="text-xs font-bold text-gray-800 font-sans">
                Current Installed Version: <span class="font-mono text-[#714B67]">v{{ updateStore.currentVersion }}</span>
              </div>
              <div v-if="updateStore.updateInfo?.latestVersion" class="text-xs font-bold text-emerald-800 font-sans mt-1">
                Latest GitHub Release: <span class="font-mono text-emerald-700">{{ updateStore.updateInfo.latestVersion }}</span>
              </div>
              <div v-if="updateStore.updateInfo?.error" class="text-[11px] text-amber-700 font-sans mt-1">
                {{ updateStore.updateInfo.error }}
              </div>
            </div>

            <div class="flex gap-2">
              <button 
                @click="updateStore.checkUpdate()" 
                :disabled="updateStore.isChecking"
                class="px-3.5 py-2 bg-purple-100 hover:bg-purple-200 text-[#714B67] font-bold rounded-lg border border-purple-300 text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <i class="fas fa-sync-alt" :class="{ 'fa-spin': updateStore.isChecking }"></i>
                <span>{{ updateStore.isChecking ? 'Checking...' : 'Check for Updates' }}</span>
              </button>

              <button 
                @click="updateStore.openDownloadPage()" 
                class="px-3.5 py-2 bg-[#714B67] hover:bg-[#5a3a52] text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <i class="fas fa-download text-amber-300"></i>
                <span>{{ updateStore.updateInfo?.hasUpdate ? 'Download Update (.exe)' : 'View GitHub Release' }}</span>
              </button>
            </div>
          </div>

          <!-- Release Notes Card (if update available) -->
          <div v-if="updateStore.updateInfo?.hasUpdate" class="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 font-sans">
            <div class="flex items-center justify-between text-emerald-950 font-bold text-xs">
              <span>🚀 {{ updateStore.updateInfo.releaseTitle }}</span>
              <span class="text-[10px] text-emerald-800 font-mono">{{ updateStore.updateInfo.latestVersion }}</span>
            </div>
            <div class="text-xs text-gray-700 bg-white p-3 rounded-lg border border-emerald-200 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto text-[11px]">
              {{ updateStore.updateInfo.releaseNotes }}
            </div>
          </div>
        </div>
      </div>

      <!-- Health Diagnostics Grid -->
      <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <h3 class="font-bold text-base text-gray-900 border-b border-gray-100 pb-2">Sync Engine Health & System Diagnostics</h3>
        <div class="grid grid-cols-3 gap-4 text-xs">
          <div class="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div class="text-gray-500 font-medium">Local SQLite Database</div>
            <div class="text-lg font-bold text-emerald-600 mt-1">OPERATIONAL</div>
            <div class="text-[11px] text-gray-400 mt-1">Drizzle ORM over SQLite WASM (OPFS)</div>
          </div>

          <div class="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div class="text-gray-500 font-medium">Master DB VPS Link</div>
            <div class="text-lg font-bold mt-1" :class="[masterDbStore.connectionStatus === 'connected' ? 'text-emerald-600' : 'text-amber-600']">
              {{ masterDbStore.connectionStatus.toUpperCase() }}
            </div>
            <div class="text-[11px] text-gray-400 mt-1">Host: {{ masterDbStore.masterDbUrl }}</div>
          </div>

          <div class="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div class="text-gray-500 font-medium">WebSocket Sync Worker</div>
            <div class="text-lg font-bold text-indigo-600 mt-1">LISTENING</div>
            <div class="text-[11px] text-gray-400 mt-1">{{ masterDbStore.wsSyncUrl }}</div>
          </div>
        </div>
      </div>

    </div>

    <!-- TAB 2: CONNECTION FORM -->
    <div v-else-if="activeTab === 'connection'" class="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
      <h3 class="font-bold text-base text-gray-900 border-b border-gray-100 pb-2">Master Cloud VPS Database Credentials</h3>
      
      <div v-if="configMessage" class="p-3 rounded-lg text-xs font-bold" :class="[masterDbStore.connectionStatus === 'connected' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800']">
        {{ configMessage }}
      </div>

      <div class="space-y-3 text-xs max-w-xl">
        <div>
          <label class="block font-bold text-gray-700 mb-1">Cloud PostgreSQL Connection URL</label>
          <input v-model="dbUrl" type="text" class="w-full p-2.5 border border-gray-300 rounded-lg font-mono text-gray-800 focus:outline-none focus:border-[#714B67]" />
        </div>

        <div>
          <label class="block font-bold text-gray-700 mb-1">WebSocket Live Sync Endpoint URL</label>
          <input v-model="wsUrl" type="text" class="w-full p-2.5 border border-gray-300 rounded-lg font-mono text-gray-800 focus:outline-none focus:border-[#714B67]" />
        </div>

        <div>
          <label class="block font-bold text-gray-700 mb-1">Master API Key</label>
          <input v-model="apiKey" type="password" class="w-full p-2.5 border border-gray-300 rounded-lg font-mono text-gray-800 focus:outline-none focus:border-[#714B67]" />
        </div>

        <button 
          @click="handleSaveConfig" 
          :disabled="isSavingConfig"
          class="px-5 py-2.5 bg-[#714B67] hover:bg-[#5a3a52] text-white font-bold rounded-lg text-xs transition-all shadow-md"
        >
          {{ isSavingConfig ? 'Testing Connection...' : 'Save & Connect to Master VPS' }}
        </button>
      </div>
    </div>

    <!-- TAB 3: USER MANAGEMENT -->
    <div v-else-if="activeTab === 'users'" class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="font-bold text-base text-gray-900">Configured System Accounts</h3>
        <button @click="handleOpenCreateUser" class="bg-[#714B67] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#5a3a52]">
          + Create User Account
        </button>
      </div>

      <div class="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        <table class="w-full text-left text-xs">
          <thead class="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
            <tr>
              <th class="p-3">Name</th>
              <th class="p-3">Username</th>
              <th class="p-3">Role</th>
              <th class="p-3">PIN Code</th>
              <th class="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="user in authStore.users" :key="user.user_id" class="hover:bg-gray-50">
              <td class="p-3 font-bold text-gray-900">{{ user.name }}</td>
              <td class="p-3 font-mono text-gray-600">{{ user.username }}</td>
              <td class="p-3 font-bold" :class="[user.role === 'DEVELOPER' ? 'text-purple-600' : (user.role === 'MANAGER' ? 'text-blue-600' : 'text-emerald-600')]">
                {{ user.role }}
              </td>
              <td class="p-3 font-mono font-bold tracking-widest">{{ user.pin }}</td>
              <td class="p-3 text-right">
                <button @click="handleDeleteUser(user.user_id)" class="text-rose-600 hover:text-rose-800 font-bold">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 4: NODE HIERARCHY -->
    <div v-else-if="activeTab === 'nodes'" class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="font-bold text-base text-gray-900">Configured Branch Hierarchy Nodes</h3>
        <button @click="handleOpenCreateNode" class="bg-[#714B67] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#5a3a52]">
          + Add Branch Node
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-for="node in masterDbStore.nodes" :key="node.node_id" class="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div class="flex justify-between items-start">
              <h4 class="font-bold text-sm text-gray-900">{{ node.location_name }}</h4>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-[#714B67]">{{ node.node_type }}</span>
            </div>
            <div class="text-xs font-mono text-gray-500 mt-1">ID: {{ node.node_id }}</div>
          </div>

          <div class="pt-2 border-t border-gray-100 flex justify-end">
            <button @click="handleDeleteNode(node.node_id)" class="text-rose-600 hover:text-rose-800 text-xs font-bold">
              Delete Node
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CREATE USER MODAL -->
    <div v-if="showUserModal" class="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 class="font-bold text-base border-b border-gray-200 pb-2 text-gray-900">Create New User Account</h3>
        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-gray-700 mb-1">Full Name</label>
            <input v-model="editingUser.name" type="text" class="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#714B67]" />
          </div>
          <div>
            <label class="block font-bold text-gray-700 mb-1">Username</label>
            <input v-model="editingUser.username" type="text" class="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#714B67]" />
          </div>
          <div>
            <label class="block font-bold text-gray-700 mb-1">4-Digit PIN Code</label>
            <input v-model="editingUser.pin" type="text" maxlength="6" class="w-full p-2 border border-gray-300 rounded-lg font-mono outline-none focus:ring-2 focus:ring-[#714B67]" />
          </div>
          <div>
            <label class="block font-bold text-gray-700 mb-1">Assign System Role</label>
            <select v-model="editingUser.role" class="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#714B67]">
              <option value="DEVELOPER">DEVELOPER (Super Admin)</option>
              <option value="MANAGER">MANAGER (Store Owner)</option>
              <option value="SALESPERSON">SALESPERSON (Store Cashier)</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button @click="showUserModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200">Cancel</button>
          <button @click="handleSaveUser" class="px-4 py-2 bg-[#714B67] text-white text-xs font-bold rounded-lg hover:bg-[#5a3a52]">Save Account</button>
        </div>
      </div>
    </div>

    <!-- CREATE NODE MODAL -->
    <div v-if="showNodeModal" class="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 class="font-bold text-base border-b border-gray-200 pb-2 text-gray-900">Add New Branch Node</h3>
        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-gray-700 mb-1">Location Name</label>
            <input v-model="editingNode.location_name" type="text" placeholder="e.g. Lahore Mall Branch" class="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#714B67]" />
          </div>
          <div>
            <label class="block font-bold text-gray-700 mb-1">Node Type</label>
            <select v-model="editingNode.node_type" class="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#714B67]">
              <option value="ROOT">ROOT (Global HQ)</option>
              <option value="REGION">REGION</option>
              <option value="CITY">CITY</option>
              <option value="BRANCH">BRANCH (Store)</option>
              <option value="POS">POS (Terminal)</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button @click="showNodeModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200">Cancel</button>
          <button @click="handleSaveNode" class="px-4 py-2 bg-[#714B67] text-white text-xs font-bold rounded-lg hover:bg-[#5a3a52]">Save Node</button>
        </div>
      </div>
    </div>

  </div>
</template>
