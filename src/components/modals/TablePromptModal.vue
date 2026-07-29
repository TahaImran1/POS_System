<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close', 'confirm'])

const tableNumber = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(() => props.show, async (newVal) => {
  if (newVal) {
    tableNumber.value = ''
    await nextTick()
    inputRef.value?.focus()
  }
})

const submit = () => {
  if (tableNumber.value.trim()) {
    emit('confirm', `Table ${tableNumber.value.trim()}`)
  } else {
    emit('close')
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div class="bg-teal-600 text-white p-4 flex items-center justify-between">
        <h2 class="text-lg font-bold flex items-center gap-2">
          <i class="fas fa-chair"></i> Enter Table Number
        </h2>
        <button @click="$emit('close')" class="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <div class="p-6">
        <form @submit.prevent="submit">
          <input 
            ref="inputRef"
            v-model="tableNumber"
            type="text" 
            placeholder="e.g. 5, T12, Outside"
            class="w-full text-center text-2xl font-bold border-2 border-gray-300 rounded-lg shadow-sm px-4 py-4 focus:ring-teal-600 focus:border-teal-600"
          />
          <div class="mt-6 flex gap-3">
            <button type="button" @click="$emit('close')" class="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button type="submit" :disabled="!tableNumber.trim()" class="flex-1 py-3 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Start Order
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
