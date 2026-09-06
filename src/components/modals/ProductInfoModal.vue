<script setup lang="ts">
import type { Product } from '../../stores/useProductStore'

const props = defineProps<{
  show: boolean
  product: Product | null
}>()

const emit = defineEmits(['close', 'add-to-cart'])

const handleAddToCart = () => {
  if (props.product) {
    emit('add-to-cart', props.product)
    emit('close')
  }
}
</script>

<template>
  <div v-if="show && product" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <!-- Header Bar matching Odoo -->
      <div class="bg-[#714B67] text-white p-4 flex items-center justify-between">
        <h2 class="font-bold text-lg truncate flex items-center gap-2">
          <i class="fas fa-box font-normal text-sm"></i> {{ product.name }}
        </h2>
        <button @click="$emit('close')" class="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-white">
          <i class="fas fa-times text-lg"></i>
        </button>
      </div>

      <!-- Content Area -->
      <div class="p-6 space-y-4 bg-gray-50">
        <!-- Image Box -->
        <div class="w-full h-48 bg-white border border-gray-200 rounded-xl flex items-center justify-center p-4 shadow-sm">
          <img :src="product.image" :alt="product.name" class="max-h-full max-w-full object-contain" />
        </div>

        <!-- Details List -->
        <div class="bg-white border border-gray-200 rounded-xl p-4 space-y-2 text-sm shadow-xs">
          <div class="flex justify-between border-b border-gray-100 pb-2">
            <span class="text-gray-500 font-medium">Public Price</span>
            <span class="font-bold text-gray-900 font-mono text-base">Rs{{ product.price.toFixed(2) }}</span>
          </div>

          <div class="flex justify-between border-b border-gray-100 pb-2">
            <span class="text-gray-500 font-medium">Category</span>
            <span class="font-semibold text-[#017E84] uppercase text-xs px-2 py-0.5 bg-teal-50 rounded border border-teal-200">
              {{ product.category }}
            </span>
          </div>

          <div class="flex justify-between border-b border-gray-100 pb-2">
            <span class="text-gray-500 font-medium">Barcode / SKU</span>
            <span class="font-mono text-gray-700">{{ product.barcode || 'N/A' }}</span>
          </div>

          <div class="flex justify-between border-b border-gray-100 pb-2">
            <span class="text-gray-500 font-medium">Unit of Measure (UOM)</span>
            <span class="font-bold text-[#714B67] bg-purple-50 px-2 py-0.5 rounded border border-purple-100 uppercase text-xs">
              {{ product.uom || 'PCS' }}
            </span>
          </div>

          <div class="flex justify-between pt-1">
            <span class="text-gray-500 font-medium">Est. Tax (10%)</span>
            <span class="font-mono text-gray-700">Rs{{ product.taxAmount.toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <!-- Actions Footer -->
      <div class="p-4 bg-white border-t border-gray-200 flex items-center gap-3">
        <button @click="$emit('close')" class="w-1/3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors">
          Close
        </button>
        <button @click="handleAddToCart" class="w-2/3 py-3 bg-[#017E84] hover:bg-[#00A09D] text-white font-bold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2">
          <i class="fas fa-plus"></i> Add to Cart
        </button>
      </div>
    </div>
  </div>
</template>
