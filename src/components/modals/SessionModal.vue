<script setup lang="ts">
import { ref } from 'vue'
import { useSessionStore } from '../../stores/useSessionStore'

const emit = defineEmits(['back-to-dashboard'])
const session = useSessionStore()
const floatAmount = ref(1000)

const openSession = () => {
  session.openSession(floatAmount.value)
}

const handleBack = () => {
  emit('back-to-dashboard')
}
</script>

<template>
  <div v-if="!session.isOpen" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      
      <!-- Header with Back Button -->
      <div class="bg-[#714B67] text-white p-5 text-center relative">
        <button 
          @click="handleBack"
          class="absolute left-4 top-5 text-white/80 hover:text-white text-xs font-bold flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all border border-white/20"
          title="Return to POS Dashboard"
        >
          <i class="fas fa-arrow-left"></i>
          <span>Back</span>
        </button>

        <i class="fas fa-cash-register text-3xl mb-2 opacity-90 block mt-1"></i>
        <h2 class="text-xl font-bold">Open Cash Register</h2>
        <p class="text-white/70 text-xs mt-1 font-medium">Cashier: {{ session.cashierName }}</p>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Opening Float / Cash in Drawer</label>
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold font-mono">Rs</span>
            <input 
              type="number" 
              v-model="floatAmount"
              class="w-full bg-gray-50 border border-gray-300 focus:border-[#714B67] focus:ring-1 focus:ring-[#714B67] rounded-xl py-3 pl-12 pr-4 text-xl font-mono font-bold text-gray-900 outline-none transition-all"
            />
          </div>
          <p class="text-[11px] text-gray-500 mt-1">Specify initial float amount in cash drawer before launching register session.</p>
        </div>

        <div class="flex items-center gap-2 pt-2 border-t border-gray-100">
          <button 
            @click="handleBack"
            class="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl transition-colors text-sm border border-gray-300"
          >
            ← Back
          </button>

          <button 
            @click="openSession"
            class="w-2/3 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold py-3.5 rounded-xl shadow-md transition-colors text-base flex items-center justify-center gap-2 cursor-pointer"
          >
            <i class="fas fa-check-circle"></i>
            <span>Open Session</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
