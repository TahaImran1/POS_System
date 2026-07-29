<script setup lang="ts">
import { ref } from 'vue'
import { useTableStore } from '../stores/useTableStore'

const emit = defineEmits(['select-table', 'new-order'])
const tableStore = useTableStore()

const isEditMode = ref(false)
const selectedTableForEdit = ref<number | null>(null)
const newSeatsCount = ref(4)

const handleTableClick = (tableId: number) => {
  if (isEditMode.value) {
    selectedTableForEdit.value = tableId
    return
  }
  tableStore.selectTable(tableId)
  emit('select-table', tableId)
}

const handleAddTable = () => {
  const nextId = tableStore.tables.length + 1
  tableStore.tables.push({
    id: nextId,
    name: nextId.toString(),
    seats: 4,
    occupied: false,
    x: 100 + (nextId * 20),
    y: 100 + (nextId * 20),
    shape: 'square'
  })
}
</script>

<template>
  <div class="flex flex-col h-full w-full bg-[#f8f9fa] relative overflow-hidden">
    <!-- Floor Sub-Header matching Odoo -->
    <div class="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 shadow-xs">
      <button 
        @click="$emit('new-order')" 
        class="bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-sm text-sm"
      >
        <span class="text-lg leading-none">+</span> New Order
      </button>

      <div class="flex items-center gap-2">
        <button class="px-4 py-1.5 border border-gray-300 rounded-md font-bold text-gray-700 bg-white hover:bg-gray-50 shadow-sm text-sm">
          {{ tableStore.floorName }}
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button class="px-3 py-1.5 border border-gray-300 rounded-md font-semibold text-gray-700 bg-white hover:bg-gray-50 text-sm shadow-sm">
          Get QR Codes
        </button>

        <!-- # Edit Mode Toggle Button -->
        <button 
          @click="isEditMode = !isEditMode" 
          :class="[
            'w-9 h-9 border rounded-md flex items-center justify-center font-bold text-sm transition-all shadow-sm',
            isEditMode ? 'bg-[#714B67] text-white border-[#714B67]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          ]"
          title="Edit Floor Layout"
        >
          #
        </button>
      </div>
    </div>

    <!-- Main Content Area with Optional Edit Drawer -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Floor Canvas -->
      <div class="flex-1 relative p-8 bg-gray-50 overflow-auto">
        <div 
          v-for="table in tableStore.tables" 
          :key="table.id"
          @click="handleTableClick(table.id)"
          :style="{ left: `${table.x}px`, top: `${table.y}px` }"
          :class="[
            'absolute w-24 h-24 rounded-xl flex flex-col items-center justify-center font-bold cursor-pointer transition-all shadow-md select-none',
            table.occupied 
              ? 'bg-[#2ECC71] text-white shadow-emerald-200 border-2 border-emerald-600' 
              : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-400',
            selectedTableForEdit === table.id && isEditMode ? 'ring-4 ring-[#714B67]' : ''
          ]"
        >
          <span class="text-2xl">{{ table.name }}</span>
          <span class="text-[10px] opacity-75 font-medium">{{ table.seats }} Seats</span>
        </div>
      </div>

      <!-- # Edit Drawer Side Panel -->
      <div v-if="isEditMode" class="w-72 bg-white border-l border-gray-200 p-5 flex flex-col justify-between shadow-xl z-20">
        <div class="space-y-4">
          <div class="flex justify-between items-center pb-3 border-b border-gray-100">
            <h3 class="font-bold text-gray-900">Floor Layout Editor</h3>
            <button @click="isEditMode = false" class="text-gray-400 hover:text-gray-700">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <button 
            @click="handleAddTable"
            class="w-full py-2.5 bg-[#017E84] hover:bg-[#00A09D] text-white font-bold rounded-lg text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <i class="fas fa-plus"></i> Add New Table
          </button>

          <div v-if="selectedTableForEdit" class="pt-4 border-t border-gray-100 space-y-3">
            <p class="text-xs font-bold text-gray-700 uppercase">Edit Table {{ selectedTableForEdit }}</p>
            <div>
              <label class="block text-xs text-gray-500 mb-1 font-semibold">Seat Count</label>
              <input 
                v-model.number="newSeatsCount" 
                type="number" 
                min="1" 
                max="20"
                class="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>

        <button @click="isEditMode = false" class="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg text-sm">
          Done Editing
        </button>
      </div>
    </div>
  </div>
</template>
