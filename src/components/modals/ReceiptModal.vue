<script setup lang="ts">
import { useSettingsStore } from '../../stores/useSettingsStore'

const props = defineProps<{
  show: boolean
  total: number
  tendered: number
  change: number
  method: string
  ticketName: string
}>()

const emit = defineEmits(['close'])
const settings = useSettingsStore()

const formatTime = () => {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
const formatDate = () => {
  return new Date().toLocaleDateString()
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Header -->
      <div class="bg-emerald-600 text-white p-6 flex flex-col items-center justify-center text-center">
        <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
          <i class="fas fa-check text-3xl"></i>
        </div>
        <h2 class="text-2xl font-bold mb-1">Payment Successful</h2>
        <p class="text-emerald-100">{{ method }} Payment Processed</p>
      </div>

      <!-- Receipt Mockup -->
      <div class="p-6 bg-gray-50 flex-1 relative">
        <!-- Jagged top border for receipt effect -->
        <div class="absolute top-0 left-0 right-0 h-2 bg-white" style="mask-image: radial-gradient(circle at 4px 0, transparent 4px, black 4px); mask-size: 8px 8px; mask-repeat: repeat-x;"></div>
        
        <div class="bg-white p-6 shadow-sm border border-gray-100 rounded text-center">
          <h3 class="font-bold text-lg mb-1">{{ settings.storeName }}</h3>
          <p class="text-xs text-gray-500 mb-4">{{ formatDate() }} {{ formatTime() }}</p>
          
          <div class="border-t border-dashed border-gray-300 my-4"></div>
          
          <div class="flex justify-between items-center text-sm mb-2">
            <span class="text-gray-600">Ticket / Table:</span>
            <span class="font-medium">{{ ticketName }}</span>
          </div>
          
          <div class="flex justify-between items-center text-lg font-bold my-4">
            <span>Total:</span>
            <span>Rs{{ total.toFixed(2) }}</span>
          </div>
          
          <div v-if="method === 'Cash'" class="border-t border-dashed border-gray-300 my-4"></div>
          
          <div v-if="method === 'Cash'" class="flex justify-between items-center text-sm text-gray-600 mb-1">
            <span>Tendered:</span>
            <span>Rs{{ tendered.toFixed(2) }}</span>
          </div>
          <div v-if="method === 'Cash'" class="flex justify-between items-center font-bold text-emerald-600 text-xl mt-2">
            <span>Change Due:</span>
            <span>Rs{{ change.toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="p-4 bg-white border-t border-gray-100 flex flex-col gap-3">
        <button class="w-full py-3 rounded-lg bg-gray-800 text-white font-bold hover:bg-gray-900 transition-colors flex items-center justify-center gap-2">
          <i class="fas fa-print"></i> Print Receipt
        </button>
        <button @click="$emit('close')" class="w-full py-3 rounded-lg border-2 border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-colors">
          Next Order
        </button>
      </div>

    </div>
  </div>
</template>
