<script setup lang="ts">
import { computed } from 'vue'
import { useCartStore, type CartItem as CartItemType } from '../stores/useCartStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import CartItem from './CartItem.vue'
import Numpad from './Numpad.vue'

const emit = defineEmits(['new-order'])
const cart = useCartStore()
const settingsStore = useSettingsStore()

const isRestaurant = computed(() => settingsStore.posMode === 'restaurant')

// Group items by Course matching Odoo screenshot for Restaurant mode
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
  <aside class="flex flex-col bg-white border-r border-gray-200 h-full w-[420px] shrink-0 z-10 overflow-hidden">
    
    <!-- Order Lines Section -->
    <div class="flex-1 min-h-0 overflow-y-auto bg-white">
      <div v-if="cart.items.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400 p-4">
        <i :class="['fas', isRestaurant ? 'fa-utensils' : 'fa-barcode', 'text-5xl text-gray-200 mb-3']"></i>
        <p class="text-sm font-semibold text-gray-400">{{ isRestaurant ? 'No items in ticket' : 'Scan barcode or click item to add' }}</p>
      </div>

      <!-- Restaurant Mode: Grouped by Course Headers -->
      <div v-else-if="isRestaurant" class="flex flex-col divide-y divide-gray-100">
        <div v-for="[courseName, items] in groupedItems" :key="courseName">
          <div class="px-4 py-1.5 bg-[#A7F3D0] text-[#065F46] font-bold text-xs flex items-center justify-between border-y border-emerald-300/60">
            <span>🍽️ {{ courseName }}</span>
          </div>

          <div class="divide-y divide-gray-100">
            <CartItem v-for="item in items" :key="item.id" :item="item" />
          </div>
        </div>
      </div>

      <!-- Retail Mode: Direct Flat List -->
      <div v-else class="flex flex-col divide-y divide-gray-100">
        <div class="px-4 py-1.5 bg-teal-50 text-[#00A09D] font-bold text-[11px] flex items-center justify-between border-b border-teal-200">
          <span>🛒 Retail Cart Lines ({{ cart.items.length }})</span>
          <span class="font-mono text-[10px] text-teal-700">Barcode Scanner Active</span>
        </div>
        <CartItem v-for="item in cart.items" :key="item.id" :item="item" />
      </div>
    </div>

    <!-- Summary Box -->
    <div class="px-3 py-1 bg-gray-50/80 flex flex-col gap-0.5 border-t border-gray-200 shrink-0 text-[11px]">
      <div class="flex justify-between items-center text-gray-600 font-medium">
        <span>Subtotal: <strong class="font-mono text-gray-800">{{ cart.subtotal.toFixed(2) }}</strong></span>
        <span>Item Tax: <strong class="font-mono text-indigo-600">+{{ cart.itemTaxes.toFixed(2) }}</strong></span>
        <span v-if="cart.globalGstTax > 0">
          Bill Tax: <strong class="font-mono text-purple-700">+{{ cart.globalGstTax.toFixed(2) }}</strong>
        </span>
      </div>
      <div class="flex justify-between items-center text-base font-extrabold text-gray-900 pt-0.5 border-t border-gray-200/80">
        <span>Total</span>
        <span class="font-mono text-[#00A09D] text-lg font-black">{{ cart.total.toFixed(2) }} Rs.</span>
      </div>
    </div>

    <!-- Numpad & Actions -->
    <Numpad :isEmpty="cart.items.length === 0" @new-order="$emit('new-order')" />
  </aside>
</template>
