<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useCartStore } from '../stores/useCartStore'
import type { CartItem } from '../stores/useCartStore'
import { getProductUOMs, type ProductUOM } from '../services/uomService'

const props = defineProps<{
  item: CartItem
}>()

const cart = useCartStore()
const availableUoms = ref<ProductUOM[]>([])
const showUomSelector = ref(false)

const isSelected = computed(() => cart.selectedItemId === props.item.id)

async function loadUoms() {
  if (props.item.product && props.item.product.id) {
    availableUoms.value = await getProductUOMs(props.item.product.id)
    if (availableUoms.value.length > 0 && !props.item.uom_name) {
      const defaultUom = availableUoms.value.find(u => u.is_base_uom) || availableUoms.value[0]
      props.item.uom_id = defaultUom.uom_id
      props.item.uom_name = defaultUom.uom_name
      props.item.uom_multiplier = defaultUom.multiplier_to_base
    }
  }
}

onMounted(() => {
  loadUoms()
})

watch(() => props.item.product.id, () => {
  loadUoms()
})

const selectItem = () => {
  cart.setSelectedItemId(props.item.id)
}

function selectUomTier(uom: ProductUOM) {
  props.item.uom_id = uom.uom_id
  props.item.uom_name = uom.uom_name
  props.item.uom_multiplier = uom.multiplier_to_base
  props.item.price = Number(uom.selling_price || props.item.product.price)
  showUomSelector.value = false
}
</script>

<template>
  <div 
    @click="selectItem"
    :class="[
      'flex justify-between items-start px-4 py-3 cursor-pointer transition-colors text-sm border-b border-gray-100 relative group',
      isSelected ? 'bg-purple-50/80 text-gray-900 font-medium' : 'bg-white text-gray-700 hover:bg-gray-50'
    ]"
  >
    <div class="flex gap-3 flex-1">
      <div 
        :class="[
          'font-bold min-w-6 text-center rounded px-1.5 py-0.5 self-start text-xs',
          item.quantity === 0 ? 'bg-red-100 text-red-700 ring-1 ring-red-300 animate-pulse font-mono' : 'bg-gray-100 text-gray-800'
        ]"
      >
        {{ item.quantity }}
      </div>

      <div class="flex-1 flex flex-col">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold text-gray-900 text-xs" :class="item.quantity === 0 ? 'line-through text-gray-400' : ''">
            {{ item.product.name }}
          </span>

          <!-- Active UOM Tier Badge & Switcher Button -->
          <div class="relative">
            <button 
              @click.stop="showUomSelector = !showUomSelector"
              class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200 hover:bg-purple-200 flex items-center gap-1 transition-colors cursor-pointer"
              title="Click to select Upper Hierarchy UOM Tier"
            >
              <span>{{ item.uom_name || item.product.uom || 'PCS' }}</span>
              <span v-if="item.uom_multiplier && item.uom_multiplier > 1" class="text-purple-700 font-mono text-[9px]">
                ({{ item.uom_multiplier }} Pcs)
              </span>
              <i class="fas fa-chevron-down text-[8px] ml-0.5"></i>
            </button>

            <!-- UOM Hierarchy Selector Dropdown Menu -->
            <div 
              v-if="showUomSelector" 
              class="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[90] min-w-48 overflow-hidden animate-in fade-in zoom-in-95 duration-100 p-1 text-xs"
            >
              <div class="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                Select UOM Tier
              </div>

              <button 
                v-for="uom in availableUoms"
                :key="uom.uom_id"
                @click.stop="selectUomTier(uom)"
                :class="[
                  'w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer text-xs font-semibold',
                  item.uom_id === uom.uom_id ? 'bg-[#714B67] text-white font-bold' : 'hover:bg-gray-100 text-gray-800'
                ]"
              >
                <div class="flex items-center gap-1.5">
                  <i class="fas" :class="uom.multiplier_to_base > 1 ? 'fa-box-open text-amber-400' : 'fa-cube text-purple-300'"></i>
                  <span>{{ uom.uom_name }}</span>
                </div>
                <div class="font-mono text-[11px]">
                  <span>Rs {{ uom.selling_price }}</span>
                  <span class="text-[9px] opacity-75 ml-1">({{ uom.multiplier_to_base }} Pcs)</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <span v-if="item.product.description" class="text-[11px] text-gray-500 mt-0.5 line-clamp-1">- {{ item.product.description }}</span>
        <span v-if="item.discount > 0" class="text-[11px] text-red-600 font-bold mt-0.5">Discount: {{ Math.min(100, Math.max(0, item.discount)) }}%</span>
      </div>
    </div>

    <div class="font-bold text-right ml-3 text-xs" :class="item.quantity === 0 ? 'text-gray-400 font-mono' : 'text-gray-900'">
      <div>{{ (item.quantity * item.price * (1 - Math.min(100, Math.max(0, item.discount)) / 100)).toFixed(2) }} Rs.</div>
      <div v-if="item.uom_multiplier && item.uom_multiplier > 1" class="text-[9px] text-gray-400 font-normal font-mono">
        Rs {{ item.price }}/{{ item.uom_name }}
      </div>
    </div>
  </div>
</template>
