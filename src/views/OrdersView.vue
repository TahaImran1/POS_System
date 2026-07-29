<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCartStore } from '../stores/useCartStore'

const emit = defineEmits(['load-order'])
const cartStore = useCartStore()

const searchQuery = ref('')
const selectedFilter = ref('Active')
const selectedOrderId = ref<string | null>(cartStore.tickets[0]?.id || null)

// Mock/Live orders list from store
const ordersList = computed(() => {
  return cartStore.tickets.map((t, idx) => ({
    id: t.id,
    date: 'Today 06:55:04 AM',
    receiptNo: `T ${t.name} (261-2-00000${idx + 4})`,
    tableName: `Table ${t.name}`,
    customer: '-',
    total: t.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    taxes: t.items.reduce((sum, item) => sum + (item.price * item.quantity * 0.17), 0),
    status: 'Ongoing',
    items: t.items
  }))
})

const selectedOrder = computed(() => {
  return ordersList.value.find(o => o.id === selectedOrderId.value) || ordersList.value[0]
})

const handleLoadOrder = () => {
  if (selectedOrder.value) {
    cartStore.switchTicket(selectedOrder.value.id)
    emit('load-order', selectedOrder.value.id)
  }
}
</script>

<template>
  <div class="flex h-full w-full bg-[#f8f9fa] overflow-hidden">
    <!-- Left Panel: Orders List -->
    <div class="w-2/3 border-r border-gray-200 flex flex-col bg-white">
      <!-- Search & Filters Toolbar -->
      <div class="p-3 border-b border-gray-200 flex items-center justify-between gap-3 bg-gray-50">
        <div class="relative flex-1">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search Orders..." 
            class="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-teal-600"
          />
        </div>

        <div class="flex items-center gap-2">
          <select v-model="selectedFilter" class="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white font-medium text-gray-700">
            <option>Active</option>
            <option>Ongoing</option>
            <option>Payment</option>
            <option>Receipt</option>
            <option>Paid</option>
          </select>

          <span class="text-xs text-gray-500 font-medium">1-{{ ordersList.length }} / {{ ordersList.length }}</span>
          
          <div class="flex gap-1">
            <button class="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 text-xs text-gray-600">◀</button>
            <button class="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 text-xs text-gray-600">▶</button>
          </div>
        </div>
      </div>

      <!-- Orders Table -->
      <div class="flex-1 overflow-y-auto">
        <div 
          v-for="order in ordersList" 
          :key="order.id"
          @click="selectedOrderId = order.id"
          :class="[
            'p-4 border-b border-gray-100 flex items-center justify-between cursor-pointer transition-colors text-sm',
            selectedOrderId === order.id ? 'bg-teal-50/70 border-l-4 border-l-[#017E84]' : 'hover:bg-gray-50'
          ]"
        >
          <div class="flex flex-col gap-0.5">
            <span class="text-xs font-bold text-teal-800">{{ order.date }}</span>
            <span class="text-xs text-gray-500 font-mono">{{ order.receiptNo }}</span>
          </div>

          <div>
            <span class="px-2.5 py-1 bg-pink-100 text-pink-800 rounded font-semibold text-xs border border-pink-200">
              {{ order.tableName }}
            </span>
          </div>

          <div class="font-bold text-teal-700 font-mono text-base">
            {{ order.total.toFixed(2) }} Rs.
          </div>

          <div class="flex items-center gap-4">
            <span class="px-3 py-1 bg-teal-500 text-white rounded-full text-xs font-bold">
              {{ order.status }}
            </span>
            <button class="text-gray-400 hover:text-red-600 transition-colors p-1" title="Delete Order">
              <i class="fas fa-trash-alt text-sm"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Panel: Receipt Details & Order Loader -->
    <div class="w-1/3 flex flex-col bg-gray-50/50 justify-between">
      <!-- Order Items Receipt Preview -->
      <div class="p-6 flex-1 overflow-y-auto">
        <div v-if="selectedOrder" class="space-y-4">
          <div v-for="item in selectedOrder.items" :key="item.id" class="flex justify-between items-center text-sm font-semibold text-gray-800">
            <div class="flex items-center gap-3">
              <span class="w-5 text-gray-600 text-xs font-bold">{{ item.quantity }}</span>
              <span>{{ item.product.name }}</span>
            </div>
            <span class="font-mono text-gray-900">{{ (item.price * item.quantity).toFixed(2) }} Rs.</span>
          </div>

          <div v-if="selectedOrder.items.length === 0" class="text-center text-gray-400 py-12">
            No items in this order.
          </div>
        </div>
      </div>

      <!-- Bill Totals & Load Order Action -->
      <div class="bg-white border-t border-gray-200 p-6 space-y-4 shadow-lg">
        <div class="space-y-1 text-sm">
          <div class="flex justify-between text-gray-500">
            <span>Taxes</span>
            <span class="font-mono">{{ (selectedOrder?.taxes || 0).toFixed(2) }} Rs.</span>
          </div>
          <div class="flex justify-between text-xl font-bold text-gray-900 pt-1">
            <span>Total</span>
            <span class="font-mono">{{ (selectedOrder?.total || 0).toFixed(2) }} Rs.</span>
          </div>
        </div>

        <button 
          @click="handleLoadOrder"
          class="w-full py-4 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded-xl text-lg transition-colors shadow-md flex items-center justify-center gap-2"
        >
          Load Order
        </button>
      </div>
    </div>
  </div>
</template>
