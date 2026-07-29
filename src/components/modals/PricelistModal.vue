<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close', 'select-pricelist'])

const activePricelist = ref('standard')

const selectPricelist = (id: string, name: string) => {
  activePricelist.value = id
  emit('select-pricelist', name)
  emit('close')
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div class="bg-gray-800 text-white p-4 flex justify-between items-center">
        <h2 class="font-bold text-sm flex items-center gap-2">
          <i class="fas fa-list"></i> Select Pricelist
        </h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-white">
          <i class="fas fa-times text-base"></i>
        </button>
      </div>

      <div class="p-3 divide-y divide-gray-100 bg-gray-50">
        <button 
          @click="selectPricelist('standard', 'Standard Public Price')"
          :class="['w-full text-left p-3 flex justify-between items-center rounded-lg text-sm font-semibold transition-colors', activePricelist === 'standard' ? 'bg-purple-50 text-[#714B67] border border-[#714B67]' : 'hover:bg-white text-gray-700']"
        >
          <span>Standard Public Price</span>
          <i v-if="activePricelist === 'standard'" class="fas fa-check"></i>
        </button>

        <button 
          @click="selectPricelist('vip', 'VIP Customer (10% Discount)')"
          :class="['w-full text-left p-3 flex justify-between items-center rounded-lg text-sm font-semibold transition-colors', activePricelist === 'vip' ? 'bg-purple-50 text-[#714B67] border border-[#714B67]' : 'hover:bg-white text-gray-700']"
        >
          <span>VIP Customer (10% Discount)</span>
          <i v-if="activePricelist === 'vip'" class="fas fa-check"></i>
        </button>

        <button 
          @click="selectPricelist('wholesale', 'Wholesale Bulk Rate')"
          :class="['w-full text-left p-3 flex justify-between items-center rounded-lg text-sm font-semibold transition-colors', activePricelist === 'wholesale' ? 'bg-purple-50 text-[#714B67] border border-[#714B67]' : 'hover:bg-white text-gray-700']"
        >
          <span>Wholesale Bulk Rate</span>
          <i v-if="activePricelist === 'wholesale'" class="fas fa-check"></i>
        </button>
      </div>

      <div class="p-3 bg-white border-t border-gray-200 flex justify-end">
        <button @click="$emit('close')" class="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-xs">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>
