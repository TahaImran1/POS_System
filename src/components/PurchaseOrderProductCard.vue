<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Product } from '../stores/useProductStore'
import { usePurchaseOrderStore } from '../stores/usePurchaseOrderStore'
import type { ProductUOM } from '../services/uomService'

const props = defineProps<{
  product: Product
}>()

const poStore = usePurchaseOrderStore()
const availableUoms = ref<ProductUOM[]>([])
const isHovered = ref(false)

onMounted(async () => {
  availableUoms.value = await poStore.getProductUomsFromCache(props.product.id)
})

// Quantity already added to PO Cart (in any UOM)
const cartQuantity = computed(() => {
  const matches = poStore.items.filter(i => i.product.id === props.product.id)
  return matches.reduce((sum, i) => sum + i.quantity, 0)
})

// Base UOM
const baseUom = computed(() => {
  return availableUoms.value.find(u => u.is_base_uom) || availableUoms.value[0] || null
})

// Non-base / Upper UOM tiers (Pack, Carton, Box, etc.)
const extraUoms = computed(() => {
  return availableUoms.value.filter(u => !u.is_base_uom && u.multiplier_to_base > 1)
})

const handleAddBase = () => {
  poStore.addProduct(props.product)
}

const handleAddSpecificUom = (uom: ProductUOM, event: MouseEvent) => {
  event.stopPropagation()
  poStore.addProduct(props.product, uom)
}
</script>

<template>
  <div 
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @click="handleAddBase"
    class="bg-white border border-gray-200 rounded-xl p-3 flex flex-col justify-between hover:border-[#714B67] hover:shadow-lg transition-all duration-150 cursor-pointer group relative overflow-hidden select-none"
  >
    <!-- Top Row: Product Identity & Active In-Cart Badge -->
    <div>
      <div class="flex justify-between items-start gap-1 mb-1">
        <span class="font-extrabold text-xs text-gray-900 group-hover:text-[#714B67] line-clamp-1">
          {{ product.name }}
        </span>
        <span v-if="cartQuantity > 0" class="shrink-0 bg-purple-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
          {{ cartQuantity }} in PO
        </span>
      </div>

      <div class="flex items-center justify-between text-[10px] text-gray-400 font-mono mb-2">
        <span class="truncate">#{{ product.barcode || product.sku || 'N/A' }}</span>
        <span class="capitalize text-gray-500 font-semibold truncate">{{ product.category }}</span>
      </div>
    </div>

    <!-- Middle: Stock & Pricing Grid -->
    <div class="space-y-1.5 py-2 border-y border-gray-100 text-xs">
      <div class="flex justify-between items-center text-[11px]">
        <span class="text-gray-500 font-medium">Current Stock:</span>
        <span 
          class="font-mono font-black"
          :class="(product.stock || 0) <= 10 ? 'text-amber-600' : 'text-gray-800'"
        >
          {{ product.stock || 0 }} {{ product.uom || 'Pcs' }}
        </span>
      </div>

      <div class="flex justify-between items-center text-[11px]">
        <span class="text-gray-500 font-medium">Last Cost Rate:</span>
        <span class="font-mono font-bold text-purple-900">
          Rs {{ (product.cost_price || product.price * 0.8).toFixed(2) }}
        </span>
      </div>

      <div class="flex justify-between items-center text-[11px]">
        <span class="text-gray-500 font-medium">Selling Rate:</span>
        <span class="font-mono font-bold text-teal-700">
          Rs {{ product.price.toFixed(2) }}
        </span>
      </div>
    </div>

    <!-- Bottom Action & Hover UOM Selector Bar -->
    <div class="mt-2 relative">
      <!-- Default Add Bar -->
      <div class="w-full py-1.5 bg-purple-50 group-hover:bg-[#714B67] text-[#714B67] group-hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs">
        <i class="fas fa-cart-plus"></i>
        <span>Add to PO ({{ baseUom?.uom_name || product.uom || 'PCS' }})</span>
      </div>

      <!-- Hover UOM Selector Flyout / Pill Bar -->
      <!-- Appears smoothly when hovered, allowing immediate selection of Piece, Pack, Carton etc. -->
      <div 
        v-if="availableUoms.length > 0"
        :class="[
          'absolute inset-x-0 bottom-0 bg-[#3f2538] text-white p-1 rounded-lg flex items-center justify-center gap-1 transition-all duration-200 z-20 shadow-md',
          isHovered ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'
        ]"
        @click.stop
      >
        <span class="text-[9px] font-extrabold uppercase text-amber-300 tracking-wider mr-0.5">UOM:</span>

        <button 
          v-for="uom in availableUoms"
          :key="uom.uom_id"
          @click="handleAddSpecificUom(uom, $event)"
          class="px-2 py-1 bg-white/20 hover:bg-amber-400 hover:text-gray-950 text-white rounded text-[10px] font-extrabold transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
          :title="`Add ${product.name} in ${uom.uom_name} (${uom.multiplier_to_base} ${product.uom || 'Pcs'})`"
        >
          <span>{{ uom.uom_name }}</span>
          <span v-if="uom.multiplier_to_base > 1" class="text-[8px] opacity-80 ml-0.5 font-mono">
            ({{ uom.multiplier_to_base }}x)
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
