<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSessionStore } from '../../stores/useSessionStore'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close', 'session-closed'])
const sessionStore = useSessionStore()

const countedCash = ref<number | ''>(sessionStore.openingBalance + sessionStore.cashSalesTotal)

const expectedCash = computed(() => {
  return sessionStore.openingBalance + sessionStore.cashSalesTotal
})

const variance = computed(() => {
  const counted = Number(countedCash.value) || 0
  return counted - expectedCash.value
})

const handleConfirmClose = async () => {
  const finalCounted = Number(countedCash.value) || 0
  await sessionStore.closeSession(finalCounted)
  emit('session-closed')
  emit('close')
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4 backdrop-blur-xs">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      
      <!-- Modal Header matching Odoo Closing Control -->
      <div class="px-6 py-4 bg-[#714B67] text-white flex justify-between items-center">
        <div class="flex items-center gap-2 font-bold text-base">
          <i class="fas fa-lock"></i>
          <span>Closing Cash Control</span>
        </div>
        <button @click="$emit('close')" class="text-white/80 hover:text-white">
          <i class="fas fa-times text-base"></i>
        </button>
      </div>

      <!-- Content Area matching Odoo 1:1 -->
      <div class="p-6 space-y-4 bg-white text-xs text-gray-800">
        
        <!-- Summary Financial Breakdown -->
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-3.5 space-y-2 font-mono text-xs">
          <div class="flex justify-between text-gray-600">
            <span>Opening Cash Float</span>
            <span>{{ sessionStore.openingBalance.toFixed(2) }} Rs.</span>
          </div>

          <div class="flex justify-between text-gray-600">
            <span>+ Total Cash Sales</span>
            <span>{{ sessionStore.cashSalesTotal.toFixed(2) }} Rs.</span>
          </div>

          <div class="flex justify-between text-gray-900 font-bold border-t border-gray-200 pt-2 text-sm">
            <span>= Expected Cash in Drawer</span>
            <span>{{ expectedCash.toFixed(2) }} Rs.</span>
          </div>
        </div>

        <!-- Counted Cash Input -->
        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Actual Counted Cash (Rs.)</label>
          <input 
            v-model.number="countedCash" 
            type="number" 
            step="0.01"
            min="0"
            class="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#714B67]"
          />
        </div>

        <!-- Difference / Variance Alert Badge -->
        <div 
          :class="[
            'p-3 rounded-lg flex items-center justify-between font-bold text-xs border',
            variance === 0 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : variance > 0 
                ? 'bg-blue-50 border-blue-200 text-blue-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
          ]"
        >
          <span>Cash Difference / Variance</span>
          <span class="font-mono text-sm">
            {{ variance > 0 ? '+' : '' }}{{ variance.toFixed(2) }} Rs.
          </span>
        </div>

      </div>

      <!-- Footer Action Buttons matching Odoo -->
      <div class="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between gap-2">
        <button 
          @click="$emit('close')" 
          class="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded text-xs hover:bg-gray-100 transition-colors shadow-xs"
        >
          Keep Session Open
        </button>
        
        <button 
          @click="handleConfirmClose" 
          class="px-5 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded text-xs transition-colors shadow-sm flex items-center gap-1.5"
        >
          <i class="fas fa-power-off text-xs"></i>
          <span>Close Session</span>
        </button>
      </div>

    </div>
  </div>
</template>
