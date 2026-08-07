<script setup lang="ts">
import { computed } from 'vue'
import { useCartStore } from '../stores/useCartStore'
import { useProductStore } from '../stores/useProductStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import type { Product } from '../stores/useProductStore'

const props = defineProps<{
  product: Product
}>()

const cart = useCartStore()
const productStore = useProductStore()
const settingsStore = useSettingsStore()

const isRetail = computed(() => settingsStore.posMode === 'retail')

const addToCart = () => {
  cart.addProduct(props.product)
}

const quantityInCart = computed(() => {
  const item = cart.items.find(i => i.product.id === props.product.id)
  return item ? item.quantity : 0
})

const categoryColorClass = computed(() => {
  const cat = productStore.categories.find(c => c.id === props.product.category)
  if (!cat || !cat.color) return 'border-b-pink-400'
  
  if (cat.id === 'chairs') return 'border-b-[#66d9e8]'
  if (cat.id === 'desks' || cat.id === 'misc') return 'border-b-[#f783ac]'
  return 'border-b-pink-400'
})
</script>

<template>
  <div 
    @click="addToCart"
    :class="[
      'aspect-square bg-white shadow-xs border border-gray-200 rounded-lg cursor-pointer transition-colors relative flex flex-col p-1.5 border-b-4 hover:border-gray-300',
      categoryColorClass,
      'hover:bg-gray-50/80'
    ]"
  >
    <!-- Main Image Area with grey background container -->
    <div class="flex-1 w-full bg-[#f8f9fa] rounded flex items-center justify-center overflow-hidden mb-1 relative p-1">
      <img :src="product.image" :alt="product.name" class="w-full h-full object-contain" />
      
      <!-- Cart Quantity Badge -->
      <div 
        v-if="quantityInCart > 0" 
        class="absolute top-1 right-1 bg-[#2ECC71] text-white text-[10px] px-1.5 py-0.5 font-bold rounded-full shadow-sm z-10"
      >
        {{ quantityInCart }}
      </div>

      <!-- Retail Mode: Dynamic Stock Badge & Barcode Tag -->
      <div 
        v-if="isRetail" 
        class="absolute bottom-1 left-1 bg-teal-800/90 text-white text-[9px] font-mono px-1 py-0.5 rounded font-bold shadow-xs z-10"
      >
        Stock: {{ product.stock !== undefined ? product.stock : 100 }}
      </div>
    </div>
    
    <!-- Title & Barcode Info (Bottom) -->
    <div class="h-8 flex flex-col items-center justify-center w-full px-0.5">
      <div class="text-[11px] leading-tight text-center font-bold text-gray-800 line-clamp-1 w-full break-words">
        {{ product.name }}
      </div>
      <div v-if="isRetail && product.barcode" class="text-[9px] font-mono text-teal-600 font-semibold truncate">
        #{{ product.barcode }}
      </div>
      <div v-else class="text-[10px] font-mono text-gray-500 font-semibold">
        {{ product.price.toFixed(2) }} Rs.
      </div>
    </div>
  </div>
</template>
