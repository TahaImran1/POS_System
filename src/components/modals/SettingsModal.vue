<script setup lang="ts">
import { useSettingsStore } from '../../stores/useSettingsStore'
import { ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close'])
const settingsStore = useSettingsStore()

const localMode = ref(settingsStore.posMode)
const localName = ref(settingsStore.storeName)

watch(() => props.show, (newVal) => {
  if (newVal) {
    localMode.value = settingsStore.posMode
    localName.value = settingsStore.storeName
  }
})

const save = () => {
  settingsStore.setMode(localMode.value)
  settingsStore.setStoreName(localName.value)
  emit('close')
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div class="bg-[#714B67] text-white p-4 flex items-center justify-between">
        <h2 class="text-xl font-bold flex items-center gap-2">
          <i class="fas fa-cog"></i> Settings
        </h2>
        <button @click="$emit('close')" class="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <div class="p-6 space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
          <input 
            v-model="localName"
            type="text" 
            class="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-[#714B67] focus:border-[#714B67]"
          />
        </div>

        <div>
          <div class="flex justify-between items-center mb-2">
            <label class="block text-sm font-medium text-gray-700">POS Mode</label>
            <span class="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">DEV SWITCH</span>
          </div>
          
          <div class="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 mb-3 space-y-1">
            <div class="font-bold flex items-center gap-1">
              <i class="fas fa-exclamation-triangle text-amber-600"></i>
              <span>Immutable Node Declaration Note:</span>
            </div>
            <p class="text-[11px] leading-relaxed text-amber-800">
              In actual production, POS type (Store vs Restaurant) is declared once during setup and never changed. This mode switch is provided for development testing.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <button 
              @click="localMode = 'retail'"
              :class="['border rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer', localMode === 'retail' ? 'border-[#714B67] bg-pink-50 text-[#714B67] ring-2 ring-[#714B67]/20 font-bold' : 'border-gray-200 text-gray-500 hover:bg-gray-50']"
            >
              <i class="fas fa-shopping-cart text-2xl"></i>
              <span class="font-medium">Store / Retail</span>
            </button>
            <button 
              @click="localMode = 'restaurant'"
              :class="['border rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer', localMode === 'restaurant' ? 'border-[#714B67] bg-pink-50 text-[#714B67] ring-2 ring-[#714B67]/20 font-bold' : 'border-gray-200 text-gray-500 hover:bg-gray-50']"
            >
              <i class="fas fa-utensils text-2xl"></i>
              <span class="font-medium">Restaurant</span>
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            Restaurant mode enables Table Number canvas and raw material ingredient BOMs. Store mode restricts products to finished goods.
          </p>
        </div>
      </div>

      <div class="bg-gray-50 p-4 border-t border-gray-100 flex justify-end gap-3">
        <button @click="$emit('close')" class="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors">
          Cancel
        </button>
        <button @click="save" class="px-6 py-2 rounded-md bg-[#714B67] text-white font-bold hover:bg-[#5a3c52] transition-colors">
          Save
        </button>
      </div>
    </div>
  </div>
</template>
