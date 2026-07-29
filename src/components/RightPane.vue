<script setup lang="ts">
import { useProductStore } from '../stores/useProductStore'
import ProductCard from './ProductCard.vue'

const productStore = useProductStore()
</script>

<template>
  <section class="flex-1 flex flex-col bg-[#e9ecef]/60 h-full overflow-hidden">
    <!-- Category Tabs matching Odoo screenshot -->
    <div class="p-3 flex gap-3 overflow-x-auto no-scrollbar shrink-0">
      <button 
        v-for="cat in productStore.categories" 
        :key="cat.id"
        @click="productStore.setCategory(cat.id)"
        :class="[
          'px-8 py-4 rounded-md text-sm font-bold transition-all flex items-center justify-center min-w-[110px] shadow-xs select-none',
          cat.id === 'chairs' ? 'bg-[#66d9e8] text-gray-900' : 'bg-[#f783ac] text-gray-900',
          productStore.selectedCategoryId === cat.id ? 'ring-2 ring-gray-800' : 'opacity-90 hover:opacity-100'
        ]"
      >
        <span>{{ cat.name }}</span>
      </button>
    </div>

    <!-- Product Grid -->
    <div class="flex-1 overflow-y-auto p-3 pt-0">
      <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2.5">
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
