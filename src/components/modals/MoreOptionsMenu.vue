<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close', 'action'])

const handleAction = (act: string) => {
  emit('action', act)
  emit('close')
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-xs overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div class="bg-gray-800 text-white p-3 px-4 flex justify-between items-center">
        <span class="font-bold text-sm">More Options</span>
        <button @click="$emit('close')" class="text-gray-400 hover:text-white">
          <i class="fas fa-times text-sm"></i>
        </button>
      </div>

      <div class="p-2 divide-y divide-gray-100">
        <button @click="handleAction('note')" class="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 text-sm font-semibold text-gray-700 rounded-lg">
          <i class="fas fa-sticky-note text-amber-500 text-base"></i>
          <span>Internal Note</span>
        </button>

        <button @click="handleAction('split')" class="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 text-sm font-semibold text-gray-700 rounded-lg">
          <i class="fas fa-code-branch text-teal-600 text-base"></i>
          <span>Split Bill</span>
        </button>

        <button @click="handleAction('refund')" class="w-full text-left p-3 hover:bg-gray-50 flex items-center gap-3 text-sm font-semibold text-gray-700 rounded-lg">
          <i class="fas fa-undo text-indigo-600 text-base"></i>
          <span>Refund Order</span>
        </button>

        <button @click="handleAction('cancel')" class="w-full text-left p-3 hover:bg-red-50 flex items-center gap-3 text-sm font-bold text-red-600 rounded-lg">
          <i class="fas fa-trash-alt text-red-500 text-base"></i>
          <span>Cancel Order</span>
        </button>
      </div>
    </div>
  </div>
</template>
