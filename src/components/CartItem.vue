<script setup lang="ts">
import { computed } from 'vue'
import { useCartStore } from '../stores/useCartStore'
import type { CartItem } from '../stores/useCartStore'

const props = defineProps<{
  item: CartItem
}>()

const cart = useCartStore()

const isSelected = computed(() => cart.selectedItemId === props.item.id)

const selectItem = () => {
  cart.setSelectedItemId(props.item.id)
}
</script>

<template>
  <div 
    @click="selectItem"
    :class="[
      'flex justify-between items-start px-4 py-3 cursor-pointer transition-colors text-sm',
      isSelected ? 'bg-[#e9ecef] text-gray-900' : 'bg-white text-gray-700 hover:bg-gray-50'
    ]"
  >
    <div class="flex gap-4 flex-1">
      <div class="font-bold w-6">{{ item.quantity }}</div>
      <div class="flex-1 flex flex-col">
        <span class="font-medium">{{ item.product.name }}</span>
        <span v-if="item.product.description" class="text-xs text-gray-500 mt-0.5">- {{ item.product.description }}</span>
        <span v-if="item.discount > 0" class="text-xs text-red-500 font-semibold mt-0.5">Discount: {{ item.discount }}%</span>
      </div>
    </div>
    <div class="font-bold text-right ml-4">
      {{ (item.quantity * item.price * (1 - item.discount / 100)).toFixed(2) }} Rs.
    </div>
  </div>
</template>
