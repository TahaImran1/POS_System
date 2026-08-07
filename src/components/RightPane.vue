<script setup lang="ts">
import { useProductStore } from '../stores/useProductStore'
import ProductCard from './ProductCard.vue'

const productStore = useProductStore()
</script>

<template>
  <section class="flex-1 flex flex-col bg-[#e9ecef]/60 h-full overflow-hidden">
    <!-- Category Tabs -->
    <div class="p-3 flex gap-2.5 overflow-x-auto no-scrollbar shrink-0">
      <button 
        v-for="cat in productStore.categories" 
        :key="cat.id"
        @click="productStore.setCategory(cat.id)"
        :class="[
          'px-6 py-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center min-w-[100px] shadow-xs select-none border',
          productStore.selectedCategoryId === cat.id 
            ? 'ring-2 ring-[#714B67] ring-offset-1 scale-[1.02] shadow-md' 
            : 'opacity-85 hover:opacity-100 hover:shadow-md',
          cat.color || 'bg-gray-200 text-gray-900'
        ]"
      >
        <span>{{ cat.name }}</span>
      </button>
    </div>

    <!-- Product Grid -->
    <div class="flex-1 overflow-y-auto p-3 pt-0">
      <div v-if="productStore.filteredProducts.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
        <i class="fas fa-box-open text-5xl text-gray-300 mb-3"></i>
        <p class="text-sm font-semibold">No products in this category</p>
        <p class="text-xs text-gray-400 mt-1">Create a product via Manager Portal or "Add Product" button</p>
      </div>
      <div v-else class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2.5">
        <ProductCard 
          v-for="product in productStore.filteredProducts" 
          :key="product.id" 
          :product="product" 
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
