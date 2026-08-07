<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '../../stores/useAuthStore'

const props = withDefaults(defineProps<{
  show: boolean
  title?: string
  actionDescription?: string
}>(), {
  title: 'Manager Authorization Required',
  actionDescription: 'Only Store Manager can add and manage inventory stock.'
})

const emit = defineEmits(['close', 'authorized'])
const authStore = useAuthStore()

const pinInput = ref('')
const errorMsg = ref('')

watch(() => props.show, (newVal) => {
  if (newVal) {
    pinInput.value = ''
    errorMsg.value = ''
  }
})

const handleVerify = () => {
  if (!pinInput.value) {
    errorMsg.value = 'Please enter Manager PIN code.'
    return
  }

  const isValid = authStore.verifyManagerPin(pinInput.value)
  if (isValid) {
    errorMsg.value = ''
    emit('authorized')
    emit('close')
  } else {
    errorMsg.value = 'Invalid Manager PIN code. Only Store Manager or Developer can manage inventory.'
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/65 z-[100] flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-purple-900/20 animate-in fade-in zoom-in-95 duration-150">
      
      <!-- Header -->
      <div class="bg-gradient-to-r from-[#3f2538] to-[#714B67] text-white p-5 flex justify-between items-center">
        <div class="flex items-center gap-2.5 font-extrabold text-sm tracking-tight">
          <div class="w-8 h-8 rounded-lg bg-amber-400 text-gray-900 flex items-center justify-center font-black">
            <i class="fas fa-lock"></i>
          </div>
          <span>{{ title }}</span>
        </div>
        <button @click="$emit('close')" class="text-white/80 hover:text-white text-lg font-bold">✕</button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-4 text-xs">
        <div class="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 flex items-start space-x-2.5">
          <i class="fas fa-user-shield text-amber-600 text-base mt-0.5 shrink-0"></i>
          <p class="font-medium leading-relaxed">
            {{ actionDescription }}
          </p>
        </div>

        <div>
          <label class="block font-bold text-gray-800 mb-1.5 text-xs">Enter Manager PIN Code</label>
          <input 
            v-model="pinInput" 
            @keyup.enter="handleVerify"
            type="password" 
            maxLength="8"
            placeholder="e.g. 5555"
            class="w-full p-3 border border-gray-300 rounded-xl text-center font-mono text-xl font-bold tracking-widest text-purple-950 focus:outline-none focus:border-[#714B67] bg-slate-50 focus:bg-white"
            autofocus
          />
        </div>

        <div v-if="errorMsg" class="text-rose-600 text-[11px] font-bold text-center bg-rose-50 p-2 rounded-lg border border-rose-200">
          {{ errorMsg }}
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
        <button @click="$emit('close')" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl text-xs">
          Cancel
        </button>
        <button 
          @click="handleVerify"
          class="px-5 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
        >
          <i class="fas fa-check-circle"></i>
          <span>Authorize Action</span>
        </button>
      </div>

    </div>
  </div>
</template>
