<script setup lang="ts">
import { ref } from 'vue'
import { useSessionStore } from '../../stores/useSessionStore'

const session = useSessionStore()
const floatAmount = ref(1000)

const openSession = () => {
  session.openSession(floatAmount.value)
}
</script>

<template>
  <div v-if="!session.isOpen" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
      <!-- Header -->
      <div class="bg-[#714B67] text-white p-5 text-center">
        <i class="fas fa-lock text-3xl mb-3 opacity-90"></i>
        <h2 class="text-xl font-bold">Open Cash Register</h2>
        <p class="text-white/70 text-sm mt-1">Cashier: {{ session.cashierName }}</p>
      </div>

      <!-- Body -->
      <div class="p-6">
        <div class="mb-6">
          <label class="block text-sm font-semibold text-gray-700 mb-2">Opening Float / Cash in Drawer</label>
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rs</span>
            <input 
              type="number" 
              v-model="floatAmount"
              class="w-full bg-gray-50 border border-gray-300 focus:border-[#714B67] focus:ring-1 focus:ring-[#714B67] rounded-lg py-3 pl-8 pr-4 text-xl font-mono outline-none transition-all"
            />
          </div>
        </div>

        <button 
          @click="openSession"
          class="w-full bg-[#017E84] hover:bg-[#00A09D] text-white font-bold py-3.5 rounded-lg shadow-sm transition-colors text-lg"
        >
          Open Session
        </button>
      </div>
    </div>
  </div>
</template>
