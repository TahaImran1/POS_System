<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCartStore } from '../stores/useCartStore'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { desc, eq } from 'drizzle-orm'

import SaleReturnModal from '../components/modals/SaleReturnModal.vue'

const emit = defineEmits(['load-order'])
const cartStore = useCartStore()

const searchQuery = ref('')
const selectedFilter = ref('All')
const completedOrders = ref<any[]>([])
const selectedOrderId = ref<string | null>(null)
const isReturnModalOpen = ref(false)

// Fetch completed sales from SQLite database
async function loadCompletedSales() {
  try {
    const dbSales = await db.select().from(schema.sales).orderBy(desc(schema.sales.created_at))
    const list: any[] = []

    for (const sale of dbSales) {
      const items = await db.select()
        .from(schema.sale_items)
        .where(eq(schema.sale_items.sale_id, sale.sale_id))

      const formattedItems: any[] = []
      for (const item of items) {
        const prod = await db.select()
          .from(schema.products)
          .where(eq(schema.products.product_id, item.product_id))
          .get()

        formattedItems.push({
          id: item.sale_item_id,
          quantity: item.quantity,
          price: item.unit_price,
          tax: item.tax_amount || 0,
          product: {
            name: prod?.name || 'Item Product',
            image: prod?.image || ''
          }
        })
      }

      const dateStr = sale.created_at 
        ? new Date(sale.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
        : 'Recently'

      list.push({
        id: sale.sale_id,
        date: dateStr,
        receiptNo: `POS-${sale.sale_id.substr(0, 8).toUpperCase()}`,
        tableName: `Paid via ${sale.payment_method || 'Cash'}`,
        customer: 'Walk-in Customer',
        total: Number(sale.net_total || 0),
        subtotal: Number(sale.subtotal || 0),
        taxes: Number(sale.tax_total || 0),
        status: 'Paid',
        paymentMethod: sale.payment_method || 'Cash',
        items: formattedItems
      })
    }

    completedOrders.value = list
    if (!selectedOrderId.value && list.length > 0) {
      selectedOrderId.value = list[0].id
    }
  } catch (e) {
    console.warn('Failed to load completed sales from DB:', e)
  }
}

import { watch, onUnmounted } from 'vue'

onMounted(() => {
  loadCompletedSales()
  window.addEventListener('focus', loadCompletedSales)
})

onUnmounted(() => {
  window.removeEventListener('focus', loadCompletedSales)
})

watch(() => cartStore.tickets.length, () => {
  loadCompletedSales()
})

// Combine Ongoing Active Tickets + Completed Paid Orders
const allOrders = computed(() => {
  const ongoing = cartStore.tickets
    .filter(t => t.items.length > 0)
    .map((t, idx) => ({
      id: t.id,
      date: 'Active Session',
      receiptNo: `Ticket #${t.name}`,
      tableName: `Table ${t.name}`,
      customer: 'Guest',
      total: t.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      taxes: t.items.reduce((sum, item) => sum + (item.price * item.quantity * 0.1), 0),
      status: 'Ongoing',
      paymentMethod: 'Unpaid',
      items: t.items
    }))

  return [...ongoing, ...completedOrders.value]
})

// Filtered orders list
const filteredOrders = computed(() => {
  return allOrders.value.filter(order => {
    // Search query filter
    const q = searchQuery.value.toLowerCase().trim()
    const matchesSearch = !q || 
      order.receiptNo.toLowerCase().includes(q) || 
      order.status.toLowerCase().includes(q) || 
      order.tableName.toLowerCase().includes(q) ||
      order.items.some((i: any) => i.product.name.toLowerCase().includes(q))

    // Category Filter
    if (selectedFilter.value === 'Paid') return matchesSearch && order.status === 'Paid'
    if (selectedFilter.value === 'Ongoing') return matchesSearch && order.status === 'Ongoing'
    return matchesSearch
  })
})

const selectedOrder = computed(() => {
  return filteredOrders.value.find(o => o.id === selectedOrderId.value) || filteredOrders.value[0]
})

const handleLoadOrder = () => {
  if (selectedOrder.value) {
    if (selectedOrder.value.status === 'Ongoing') {
      cartStore.switchTicket(selectedOrder.value.id)
    }
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
            placeholder="Search completed or ongoing orders..." 
            class="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#714B67]"
          />
        </div>

        <div class="flex items-center gap-2">
          <select v-model="selectedFilter" class="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white font-medium text-gray-700">
            <option value="All">All Orders</option>
            <option value="Paid">Paid Orders</option>
            <option value="Ongoing">Ongoing Tickets</option>
          </select>

          <span class="text-xs text-gray-500 font-medium">
            {{ filteredOrders.length }} Order{{ filteredOrders.length === 1 ? '' : 's' }}
          </span>
        </div>
      </div>

      <!-- Orders List Table -->
      <div class="flex-1 overflow-y-auto divide-y divide-gray-100">
        <div v-if="filteredOrders.length === 0" class="p-12 text-center text-gray-400 font-medium text-sm">
          No orders found. Complete a sale at checkout to see it listed here!
        </div>

        <div 
          v-for="order in filteredOrders" 
          :key="order.id"
          @click="selectedOrderId = order.id"
          :class="[
            'p-4 flex items-center justify-between cursor-pointer transition-colors text-sm',
            selectedOrderId === order.id ? 'bg-purple-50/70 border-l-4 border-l-[#714B67]' : 'hover:bg-gray-50'
          ]"
        >
          <div class="flex flex-col gap-0.5">
            <span class="text-xs font-bold text-gray-900">{{ order.date }}</span>
            <span class="text-xs text-gray-500 font-mono font-bold">{{ order.receiptNo }}</span>
          </div>

          <div>
            <span class="px-2.5 py-1 bg-gray-100 text-gray-700 rounded font-semibold text-xs border border-gray-200">
              {{ order.tableName }}
            </span>
          </div>

          <div class="font-bold text-gray-900 font-mono text-base">
            {{ order.total.toFixed(2) }} Rs.
          </div>

          <div class="flex items-center gap-3">
            <span 
              class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              :class="order.status === 'Paid' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'"
            >
              {{ order.status }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Panel: Receipt Preview & Order Items -->
    <div class="w-1/3 flex flex-col bg-gray-50/50 justify-between border-l border-gray-200">
      <!-- Selected Order Header -->
      <div v-if="selectedOrder" class="p-4 bg-white border-b border-gray-200 shadow-2xs">
        <div class="flex justify-between items-center">
          <h3 class="font-bold text-base text-gray-900">{{ selectedOrder.receiptNo }}</h3>
          <span 
            class="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase"
            :class="selectedOrder.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'"
          >
            {{ selectedOrder.status }}
          </span>
        </div>
        <div class="text-xs text-gray-500 font-mono mt-1">Date: {{ selectedOrder.date }}</div>
      </div>

      <!-- Order Items List Preview -->
      <div class="p-5 flex-1 overflow-y-auto">
        <div v-if="selectedOrder" class="space-y-2.5">
          <div v-for="item in selectedOrder.items" :key="item.id" class="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
            <div class="flex justify-between items-start">
              <div class="flex items-center gap-2.5">
                <span class="w-7 h-7 rounded-full bg-purple-100 text-[#714B67] text-xs font-bold flex items-center justify-center font-mono shrink-0">
                  {{ item.quantity }}x
                </span>
                <div>
                  <span class="font-bold text-gray-900 text-xs block">{{ item.product.name }}</span>
                  <span class="text-[10px] text-gray-500 font-mono">@ Rs{{ item.price.toFixed(2) }} ea. | Tax: Rs{{ ((item.tax || 0) * item.quantity).toFixed(2) }}</span>
                </div>
              </div>
              <span class="font-mono text-gray-900 font-bold text-xs">Rs{{ (item.price * item.quantity).toFixed(2) }}</span>
            </div>
          </div>

          <div v-if="selectedOrder.items.length === 0" class="text-center text-gray-400 py-12 text-xs font-medium">
            No items recorded in this order.
          </div>
        </div>
      </div>

      <!-- Bill Totals & Action -->
      <div v-if="selectedOrder" class="bg-white border-t border-gray-200 p-5 space-y-3 shadow-lg">
        <div class="space-y-1.5 text-xs">
          <div class="flex justify-between text-gray-500">
            <span>Payment Method:</span>
            <span class="font-bold text-gray-900">{{ selectedOrder.paymentMethod }}</span>
          </div>
          <div class="flex justify-between text-gray-500">
            <span>Items Subtotal:</span>
            <span class="font-mono font-semibold text-gray-700">{{ (selectedOrder.subtotal || (selectedOrder.total - (selectedOrder.taxes || 0))).toFixed(2) }} Rs.</span>
          </div>
          <div class="flex justify-between text-indigo-600 font-medium">
            <span>Tax (Item + Whole Bill Tax):</span>
            <span class="font-mono font-semibold">+{{ (selectedOrder.taxes || 0).toFixed(2) }} Rs.</span>
          </div>
          <div class="flex justify-between text-base font-black text-gray-900 pt-1.5 border-t border-gray-200">
            <span>Total Paid</span>
            <span class="font-mono text-[#714B67]">{{ (selectedOrder.total || 0).toFixed(2) }} Rs.</span>
          </div>
        </div>

        <button 
          v-if="selectedOrder.status === 'Ongoing'"
          @click="handleLoadOrder"
          class="w-full py-3 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded-xl text-xs transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          <i class="fas fa-edit"></i>
          <span>Continue / Edit Ticket Order</span>
        </button>

        <button 
          v-else
          @click="isReturnModalOpen = true"
          class="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          <i class="fas fa-undo"></i>
          <span>Process Return & Exchange</span>
        </button>
      </div>
    </div>

    <!-- Sales Return Modal -->
    <SaleReturnModal 
      :show="isReturnModalOpen" 
      :initialSaleId="selectedOrder?.id"
      @close="isReturnModalOpen = false"
      @return-success="loadCompletedSales"
    />
  </div>
</template>
