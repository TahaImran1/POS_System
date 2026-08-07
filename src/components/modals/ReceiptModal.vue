<script setup lang="ts">
import { useSettingsStore } from '../../stores/useSettingsStore'

const props = defineProps<{
  show: boolean
  total: number
  subtotal?: number
  itemTaxes?: number
  globalGst?: number
  totalTaxes?: number
  items?: any[]
  tendered: number
  change: number
  method: string
  ticketName: string
}>()

const emit = defineEmits(['close'])
const settings = useSettingsStore()

const formatTime = () => {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
const formatDate = () => {
  return new Date().toLocaleDateString()
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Header -->
      <div class="bg-[#714B67] text-white p-5 flex flex-col items-center justify-center text-center">
        <div class="w-12 h-12 bg-emerald-400 text-gray-900 rounded-full flex items-center justify-center mb-2 font-black text-xl shadow-md">
          ✓
        </div>
        <h2 class="text-xl font-bold">Payment Successful</h2>
        <p class="text-white/80 text-xs">{{ method }} Payment Processed</p>
      </div>

      <!-- Receipt Mockup -->
      <div class="p-5 bg-gray-50 flex-1 relative max-h-[60vh] overflow-y-auto">
        <div class="bg-white p-5 shadow-sm border border-gray-200 rounded-xl text-xs space-y-3">
          
          <div class="text-center">
            <h3 class="font-black text-base text-gray-900 tracking-tight">{{ settings.storeName || 'Main Store Outlet' }}</h3>
            <p class="text-[11px] text-gray-500 font-mono mt-0.5">{{ formatDate() }} {{ formatTime() }}</p>
            <div class="inline-block px-2.5 py-0.5 bg-purple-50 text-[#714B67] font-bold rounded-full text-[10px] mt-1 border border-purple-100">
              Receipt / Ticket #{{ ticketName }}
            </div>
          </div>
          
          <div class="border-t border-dashed border-gray-300 my-2"></div>
          
          <!-- Detailed Items Table Breakdown -->
          <div>
            <div class="font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-2 flex justify-between">
              <span>Itemized Order</span>
              <span>Total Amount</span>
            </div>

            <div class="space-y-2">
              <div v-for="item in items" :key="item.id" class="flex justify-between items-start pb-2 border-b border-gray-100">
                <div>
                  <div class="font-bold text-gray-900 text-xs">{{ item.product?.name || 'Item' }}</div>
                  <div class="text-[10px] text-gray-500 font-mono">
                    {{ item.quantity }}x @ Rs{{ item.price.toFixed(2) }} (Tax: Rs{{ (item.tax * item.quantity).toFixed(2) }})
                  </div>
                </div>
                <div class="font-mono font-bold text-gray-900 text-xs">
                  Rs{{ (item.price * item.quantity).toFixed(2) }}
                </div>
              </div>
            </div>
          </div>

          <div class="border-t border-dashed border-gray-300 my-2"></div>
          
          <!-- Tax & Bill Calculation Details -->
          <div class="space-y-1.5 text-xs text-gray-600 font-mono">
            <div class="flex justify-between">
              <span>Items Subtotal:</span>
              <span class="font-bold text-gray-900">Rs{{ (subtotal || (total - (totalTaxes || 0))).toFixed(2) }}</span>
            </div>

            <div v-if="itemTaxes" class="flex justify-between text-indigo-700">
              <span>Individual Product Taxes:</span>
              <span class="font-bold">+Rs{{ itemTaxes.toFixed(2) }}</span>
            </div>

            <div v-if="globalGst" class="flex justify-between text-purple-700 font-bold">
              <span>Whole Bill Tax:</span>
              <span>+Rs{{ globalGst.toFixed(2) }}</span>
            </div>

            <div class="flex justify-between text-sm font-black text-gray-900 pt-2 border-t border-gray-300">
              <span>TOTAL DUE:</span>
              <span class="text-emerald-700 text-base">Rs{{ total.toFixed(2) }}</span>
            </div>

            <div v-if="method === 'Cash'" class="pt-2 space-y-1 text-xs border-t border-gray-100">
              <div class="flex justify-between text-gray-600">
                <span>Amount Tendered:</span>
                <span class="font-bold text-gray-900">Rs{{ tendered.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between font-extrabold text-emerald-700 text-sm">
                <span>Change Due:</span>
                <span>Rs{{ change.toFixed(2) }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Actions -->
      <div class="p-4 bg-white border-t border-gray-100 flex flex-col gap-2">
        <button class="w-full py-2.5 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-xs">
          <i class="fas fa-print"></i> Print Detailed Tax Receipt
        </button>
        <button @click="$emit('close')" class="w-full py-2.5 rounded-xl border border-gray-300 text-gray-800 font-bold hover:bg-gray-50 transition-colors text-xs">
          Next Order
        </button>
      </div>

    </div>
  </div>
</template>
