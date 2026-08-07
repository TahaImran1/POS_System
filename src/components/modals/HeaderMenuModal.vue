<script setup lang="ts">
import { useSessionStore } from '../../stores/useSessionStore'
import { useAuthStore } from '../../stores/useAuthStore'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close', 'action', 'back-to-dashboard'])
const session = useSessionStore()
const authStore = useAuthStore()

const handleAction = (act: string) => {
  emit('action', act)
  emit('close')
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Header -->
      <div class="bg-[#714B67] text-white p-4 flex justify-between items-center">
        <div class="flex items-center gap-2 font-bold text-base">
          <span>Odoo POS Menu</span>
        </div>
        <button 
          @click="$emit('close')" 
          class="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          title="Close Menu"
        >
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Options List -->
      <div class="p-3 space-y-1">
        <!-- Back to Dashboard -->
        <button 
          @click="emit('back-to-dashboard'); emit('close')"
          class="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 text-sm font-semibold text-gray-700 rounded-lg border border-gray-100 cursor-pointer"
        >
          <i class="fas fa-arrow-left text-[#714B67] text-base"></i>
          <span>⬅ Back to Dashboard</span>
        </button>

        <button 
          v-if="authStore.hasManagerPrivileges"
          @click="handleAction('create-product')" 
          class="w-full text-left p-3 hover:bg-purple-50 flex items-center gap-3 text-sm font-bold text-[#714B67] rounded-lg border border-purple-100 cursor-pointer"
        >
          <i class="fas fa-plus-circle text-base"></i>
          <span>➕ Create Product</span>
        </button>

        <button @click="handleAction('cash-in-out')" class="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 text-sm font-semibold text-gray-800 rounded-lg cursor-pointer">
          <i class="fas fa-money-bill-wave text-emerald-600 text-base"></i>
          <span>💵 Cash In / Out</span>
        </button>

        <button @click="handleAction('close-session')" class="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 text-sm font-semibold text-gray-800 rounded-lg cursor-pointer">
          <i class="fas fa-lock text-purple-600 text-base"></i>
          <span>🔒 Close Session</span>
        </button>

        <button @click="handleAction('orders')" class="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 text-sm font-semibold text-gray-800 rounded-lg cursor-pointer">
          <i class="fas fa-receipt text-indigo-600 text-base"></i>
          <span>🧾 Orders History</span>
        </button>

        <button @click="handleAction('settings')" class="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 text-sm font-semibold text-gray-800 rounded-lg cursor-pointer">
          <i class="fas fa-cog text-gray-600 text-base"></i>
          <span>⚙️ POS Settings</span>
        </button>
      </div>

      <!-- Footer Info -->
      <div class="p-3 bg-gray-50 text-xs text-gray-500 border-t border-gray-100 flex justify-between items-center">
        <span class="truncate">Session: #{{ session.sessionId?.substr(0, 12) }}</span>
        <span>Cashier: {{ session.cashierName }}</span>
      </div>

    </div>
  </div>
</template>
