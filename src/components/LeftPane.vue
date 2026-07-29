<script setup lang="ts">
import { computed } from 'vue'
import { useCartStore, type CartItem as CartItemType } from '../stores/useCartStore'
import CartItem from './CartItem.vue'
import Numpad from './Numpad.vue'

const emit = defineEmits(['new-order'])
const cart = useCartStore()

// Group items by Course matching Odoo screenshot
const groupedItems = computed(() => {
  const map = new Map<string, CartItemType[]>()
  cart.items.forEach(item => {
    const courseName = item.course || 'Course 1'
    if (!map.has(courseName)) {
      map.set(courseName, [])
    }
    map.get(courseName)!.push(item)
  })
  return map
})
</script>

<template>
  <aside class="flex flex-col bg-white border-r border-gray-200 h-full w-[420px] shrink-0 z-10">
    
    <!-- Order Lines Grouped by Course -->
    <div class="flex-1 overflow-y-auto bg-white">
      <div v-if="cart.items.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
        <i class="fas fa-shopping-cart text-5xl text-gray-200 mb-3"></i>
        <p class="text-sm font-semibold text-gray-400">Cart is empty</p>
      </div>

      <div v-else class="flex flex-col">
        <div v-for="[courseName, items] in groupedItems" :key="courseName">
          <!-- Course Header Banner matching Odoo screenshot (#A7F3D0 green banner) -->
          <div class="px-4 py-1.5 bg-[#A7F3D0] text-[#065F46] font-bold text-xs flex items-center justify-between border-y border-emerald-300/60">
            <span>{{ courseName }}</span>
          </div>

          <!-- Items in Course -->
          <div class="divide-y divide-gray-100">
            <CartItem v-for="item in items" :key="item.id" :item="item" />
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Box -->
    <div class="px-4 py-3 bg-white flex flex-col gap-0.5 border-t border-gray-200 shrink-0">
      <div class="flex justify-between text-xs text-gray-500 font-medium">
        <span>Taxes</span>
        <span class="font-mono text-gray-700">{{ cart.taxes.toFixed(2) }} Rs.</span>
      </div>
      <div class="flex justify-between text-xl font-bold text-gray-900 mt-1">
        <span>Total</span>
        <span class="font-mono text-gray-900">{{ cart.total.toFixed(2) }} Rs.</span>
      </div>
    </div>

    <!-- Numpad & Actions (Pass empty cart state so numpad collapses when empty) -->
    <Numpad :isEmpty="cart.items.length === 0" @new-order="$emit('new-order')" />
  </aside>
</template>
