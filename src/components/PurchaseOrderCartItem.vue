<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePurchaseOrderStore, type POCartItem } from '../stores/usePurchaseOrderStore'
import type { ProductUOM } from '../services/uomService'

const props = defineProps<{
  item: POCartItem
}>()

const poStore = usePurchaseOrderStore()
const availableUoms = ref<ProductUOM[]>([])
const showUomMenu = ref(false)
const showVendorMenu = ref(false)

const isSelected = computed(() => poStore.selectedItemId === props.item.id)

onMounted(async () => {
  availableUoms.value = await poStore.getProductUomsFromCache(props.item.product.id)
})

const handleSelect = () => {
  poStore.selectItem(props.item.id)
}

const handleSetMode = (mode: 'qty' | 'cost' | 'price', e?: MouseEvent) => {
  if (e) e.stopPropagation()
  poStore.selectItem(props.item.id)
  poStore.setNumpadMode(mode)
}

const handleSelectUom = (uom: ProductUOM, e: MouseEvent) => {
  e.stopPropagation()
  poStore.setItemUom(props.item, uom)
  showUomMenu.value = false
}

const handleAssignVendor = (vendorId: string, e: MouseEvent) => {
  e.stopPropagation()
  poStore.assignVendorToItem(props.item.id, vendorId)
  showVendorMenu.value = false
}

// Line total cost
const lineTotalCost = computed(() => {
  return props.item.quantity * props.item.costPrice
})

// Line margin %
const lineMarginPercent = computed(() => {
  if (props.item.newPrice <= 0 || props.item.quantity <= 0) return 0
  const margin = ((props.item.newPrice - props.item.costPrice) / props.item.newPrice) * 100
  return Math.round(margin)
})
</script>

<template>
  <div 
    @click="handleSelect"
    :class="[
      'p-2.5 border-b border-gray-100 transition-all cursor-pointer relative group select-none',
      isSelected ? 'bg-purple-50/90 border-l-4 border-l-[#714B67]' : 'bg-white hover:bg-gray-50/80 border-l-4 border-l-transparent'
    ]"
  >
    <!-- Top Row: Direction Toggle, Product Name, UOM Switcher & Delete -->
    <div class="flex items-center justify-between gap-2 mb-1.5">
      <div class="flex items-center gap-1.5 flex-1 min-w-0">
        <!-- Restock (+) vs Reduce (-) Toggle Pill -->
        <button 
          @click.stop="poStore.toggleItemDirection(item)"
          :class="[
            'px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 transition-colors shadow-2xs cursor-pointer',
            item.direction === '+' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-rose-600 text-white hover:bg-rose-700'
          ]"
          :title="item.direction === '+' ? 'Restock Stock (+)' : 'Reduce / Return Stock (-)'"
        >
          <span>{{ item.direction === '+' ? '+ IN' : '- OUT' }}</span>
        </button>

        <span 
          class="font-extrabold text-xs truncate" 
          :class="item.quantity === 0 ? 'line-through text-gray-400' : 'text-gray-900'"
          :title="item.product.name"
        >
          {{ item.product.name }}
        </span>

        <!-- UOM Badge with Hover/Click Dropdown -->
        <div class="relative inline-block" @mouseenter="showUomMenu = true" @mouseleave="showUomMenu = false">
          <button 
            @click.stop="showUomMenu = !showUomMenu"
            class="px-2 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-200 rounded text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
            title="Click or hover to switch UOM tier"
          >
            <span>{{ item.uom_name }}</span>
            <span v-if="item.uom_multiplier > 1" class="text-[9px] font-mono text-purple-700">
              ({{ item.uom_multiplier }}x)
            </span>
            <i class="fas fa-chevron-down text-[7px]"></i>
          </button>

          <!-- UOM Dropdown Flyout -->
          <div 
            v-if="showUomMenu && availableUoms.length > 0"
            class="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-44 py-1 animate-in fade-in zoom-in-95 duration-100"
          >
            <div class="px-2.5 py-1 text-[9px] font-extrabold text-gray-400 uppercase tracking-wider border-b border-gray-100">
              Select UOM Tier
            </div>
            <button 
              v-for="uom in availableUoms"
              :key="uom.uom_id"
              @click="handleSelectUom(uom, $event)"
              :class="[
                'w-full text-left px-2.5 py-1.5 text-xs font-bold flex items-center justify-between transition-colors hover:bg-purple-50 cursor-pointer',
                uom.uom_name.toUpperCase() === item.uom_name.toUpperCase() ? 'bg-purple-100/70 text-[#714B67]' : 'text-gray-700'
              ]"
            >
              <span>{{ uom.uom_name }}</span>
              <span class="font-mono text-[10px] text-gray-500">{{ uom.multiplier_to_base }} Pcs</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Delete Button -->
      <button 
        @click.stop="poStore.removeItem(item.id)"
        class="text-gray-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
        title="Remove item"
      >
        <i class="fas fa-times text-xs"></i>
      </button>
    </div>

    <!-- Middle Row: Interactive Controls (Qty, Cost Rate, Selling Rate) -->
    <div class="grid grid-cols-3 gap-1.5 text-center mt-2">
      <!-- 1. Quantity Box -->
      <div 
        @click="handleSetMode('qty', $event)"
        :class="[
          'p-1 rounded-lg border transition-all cursor-pointer flex flex-col items-center justify-center',
          item.quantity === 0
            ? (isSelected && poStore.numpadMode === 'qty'
                ? 'bg-rose-700 text-white border-rose-800 shadow-sm ring-2 ring-rose-400'
                : 'bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-300 animate-pulse')
            : (isSelected && poStore.numpadMode === 'qty'
                ? 'bg-[#714B67] text-white border-[#714B67] shadow-sm ring-2 ring-purple-300'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-800')
        ]"
      >
        <span class="text-[9px] font-extrabold uppercase opacity-80">{{ item.quantity === 0 ? '0 Qty' : 'Quantity' }}</span>
        <span class="text-sm font-black font-mono">
          {{ item.quantity }}
        </span>
      </div>

      <!-- 2. Cost Rate Box (Purchasing Rate) -->
      <div 
        @click="handleSetMode('cost', $event)"
        :class="[
          'p-1 rounded-lg border transition-all cursor-pointer flex flex-col items-center justify-center',
          isSelected && poStore.numpadMode === 'cost'
            ? 'bg-purple-900 text-white border-purple-900 shadow-sm ring-2 ring-purple-400'
            : 'bg-purple-50/60 border-purple-200 hover:bg-purple-100 text-purple-950'
        ]"
      >
        <span class="text-[9px] font-extrabold uppercase opacity-80">Cost Rate</span>
        <span class="text-xs font-black font-mono">
          Rs {{ item.costPrice.toFixed(2) }}
        </span>
      </div>

      <!-- 3. Selling Rate Box (Retail Rate) -->
      <div 
        @click="handleSetMode('price', $event)"
        :class="[
          'p-1 rounded-lg border transition-all cursor-pointer flex flex-col items-center justify-center',
          isSelected && poStore.numpadMode === 'price'
            ? 'bg-teal-700 text-white border-teal-700 shadow-sm ring-2 ring-teal-300'
            : 'bg-teal-50/60 border-teal-200 hover:bg-teal-100 text-teal-900'
        ]"
      >
        <span class="text-[9px] font-extrabold uppercase opacity-80">Selling Rate</span>
        <span class="text-xs font-black font-mono">
          Rs {{ item.newPrice.toFixed(2) }}
        </span>
      </div>
    </div>

    <!-- Bottom Row: Vendor Assignment & Line Summary -->
    <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-gray-100 text-[11px]">
      <!-- Vendor Selector Dropdown -->
      <div class="relative inline-block">
        <button 
          @click.stop="showVendorMenu = !showVendorMenu"
          :class="[
            'px-2 py-0.5 rounded text-[10px] font-bold border transition-colors flex items-center gap-1 cursor-pointer truncate max-w-44',
            item.vendor_id ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-gray-100 text-gray-500 border-gray-300'
          ]"
          :title="item.vendor_name ? `Vendor: ${item.vendor_name}` : 'Click to assign vendor for this product'"
        >
          <i class="fas fa-truck text-[9px] text-amber-600"></i>
          <span class="truncate">{{ item.vendor_name || 'Assign Vendor' }}</span>
          <i class="fas fa-caret-down text-[8px]"></i>
        </button>

        <!-- Vendor Selection Flyout -->
        <div 
          v-if="showVendorMenu"
          class="absolute left-0 bottom-full mb-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-56 py-1 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
        >
          <div class="px-2.5 py-1 text-[9px] font-extrabold text-gray-400 uppercase tracking-wider border-b border-gray-100">
            Assign Vendor for {{ item.product.name }}
          </div>
          <button 
            v-for="v in poStore.vendors"
            :key="v.vendor_id"
            @click="handleAssignVendor(v.vendor_id, $event)"
            :class="[
              'w-full text-left px-2.5 py-1.5 text-xs font-bold flex items-center justify-between hover:bg-amber-50 cursor-pointer',
              item.vendor_id === v.vendor_id ? 'bg-amber-100/70 text-amber-950 font-black' : 'text-gray-700'
            ]"
          >
            <span class="truncate">{{ v.name }}</span>
            <span class="font-mono text-[10px] text-gray-400">Rs {{ v.balance.toFixed(0) }}</span>
          </button>
        </div>
      </div>

      <!-- Line Total & Margin -->
      <div class="flex items-center gap-2 font-mono">
        <span 
          v-if="item.quantity > 0"
          class="text-[10px] font-bold px-1 rounded"
          :class="lineMarginPercent >= 20 ? 'bg-emerald-100 text-emerald-800' : (lineMarginPercent > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')"
          title="Profit Margin"
        >
          Margin: {{ lineMarginPercent }}%
        </span>
        <span 
          v-else
          class="text-[9px] font-bold px-1 rounded bg-rose-100 text-rose-700"
          title="0 quantity line: press Clear or Backspace again to remove"
        >
          0 Qty
        </span>

        <span class="text-xs font-black text-gray-900" :class="item.quantity === 0 ? 'line-through text-gray-400' : ''">
          Rs {{ lineTotalCost.toFixed(2) }}
        </span>
      </div>
    </div>
  </div>
</template>
