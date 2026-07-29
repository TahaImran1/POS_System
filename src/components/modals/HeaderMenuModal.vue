<script setup lang="ts">
import { useSessionStore } from '../../stores/useSessionStore'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close', 'action'])
const session = useSessionStore()

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
        <div class="flex items-center gap-2 font-bold">
          <i class="fas fa-bars"></i>
          <span>Odoo POS Menu</span>
        </div>
        <button @click="$emit('close')" class="text-gray-300 hover:text-white">
          <i class="fas fa-times text-base"></i>
        </button>
      </div>

      <!-- Options List -->
      <div class="p-3 divide-y divide-gray-100">
        <button @click="handleAction('create-product')" class="w-full text-left p-3 hover:bg-purple-50 flex items-center gap-3 text-sm font-bold text-[#714B67] rounded-lg border border-purple-100 mb-1">
          <i class="fas fa-plus-circle text-base"></i>
          <span>Create Product</span>
        </button>

        <button @click="handleAction('cash-in-out')" class="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 text-sm font-semibold text-gray-800 rounded-lg">
          <i class="fas fa-money-bill-wave text-emerald-600 text-base"></i>
          <span>Cash In / Out</span>
        </button>

        <button @click="handleAction('close-session')" class="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 text-sm font-semibold text-gray-800 rounded-lg">
          <i class="fas fa-lock text-purple-600 text-base"></i>
          <span>Close Session</span>
        </button>

        <button @click="handleAction('orders')" class="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 text-sm font-semibold text-gray-800 rounded-lg">
          <i class="fas fa-receipt text-indigo-600 text-base"></i>
          <span>Orders History</span>
        </button>

        <button @click="handleAction('settings')" class="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 text-sm font-semibold text-gray-800 rounded-lg">
          <i class="fas fa-cog text-gray-600 text-base"></i>
          <span>POS Settings</span>
        </button>
      </div>

      <!-- Footer Info -->
      <div class="p-3 bg-gray-50 text-xs text-gray-500 border-t border-gray-100 flex justify-between items-center">
        <span>Session ID: #{{ session.sessionId }}</span>
        <span>Cashier: {{ session.cashierName }}</span>
      </div>

    </div>
  </div>
</template>
