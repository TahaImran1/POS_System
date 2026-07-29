<script setup lang="ts">
import { ref, watch } from 'vue'
import { db } from '../../db/client'
import * as schema from '../../db/schema'
import { desc } from 'drizzle-orm'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close'])

const orders = ref<any[]>([])
const loading = ref(false)

const loadOrders = async () => {
  if (!props.show) return
  loading.value = true
  try {
    const records = await db.select().from(schema.sales).orderBy(desc(schema.sales.created_at)).limit(50)
    orders.value = records
  } catch (error) {
    console.error('Failed to load orders', error)
  } finally {
    loading.value = false
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) loadOrders()
})

const formatTime = (ts: number | null) => {
  if (!ts) return ''
  const date = new Date(ts)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Header -->
      <div class="bg-[#714B67] text-white p-4 flex items-center justify-between shrink-0">
        <h2 class="text-xl font-bold flex items-center gap-2">
          <i class="fas fa-history"></i> Order History
        </h2>
        <button @click="$emit('close')" class="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4 bg-gray-50">
        <div v-if="loading" class="flex justify-center py-12 text-gray-400">
          <i class="fas fa-circle-notch fa-spin text-3xl"></i>
        </div>
        
        <div v-else-if="orders.length === 0" class="text-center py-12 text-gray-500">
          <i class="fas fa-receipt text-5xl mb-4 opacity-50"></i>
          <p class="text-lg font-medium">No past orders found.</p>
        </div>

        <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-100 text-gray-600 text-sm border-b border-gray-200">
                <th class="py-3 px-4 font-semibold">Receipt ID</th>
                <th class="py-3 px-4 font-semibold">Time</th>
                <th class="py-3 px-4 font-semibold">Method</th>
                <th class="py-3 px-4 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="order in orders" :key="order.sale_id" class="hover:bg-gray-50 transition-colors">
                <td class="py-3 px-4 font-mono text-xs text-gray-500">{{ order.sale_id }}</td>
                <td class="py-3 px-4 text-sm font-medium text-gray-800">{{ formatTime(order.created_at) }}</td>
                <td class="py-3 px-4 text-sm">
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                    <i :class="order.payment_method === 'Cash' ? 'fas fa-money-bill-wave text-emerald-600' : 'fas fa-credit-card text-blue-600'"></i>
                    {{ order.payment_method }}
                  </span>
                </td>
                <td class="py-3 px-4 text-right font-mono font-bold text-gray-900">
                  Rs{{ order.net_total.toFixed(2) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
