<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMasterDbStore, type BranchNode } from '../stores/useMasterDbStore'
import { useAuthStore, type UserRole, type UserAccount } from '../stores/useAuthStore'


const masterDbStore = useMasterDbStore()
const authStore = useAuthStore()

const activeTab = ref<'connection' | 'users' | 'nodes' | 'diagnostics'>('connection')

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
    alert('Please complete all required fields.')
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
    alert('Please enter location name.')
    return
  }

  await masterDbStore.addNode({
    location_name: editingNode.value.location_name,
    node_type: editingNode.value.node_type as any,
    parent_node_id: editingNode.value.parent_node_id || null
  })

  showNodeModal.value = false
}

const handleDeleteNode = async (node_id: string) => {
  if (confirm('Are you sure you want to delete this branch node?')) {
    await masterDbStore.deleteNode(node_id)
  }
}
</script>

<template>
  <div class="h-full w-full bg-gray-100 flex flex-col font-sans overflow-hidden text-gray-800">
    <!-- Sub Header Bar -->
    <div class="bg-[#5a3a52] text-white px-6 py-3 flex justify-between items-center shrink-0 shadow-md">
      <div class="flex items-center gap-3">
        <i class="fas fa-tools text-amber-300 text-xl"></i>
        <div>
          <h2 class="font-bold text-lg leading-tight">Developer & System Admin Console</h2>
          <p class="text-xs text-amber-200/80">Manage VPS Master DB Connections, User Roles, and Branch Nodes</p>
        </div>
      </div>

      <!-- Quick Status -->
      <div class="flex items-center gap-4 text-xs">
        <div class="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/20">
          <span :class="[masterDbStore.connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-rose-400']" class="w-2.5 h-2.5 rounded-full animate-pulse"></span>
          <span class="font-medium">Master DB: {{ masterDbStore.connectionStatus.toUpperCase() }}</span>
        </div>
      </div>
    </div>

    <!-- Main Navigation Tabs -->
    <div class="bg-white border-b border-gray-200 px-6 flex gap-4 text-sm font-semibold shrink-0">
      <button 
        @click="activeTab = 'connection'" 
        :class="[activeTab === 'connection' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors"
      >
        <i class="fas fa-[#714B67] fa-server"></i>
        <span>Master DB Connection</span>
      </button>

      <button 
        @click="activeTab = 'users'" 
        :class="[activeTab === 'users' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors"
      >
        <i class="fas fa-users-cog"></i>
        <span>User Accounts & Roles</span>
      </button>

      <button 
        @click="activeTab = 'nodes'" 
        :class="[activeTab === 'nodes' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors"
      >
        <i class="fas fa-sitemap"></i>
        <span>Branch Node Hierarchy</span>
      </button>

      <button 
        @click="activeTab = 'diagnostics'" 
        :class="[activeTab === 'diagnostics' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors"
      >
        <i class="fas fa-stethoscope"></i>
        <span>Sync & Health</span>
      </button>
    </div>

    <!-- Content Panel -->
    <div class="flex-1 p-6 overflow-y-auto">

      <!-- TAB 1: MASTER DB CONNECTION -->
      <div v-if="activeTab === 'connection'" class="max-w-3xl bg-white p-6 rounded-xl shadow-xs border border-gray-200 space-y-6">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 class="font-bold text-base text-gray-900">VPS / Cloud Master DB Connection Settings</h3>
            <p class="text-xs text-gray-500">Configure remote server endpoints for Manager queries and daily Salesperson sync.</p>
          </div>
          <button @click="masterDbStore.testConnection()" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 rounded-lg flex items-center gap-1.5 transition-colors">
            <i class="fas fa-sync-alt"></i> Test Live Connection
          </button>
        </div>

        <div class="space-y-4 text-xs">
          <div>
            <label class="block font-bold text-gray-700 mb-1">Master DB Host REST API URL</label>
            <input v-model="dbUrl" type="text" placeholder="http://192.168.1.100:3000" class="w-full p-2.5 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-[#714B67] outline-none" />
            <p class="text-[11px] text-gray-400 mt-1">Example: http://192.168.1.50:3000 or https://masterpos.vpsserver.com</p>
          </div>

          <div>
            <label class="block font-bold text-gray-700 mb-1">WebSocket Live Sync Endpoint URL</label>
            <input v-model="wsUrl" type="text" placeholder="ws://192.168.1.100:3000/ws/sync" class="w-full p-2.5 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-[#714B67] outline-none" />
          </div>

          <div>
            <label class="block font-bold text-gray-700 mb-1">Master API Authorization Secret Key</label>
            <input v-model="apiKey" type="password" class="w-full p-2.5 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-[#714B67] outline-none" />
          </div>

          <div v-if="configMessage" class="p-3 rounded-lg text-xs font-semibold" :class="[masterDbStore.connectionStatus === 'connected' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200']">
            {{ configMessage }}
          </div>

          <button @click="handleSaveConfig" :disabled="isSavingConfig" class="px-5 py-2.5 bg-[#714B67] text-white font-bold rounded-lg text-xs hover:bg-[#5a3a52] transition-colors shadow-xs">
            Save & Connect Settings
          </button>
        </div>
      </div>

      <!-- TAB 2: USER ACCOUNTS & ROLES -->
      <div v-if="activeTab === 'users'" class="bg-white p-6 rounded-xl shadow-xs border border-gray-200 space-y-4">
        <div class="flex justify-between items-center border-b border-gray-100 pb-3">
          <div>
            <h3 class="font-bold text-base text-gray-900">User Accounts & Role Permissions</h3>
            <p class="text-xs text-gray-500">Create system accounts and define access levels (Developer, Manager, Salesperson).</p>
          </div>
          <button @click="handleOpenCreateUser" class="px-4 py-2 bg-[#714B67] text-white text-xs font-bold rounded-lg hover:bg-[#5a3a52] flex items-center gap-1.5 shadow-xs transition-colors">
            <i class="fas fa-user-plus"></i> Add New User
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                <th class="p-3">User Name</th>
                <th class="p-3">Username</th>
                <th class="p-3">Role</th>
                <th class="p-3">PIN Code</th>
                <th class="p-3">Assigned Node</th>
                <th class="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="user in authStore.users" :key="user.user_id" class="hover:bg-gray-50/80">
                <td class="p-3 font-semibold text-gray-900">{{ user.name }}</td>
                <td class="p-3 font-mono text-gray-600">{{ user.username }}</td>
                <td class="p-3">
                  <span 
                    :class="[
                      user.role === 'DEVELOPER' ? 'bg-purple-100 text-purple-800' : 
                      user.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                    ]" 
                    class="px-2 py-0.5 rounded-full text-[11px] font-bold"
                  >
                    {{ user.role }}
                  </span>
                </td>
                <td class="p-3 font-mono text-gray-800 font-bold">{{ user.pin }}</td>
                <td class="p-3 text-gray-600">
                  {{ masterDbStore.nodes.find(n => n.node_id === user.node_id)?.location_name || 'Global / All Nodes' }}
                </td>
                <td class="p-3 text-right space-x-2">
                  <button @click="handleDeleteUser(user.user_id)" class="text-red-500 hover:text-red-700 font-semibold text-xs">
                    <i class="fas fa-trash"></i> Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 3: BRANCH NODE HIERARCHY -->
      <div v-if="activeTab === 'nodes'" class="bg-white p-6 rounded-xl shadow-xs border border-gray-200 space-y-4">
        <div class="flex justify-between items-center border-b border-gray-100 pb-3">
          <div>
            <h3 class="font-bold text-base text-gray-900">Branch Node Hierarchy</h3>
            <p class="text-xs text-gray-500">Define multi-branch store organization (ROOT, REGION, CITY, BRANCH, POS).</p>
          </div>
          <button @click="handleOpenCreateNode" class="px-4 py-2 bg-[#714B67] text-white text-xs font-bold rounded-lg hover:bg-[#5a3a52] flex items-center gap-1.5 shadow-xs transition-colors">
            <i class="fas fa-plus"></i> Add Branch Node
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="node in masterDbStore.nodes" :key="node.node_id" class="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between hover:border-[#714B67] transition-all">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-gray-200 text-gray-700">
                  {{ node.node_type }}
                </span>
                <button @click="handleDeleteNode(node.node_id)" class="text-gray-400 hover:text-red-600 text-xs">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
              <h4 class="font-bold text-sm text-gray-900 mb-1">{{ node.location_name }}</h4>
              <p class="text-[11px] text-gray-500 font-mono">Node ID: {{ node.node_id.substring(0, 13) }}...</p>
            </div>
            <div class="mt-3 pt-2 border-t border-gray-200/60 text-[11px] text-gray-600 flex justify-between">
              <span>Parent Node:</span>
              <span class="font-semibold text-gray-800">
                {{ masterDbStore.nodes.find(n => n.node_id === node.parent_node_id)?.location_name || 'None (ROOT)' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 4: DIAGNOSTICS & SYNC -->
      <div v-if="activeTab === 'diagnostics'" class="bg-white p-6 rounded-xl shadow-xs border border-gray-200 space-y-4">
        <h3 class="font-bold text-base text-gray-900 border-b border-gray-100 pb-2">Sync Engine Health & System Diagnostics</h3>
        <div class="grid grid-cols-3 gap-4 text-xs">
          <div class="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <div class="text-gray-500 font-medium">Local SQLite Database</div>
            <div class="text-lg font-bold text-emerald-600 mt-1">OPERATIONAL</div>
            <div class="text-[11px] text-gray-400 mt-1">Drizzle ORM over SQLite WASM</div>
          </div>

          <div class="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <div class="text-gray-500 font-medium">Master DB VPS Link</div>
            <div class="text-lg font-bold mt-1" :class="[masterDbStore.connectionStatus === 'connected' ? 'text-emerald-600' : 'text-amber-600']">
              {{ masterDbStore.connectionStatus.toUpperCase() }}
            </div>
            <div class="text-[11px] text-gray-400 mt-1">Host: {{ masterDbStore.masterDbUrl }}</div>
          </div>

          <div class="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <div class="text-gray-500 font-medium">WebSocket Sync Worker</div>
            <div class="text-lg font-bold text-indigo-600 mt-1">LISTENING</div>
            <div class="text-[11px] text-gray-400 mt-1">{{ masterDbStore.wsSyncUrl }}</div>
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
          <div>
            <label class="block font-bold text-gray-700 mb-1">Assign Branch Node</label>
            <select v-model="editingUser.node_id" class="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#714B67]">
              <option v-for="node in masterDbStore.nodes" :key="node.node_id" :value="node.node_id">
                {{ node.location_name }} ({{ node.node_type }})
              </option>
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
          <div>
            <label class="block font-bold text-gray-700 mb-1">Parent Node</label>
            <select v-model="editingNode.parent_node_id" class="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#714B67]">
              <option value="">None (Top Level Root)</option>
              <option v-for="node in masterDbStore.nodes" :key="node.node_id" :value="node.node_id">
                {{ node.location_name }} ({{ node.node_type }})
              </option>
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
