<script setup lang="ts">
import { useTableStore } from '../../stores/useTableStore'

const props = defineProps<{
  show: boolean
  currentTableId?: number | null
}>()

const emit = defineEmits(['close', 'transfer'])
const tableStore = useTableStore()

const handleTransferToTable = (tableId: number) => {
  if (tableId === props.currentTableId) return
  emit('transfer', tableId)
  emit('close')
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <!-- Header -->
      <div class="bg-[#714B67] text-white p-4 flex items-center justify-between">
        <h2 class="text-lg font-bold flex items-center gap-2">
          <i class="fas fa-exchange-alt"></i> Transfer Order to Table
        </h2>
        <button @click="$emit('close')" class="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Tables Grid -->
      <div class="p-6 bg-gray-50">
        <p class="text-xs text-gray-500 font-semibold mb-4 uppercase tracking-wider">Select Target Table</p>

        <div class="grid grid-cols-3 gap-3">
          <button 
            v-for="table in tableStore.tables" 
            :key="table.id"
            :disabled="table.id === currentTableId"
            @click="handleTransferToTable(table.id)"
            :class="[
              'p-4 rounded-xl border-2 font-bold text-center transition-all flex flex-col items-center gap-1',
              table.id === currentTableId 
                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed' 
                : table.occupied 
                  ? 'border-amber-400 bg-amber-50 text-amber-900 hover:border-amber-500' 
                  : 'border-emerald-400 bg-emerald-50 text-emerald-900 hover:border-emerald-500 shadow-sm'
            ]"
          >
            <span class="text-xl">Table {{ table.name }}</span>
            <span class="text-xs text-gray-500 font-normal">
              {{ table.id === currentTableId ? '(Current)' : table.occupied ? 'Occupied' : 'Free' }}
            </span>
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 bg-white border-t border-gray-200 flex justify-end">
        <button @click="$emit('close')" class="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-sm">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>
