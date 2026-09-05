<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { desc } from 'drizzle-orm'
import { getAllPriceHistory, getAllInventoryLogs, type PriceHistoryLogItem, type InventoryLogItem } from '../services/bomService'
import { useProductStore } from '../stores/useProductStore'
import { useToast } from '../composables/useToast'

const productStore = useProductStore()
const toast = useToast()

const activeReportTab = ref<'sales' | 'inventory' | 'price' | 'products'>('sales')
const timeRange = ref<'TODAY' | 'YESTERDAY' | '7DAYS' | '30DAYS' | 'ALL'>('7DAYS')
const isLoading = ref(true)

const salesData = ref<any[]>([])
const inventoryLogs = ref<InventoryLogItem[]>([])
const priceLogs = ref<PriceHistoryLogItem[]>([])

async function loadReportData() {
  isLoading.value = true
  try {
    await productStore.loadFromDb()
    
    // Load Sales from SQLite
    const sales = await db.select().from(schema.sales).orderBy(desc(schema.sales.created_at))
    salesData.value = sales

    // Load Inventory logs & Price logs
    inventoryLogs.value = await getAllInventoryLogs()
    priceLogs.value = await getAllPriceHistory()
  } catch (e) {
    console.error('Failed loading multi-dimensional report data:', e)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadReportData()
})

watch([activeReportTab, timeRange], () => {
  // Re-evaluate computations
})

// Time Filter helper
const timeCutoffMs = computed(() => {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  if (timeRange.value === 'TODAY') return now - dayMs
  if (timeRange.value === 'YESTERDAY') return now - (2 * dayMs)
  if (timeRange.value === '7DAYS') return now - (7 * dayMs)
  if (timeRange.value === '30DAYS') return now - (30 * dayMs)
  return 0
})

// Filtered Sales Data
const filteredSales = computed(() => {
  const cutoff = timeCutoffMs.value
  if (!cutoff) return salesData.value
  return salesData.value.filter(s => {
    const t = s.created_at ? new Date(s.created_at).getTime() : 0
    return t >= cutoff
  })
})

// Sales Metrics
const salesMetrics = computed(() => {
  const list = filteredSales.value
  const count = list.length
  const totalNet = list.reduce((sum, s) => sum + Number(s.net_total || 0), 0)
  const totalSubtotal = list.reduce((sum, s) => sum + Number(s.subtotal || 0), 0)
  const totalTax = list.reduce((sum, s) => sum + Number(s.tax_total || 0), 0)
  const avgOrderValue = count > 0 ? (totalNet / count) : 0

  const cashCount = list.filter(s => s.payment_method === 'Cash').length
  const cardCount = list.filter(s => s.payment_method === 'Card' || s.payment_method === 'Bank').length

  const cashTotal = list.filter(s => s.payment_method === 'Cash').reduce((sum, s) => sum + Number(s.net_total || 0), 0)
  const cardTotal = list.filter(s => s.payment_method === 'Card' || s.payment_method === 'Bank').reduce((sum, s) => sum + Number(s.net_total || 0), 0)

  return {
    count,
    totalNet,
    totalSubtotal,
    totalTax,
    avgOrderValue,
    cashCount,
    cardCount,
    cashTotal,
    cardTotal
  }
})

// Inventory Valuation & Movement Metrics
const inventoryValuationMetrics = computed(() => {
  const prods = productStore.products
  const totalAssetValuation = prods.reduce((sum, p) => sum + ((p.stock || 0) * p.price), 0)
  const totalUnitsInStock = prods.reduce((sum, p) => sum + (p.stock || 0), 0)
  const lowStockCount = prods.filter(p => (p.stock || 0) <= 10).length

  const cutoff = timeCutoffMs.value
  const filteredInvLogs = cutoff ? inventoryLogs.value.filter(l => new Date(l.created_at || 0).getTime() >= cutoff) : inventoryLogs.value

  const restockedVal = filteredInvLogs
    .filter(l => l.movement_type === 'RESTOCK' || l.movement_type === 'INITIAL_SEED')
    .reduce((sum, l) => sum + (Math.abs(l.quantity_change) * (productStore.products.find(p => p.id === l.product_id)?.price || 100)), 0)

  const wastageVal = filteredInvLogs
    .filter(l => l.movement_type === 'WASTAGE' || l.movement_type === 'STOCK_REDUCTION')
    .reduce((sum, l) => sum + (Math.abs(l.quantity_change) * (productStore.products.find(p => p.id === l.product_id)?.price || 100)), 0)

  return {
    totalAssetValuation,
    totalUnitsInStock,
    lowStockCount,
    restockedVal,
    wastageVal,
    movementCount: filteredInvLogs.length
  }
})

// Filtered Price History Logs
const filteredPriceLogs = computed(() => {
  const cutoff = timeCutoffMs.value
  if (!cutoff) return priceLogs.value
  return priceLogs.value.filter(l => new Date(l.created_at || 0).getTime() >= cutoff)
})

function printReport() {
  window.print()
}
</script>

<template>
  <div class="h-full w-full bg-[#f8f9fa] flex flex-col overflow-hidden font-sans text-gray-800">
    
    <!-- Top Bar & Dimensions Controller -->
    <div class="px-6 py-4 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between shrink-0 shadow-2xs gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-black text-gray-900 tracking-tight">📊 Multi-Dimensional Analytics & Reports</h1>
          <span class="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-extrabold">
            Executive View
          </span>
        </div>
        <p class="text-xs text-gray-500 mt-0.5">Filter sales, inventory valuation, stock movements, and price fluctuations across any dimension</p>
      </div>

      <!-- Dimensions Control Group -->
      <div class="flex flex-wrap items-center gap-3 text-xs">
        
        <!-- Dimension Category Tabs -->
        <div class="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 font-bold">
          <button 
            @click="activeReportTab = 'sales'"
            :class="[
              'px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5',
              activeReportTab === 'sales' ? 'bg-[#714B67] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            ]"
          >
            <i class="fas fa-[#2ECC71] fa-[#2ECC71] fa-chart-bar"></i>
            <span>Sales & Revenue</span>
          </button>

          <button 
            @click="activeReportTab = 'inventory'"
            :class="[
              'px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5',
              activeReportTab === 'inventory' ? 'bg-[#714B67] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            ]"
          >
            <i class="fas fa-boxes"></i>
            <span>Inventory Valuation</span>
          </button>

          <button 
            @click="activeReportTab = 'price'"
            :class="[
              'px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5',
              activeReportTab === 'price' ? 'bg-[#714B67] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            ]"
          >
            <i class="fas fa-tags"></i>
            <span>Price Fluctuation</span>
          </button>
        </div>

        <!-- Time Dimension Selector -->
        <div class="flex items-center gap-1.5">
          <label class="font-bold text-gray-600">Time Dimension:</label>
          <select 
            v-model="timeRange" 
            class="border border-gray-300 rounded-xl px-3 py-1.5 bg-white text-gray-900 font-bold focus:outline-none focus:border-[#714B67]"
          >
            <option value="TODAY">Today (Last 24h)</option>
            <option value="YESTERDAY">Yesterday</option>
            <option value="7DAYS">Last 7 Days</option>
            <option value="30DAYS">Last 30 Days</option>
            <option value="ALL">All Recorded Time</option>
          </select>
        </div>

        <button 
          @click="printReport"
          class="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl border border-gray-300 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <i class="fas fa-print"></i>
          <span>Print / Export</span>
        </button>
      </div>
    </div>

    <!-- MAIN DYNAMIC CONTENT -->
    <div class="flex-1 p-6 overflow-y-auto space-y-6">

      <!-- ==================== DIMENSION 1: SALES & REVENUE REPORT ==================== -->
      <div v-if="activeReportTab === 'sales'" class="space-y-6">
        
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Gross Sales Revenue</span>
            <div class="text-2xl font-black text-emerald-700 font-mono mt-1">Rs {{ salesMetrics.totalNet.toFixed(2) }}</div>
            <span class="text-[10px] text-gray-400 font-medium">Subtotal: Rs {{ salesMetrics.totalSubtotal.toFixed(2) }}</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Orders Processed</span>
            <div class="text-2xl font-black text-gray-900 font-mono mt-1">{{ salesMetrics.count }} Orders</div>
            <span class="text-[10px] text-gray-400 font-medium">Avg Order: Rs {{ salesMetrics.avgOrderValue.toFixed(2) }}</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Tax Collected</span>
            <div class="text-2xl font-black text-indigo-700 font-mono mt-1">+Rs {{ salesMetrics.totalTax.toFixed(2) }}</div>
            <span class="text-[10px] text-indigo-500 font-medium">GST & Item Tax Breakdown</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Cash vs Bank Distribution</span>
            <div class="text-xs font-bold text-gray-800 mt-2 space-y-1">
              <div class="flex justify-between">
                <span>💵 Cash ({{ salesMetrics.cashCount }}):</span>
                <strong class="font-mono text-emerald-700">Rs {{ salesMetrics.cashTotal.toFixed(2) }}</strong>
              </div>
              <div class="flex justify-between">
                <span>💳 Card/Bank ({{ salesMetrics.cardCount }}):</span>
                <strong class="font-mono text-indigo-700">Rs {{ salesMetrics.cardTotal.toFixed(2) }}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- Sales Transaction Table -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden text-xs">
          <div class="px-6 py-4 bg-slate-50 border-b border-gray-200 flex justify-between items-center">
            <h3 class="font-bold text-sm text-gray-900">Sales Transactions Ledger ({{ filteredSales.length }})</h3>
            <span class="text-xs font-mono font-bold text-teal-800">Dimension Filter Active</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead class="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th class="p-3.5">Sale Receipt #</th>
                  <th class="p-3.5">Date & Time</th>
                  <th class="p-3.5">Payment Method</th>
                  <th class="p-3.5 text-right">Subtotal</th>
                  <th class="p-3.5 text-right">Tax Total</th>
                  <th class="p-3.5 text-right">Net Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 font-medium">
                <tr v-if="filteredSales.length === 0">
                  <td colspan="6" class="p-8 text-center text-gray-400 font-bold">No sales transactions found in selected time dimension.</td>
                </tr>
                <tr v-for="s in filteredSales" :key="s.sale_id" class="hover:bg-slate-50/80">
                  <td class="p-3.5 font-mono font-bold text-gray-900">POS-{{ s.sale_id?.substr(0, 8).toUpperCase() }}</td>
                  <td class="p-3.5 text-gray-600 font-mono">{{ s.created_at ? new Date(s.created_at).toLocaleString() : '-' }}</td>
                  <td class="p-3.5">
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {{ s.payment_method }}
                    </span>
                  </td>
                  <td class="p-3.5 text-right font-mono text-gray-700">Rs {{ Number(s.subtotal || 0).toFixed(2) }}</td>
                  <td class="p-3.5 text-right font-mono text-indigo-600">+Rs {{ Number(s.tax_total || 0).toFixed(2) }}</td>
                  <td class="p-3.5 text-right font-mono font-black text-emerald-700 text-sm">Rs {{ Number(s.net_total || 0).toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- ==================== DIMENSION 2: INVENTORY VALUATION & MOVEMENT ==================== -->
      <div v-else-if="activeReportTab === 'inventory'" class="space-y-6">
        
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Stock Asset Valuation</span>
            <div class="text-2xl font-black text-purple-950 font-mono mt-1">Rs {{ inventoryValuationMetrics.totalAssetValuation.toFixed(2) }}</div>
            <span class="text-[10px] text-gray-400 font-medium">Total Qty: {{ inventoryValuationMetrics.totalUnitsInStock }} Pcs</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Restocked Stock Valuation</span>
            <div class="text-2xl font-black text-emerald-700 font-mono mt-1">+Rs {{ inventoryValuationMetrics.restockedVal.toFixed(2) }}</div>
            <span class="text-[10px] text-emerald-600 font-medium">Value of added inventory</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Wastage / Loss Valuation</span>
            <div class="text-2xl font-black text-rose-700 font-mono mt-1">-Rs {{ inventoryValuationMetrics.wastageVal.toFixed(2) }}</div>
            <span class="text-[10px] text-rose-600 font-medium">Value of reduced / damaged inventory</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Low Stock Risk Products</span>
            <div class="text-2xl font-black text-amber-600 font-mono mt-1">{{ inventoryValuationMetrics.lowStockCount }} Items</div>
            <span class="text-[10px] text-amber-700 font-semibold">Stock quantity &le; 10 Pcs</span>
          </div>
        </div>

        <!-- Inventory Catalog Stock Valuation Table -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden text-xs">
          <div class="px-6 py-4 bg-slate-50 border-b border-gray-200 flex justify-between items-center">
            <h3 class="font-bold text-sm text-gray-900">Current Catalog Asset Valuation Breakdown</h3>
            <span class="text-xs font-mono font-bold text-purple-800">{{ productStore.products.length }} Products</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead class="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th class="p-3.5">Product Name</th>
                  <th class="p-3.5">Barcode / SKU</th>
                  <th class="p-3.5">Category</th>
                  <th class="p-3.5 text-right">Current Stock</th>
                  <th class="p-3.5 text-right">Unit Price</th>
                  <th class="p-3.5 text-right">Total Asset Valuation</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 font-medium">
                <tr v-for="p in productStore.products" :key="p.id" class="hover:bg-slate-50/80">
                  <td class="p-3.5 font-bold text-gray-900">{{ p.name }}</td>
                  <td class="p-3.5 font-mono text-gray-500">#{{ p.barcode || 'N/A' }}</td>
                  <td class="p-3.5 text-gray-700 capitalize">{{ p.category }}</td>
                  <td class="p-3.5 text-right font-mono font-extrabold" :class="(p.stock || 0) <= 10 ? 'text-amber-600' : 'text-gray-900'">
                    {{ p.stock || 0 }} Pcs
                  </td>
                  <td class="p-3.5 text-right font-mono text-gray-700">Rs {{ p.price.toFixed(2) }}</td>
                  <td class="p-3.5 text-right font-mono font-black text-purple-900">Rs {{ ((p.stock || 0) * p.price).toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- ==================== DIMENSION 3: PRICE FLUCTUATION ANALYTICS ==================== -->
      <div v-else-if="activeReportTab === 'price'" class="space-y-6">
        
        <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs flex justify-between items-center">
          <div>
            <h3 class="font-bold text-base text-gray-900">Price Revisions Audit Report</h3>
            <p class="text-xs text-gray-500">Filtered by selected time dimension: {{ timeRange }}</p>
          </div>
          <div class="text-right">
            <span class="text-2xl font-black font-mono text-[#714B67]">{{ filteredPriceLogs.length }}</span>
            <span class="text-xs font-bold text-gray-500 block">Revision Events</span>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden text-xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead class="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th class="p-3.5">Date & Time</th>
                  <th class="p-3.5">Product Name</th>
                  <th class="p-3.5">Barcode / SKU</th>
                  <th class="p-3.5 text-right">Old Price</th>
                  <th class="p-3.5 text-right">New Price</th>
                  <th class="p-3.5 text-right">Revision Delta</th>
                  <th class="p-3.5">Reason Note</th>
                  <th class="p-3.5">Operator User</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 font-medium">
                <tr v-if="filteredPriceLogs.length === 0">
                  <td colspan="8" class="p-8 text-center text-gray-400 font-bold">No price fluctuation records found for selected time frame.</td>
                </tr>
                <tr v-for="item in filteredPriceLogs" :key="item.history_id" class="hover:bg-slate-50/80">
                  <td class="p-3.5 font-mono text-gray-700 whitespace-nowrap">{{ item.created_at ? new Date(item.created_at).toLocaleString() : '-' }}</td>
                  <td class="p-3.5 font-bold text-gray-900">{{ item.product_name }}</td>
                  <td class="p-3.5 font-mono text-gray-500">#{{ item.product_barcode || '-' }}</td>
                  <td class="p-3.5 text-right font-mono text-gray-500">Rs {{ item.old_price.toFixed(2) }}</td>
                  <td class="p-3.5 text-right font-mono font-bold text-gray-900">Rs {{ item.new_price.toFixed(2) }}</td>
                  <td class="p-3.5 text-right font-mono font-black">
                    <span 
                      class="px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-0.5 font-bold"
                      :class="item.price_delta >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'"
                    >
                      <span>{{ item.price_delta >= 0 ? '↑' : '↓' }}</span>
                      <span>Rs {{ Math.abs(item.price_delta).toFixed(2) }} ({{ item.price_delta_percent.toFixed(1) }}%)</span>
                    </span>
                  </td>
                  <td class="p-3.5 text-gray-600 text-xs">{{ item.change_reason || '-' }}</td>
                  <td class="p-3.5 text-gray-700 font-semibold">{{ item.user_name || 'Store Manager' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>

  </div>
</template>
