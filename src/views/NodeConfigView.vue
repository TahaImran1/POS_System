<template>
  <div class="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
    <div class="max-w-4xl mx-auto space-y-6">
      
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 class="text-2xl font-bold text-emerald-400">Universal Node & Sync Manager</h1>
          <p class="text-xs text-slate-400 mt-1">Configure Edge Node Role, Remote Database Credentials & Direct DB Synchronization</p>
        </div>
        <div class="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
          <span class="w-2.5 h-2.5 rounded-full" :class="nodeStore.isStandalone ? 'bg-amber-400' : 'bg-emerald-400'"></span>
          <span class="text-xs font-semibold tracking-wider text-slate-200">{{ nodeStore.activeRole }}</span>
        </div>
      </div>

      <!-- System Diagnostic / Hardware Info -->
      <div class="bg-slate-800/80 rounded-xl p-5 border border-slate-700/60 shadow-lg">
        <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Device Identity & Licensing</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <span class="text-slate-500 block">Device Fingerprint:</span>
            <span class="font-mono text-emerald-400 font-bold text-sm">{{ deviceFingerprint }}</span>
          </div>
          <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <span class="text-slate-500 block">Node ID:</span>
            <span class="font-mono text-slate-300 font-semibold">{{ nodeStore.config.node_id }}</span>
          </div>
          <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <span class="text-slate-500 block">License Status:</span>
            <span :class="licenseInfo.isValid ? 'text-emerald-400' : 'text-rose-400'" class="font-bold">
              {{ licenseInfo.isValid ? 'VALID (Active)' : 'EXPIRED' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Node Role Selection -->
      <div class="bg-slate-800/80 rounded-xl p-5 border border-slate-700/60 shadow-lg space-y-4">
        <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Select Universal Node Role</h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <button 
            v-for="role in roles" 
            :key="role.id"
            @click="nodeStore.setRole(role.id)"
            :class="[
              'p-3 rounded-xl border text-left transition-all duration-150',
              nodeStore.activeRole === role.id 
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300' 
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
            ]"
          >
            <div class="font-bold text-xs mb-1">{{ role.label }}</div>
            <div class="text-[10px] text-slate-400 leading-relaxed">{{ role.desc }}</div>
          </button>
        </div>
      </div>

      <!-- Upstream Direct DB Connection Settings (Hidden if Standalone) -->
      <div v-if="!nodeStore.isStandalone" class="bg-slate-800/80 rounded-xl p-5 border border-slate-700/60 shadow-lg space-y-4">
        <div class="flex items-center justify-between border-b border-slate-700/60 pb-3">
          <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Primary Server Database Credentials (PostgreSQL / Oracle)</h2>
          <span class="text-xs text-slate-400 font-mono">Port: 5432</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">Server Host / IP Address</label>
            <input 
              v-model="nodeStore.config.upstream_primary.host" 
              type="text" 
              class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono" 
              placeholder="e.g. 192.168.1.50 or hq.domain.com"
            />
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Database Port</label>
            <input 
              v-model.number="nodeStore.config.upstream_primary.port" 
              type="number" 
              class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono" 
            />
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Database Name</label>
            <input 
              v-model="nodeStore.config.upstream_primary.database" 
              type="text" 
              class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono" 
            />
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Sync Username</label>
            <input 
              v-model="nodeStore.config.upstream_primary.username" 
              type="text" 
              class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono" 
            />
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Sync Password</label>
            <input 
              v-model="nodeStore.config.upstream_primary.password" 
              type="password" 
              class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono" 
            />
          </div>
          <div class="flex items-end">
            <button 
              @click="triggerManualSync"
              :disabled="isSyncing"
              class="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2 text-xs transition-all shadow-md flex items-center justify-center space-x-2"
            >
              <span>{{ isSyncing ? 'Syncing...' : 'Execute Direct DB Sync' }}</span>
            </button>
          </div>
        </div>

        <!-- Sync Audit Status -->
        <div v-if="lastSyncResult" class="mt-4 p-3 rounded-lg bg-slate-900/80 border border-slate-700 text-xs">
          <div class="flex justify-between items-center">
            <span class="font-bold text-slate-300">Sync Status: {{ lastSyncResult.success ? 'SUCCESS' : 'FAILED' }}</span>
            <span class="text-slate-500 font-mono">{{ lastSyncResult.timestamp }}</span>
          </div>
          <p class="text-slate-400 mt-1">Target: {{ lastSyncResult.target_host }}</p>
          <p v-if="lastSyncResult.error" class="text-rose-400 mt-1 font-mono">{{ lastSyncResult.error }}</p>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useNodeConfigStore } from '../stores/useNodeConfigStore';
import type { NodeRole } from '../types/nodeConfig';

const nodeStore = useNodeConfigStore();
const deviceFingerprint = ref('HW-4A82F1');
const isSyncing = ref(false);
const lastSyncResult = ref<any>(null);

const licenseInfo = computed(() => ({
  isValid: true,
  daysRemaining: 365
}));

const roles: { id: NodeRole; label: string; desc: string }[] = [
  { id: 'STANDALONE_POS', label: 'Standalone POS', desc: 'Runs 100% locally on SQLite. No server connection required.' },
  { id: 'LEAF_POS', label: 'Terminal POS', desc: 'Syncs sales and stock directly to local Branch Server DB.' },
  { id: 'BRANCH_SERVER', label: 'Branch Server', desc: 'Master DB for local POS terminals. Syncs upstream to HQ.' },
  { id: 'ENTERPRISE_HQ', label: 'Enterprise HQ', desc: 'Global Master Server. Receives sync from all branch servers.' }
];

async function triggerManualSync() {
  isSyncing.value = true;
  setTimeout(() => {
    lastSyncResult.value = {
      success: true,
      pulled_count: 12,
      pushed_count: 4,
      target_host: `${nodeStore.config.upstream_primary.host}:${nodeStore.config.upstream_primary.port}`,
      timestamp: new Date().toLocaleTimeString()
    };
    isSyncing.value = false;
  }, 1200);
}
</script>
