<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  show: boolean
  initialBreakdown?: Record<number, number>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', payload: { total: number; breakdown: Record<number, number> }): void
}>()

// Requested bill denominations: 5000, 1000, 500, 100, 50, 20, 10
const denominations = [5000, 1000, 500, 100, 50, 20, 10]

const counts = ref<Record<number, number>>({
  5000: 0,
  1000: 0,
  500: 0,
  100: 0,
  50: 0,
  20: 0,
  10: 0
})

// Initialize or reset counts when modal opens
watch(() => props.show, (newVal) => {
  if (newVal) {
    if (props.initialBreakdown) {
      denominations.forEach(d => {
        counts.value[d] = Math.max(0, Number(props.initialBreakdown?.[d]) || 0)
      })
    } else {
      denominations.forEach(d => {
        counts.value[d] = 0
      })
    }
  }
}, { immediate: true })

const increment = (denom: number) => {
  counts.value[denom] = (counts.value[denom] || 0) + 1
}

const decrement = (denom: number) => {
  if ((counts.value[denom] || 0) > 0) {
    counts.value[denom] = (counts.value[denom] || 0) - 1
  }
}

const updateInput = (denom: number, val: any) => {
  const parsed = parseInt(val)
  counts.value[denom] = isNaN(parsed) || parsed < 0 ? 0 : parsed
}

const totalAmount = computed(() => {
  return denominations.reduce((sum, denom) => {
    return sum + (denom * (counts.value[denom] || 0))
  }, 0)
})

const handleConfirm = () => {
  emit('confirm', {
    total: totalAmount.value,
    breakdown: { ...counts.value }
  })
  emit('close')
}

const handleReset = () => {
  denominations.forEach(d => {
    counts.value[d] = 0
  })
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150 border border-gray-200 flex flex-col">
      
      <!-- Modal Header matching Odoo Coins/Notes 1:1 -->
      <div class="px-6 py-4 bg-white border-b border-gray-100 flex justify-between items-center">
        <h3 class="font-bold text-lg text-gray-900 tracking-tight">Coins/Notes</h3>
        <button 
          @click="$emit('close')" 
          class="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
          title="Close"
        >
          <i class="fas fa-times text-base"></i>
        </button>
      </div>

      <!-- Denominations Grid (Matching Screenshot) -->
      <div class="p-6 bg-white space-y-6 flex-1">
        
        <!-- Two Column Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
          
          <!-- Column 1: 5000, 1000, 500, 100 -->
          <div class="space-y-3.5">
            <div 
              v-for="denom in [5000, 1000, 500, 100]" 
              :key="denom"
              class="flex items-center justify-between gap-2"
            >
              <!-- Stepper Counter Box: [-] [ 0 ] [+] -->
              <div class="flex items-center border border-gray-300 rounded overflow-hidden shadow-2xs">
                <button 
                  type="button"
                  @click="decrement(denom)"
                  class="w-8 h-8 bg-gray-50 hover:bg-gray-200 active:bg-gray-300 text-gray-600 font-bold flex items-center justify-center transition-colors cursor-pointer border-r border-gray-300 select-none text-sm"
                  title="Decrease"
                >
                  <i class="fas fa-minus text-xs"></i>
                </button>

                <input 
                  :value="counts[denom]" 
                  @input="e => updateInput(denom, (e.target as HTMLInputElement).value)"
                  type="number" 
                  min="0"
                  class="w-14 h-8 text-center font-mono font-bold text-gray-800 text-sm focus:outline-none bg-white select-all"
                />

                <button 
                  type="button"
                  @click="increment(denom)"
                  class="w-8 h-8 bg-gray-50 hover:bg-gray-200 active:bg-gray-300 text-gray-600 font-bold flex items-center justify-center transition-colors cursor-pointer border-l border-gray-300 select-none text-sm"
                  title="Increase"
                >
                  <i class="fas fa-plus text-xs"></i>
                </button>
              </div>

              <!-- Denomination Label & Subtotal -->
              <div class="flex-1 text-right">
                <span class="font-bold text-sm text-gray-900 font-mono">
                  {{ denom.toFixed(2) }} Rs.
                </span>
                <span 
                  v-if="(counts[denom] || 0) > 0" 
                  class="block text-[10px] text-purple-800 font-mono font-bold"
                >
                  = Rs {{ (denom * (counts[denom] || 0)).toLocaleString() }}
                </span>
              </div>
            </div>
          </div>

          <!-- Column 2: 50, 20, 10 -->
          <div class="space-y-3.5">
            <div 
              v-for="denom in [50, 20, 10]" 
              :key="denom"
              class="flex items-center justify-between gap-2"
            >
              <!-- Stepper Counter Box: [-] [ 0 ] [+] -->
              <div class="flex items-center border border-gray-300 rounded overflow-hidden shadow-2xs">
                <button 
                  type="button"
                  @click="decrement(denom)"
                  class="w-8 h-8 bg-gray-50 hover:bg-gray-200 active:bg-gray-300 text-gray-600 font-bold flex items-center justify-center transition-colors cursor-pointer border-r border-gray-300 select-none text-sm"
                  title="Decrease"
                >
                  <i class="fas fa-minus text-xs"></i>
                </button>

                <input 
                  :value="counts[denom]" 
                  @input="e => updateInput(denom, (e.target as HTMLInputElement).value)"
                  type="number" 
                  min="0"
                  class="w-14 h-8 text-center font-mono font-bold text-gray-800 text-sm focus:outline-none bg-white select-all"
                />

                <button 
                  type="button"
                  @click="increment(denom)"
                  class="w-8 h-8 bg-gray-50 hover:bg-gray-200 active:bg-gray-300 text-gray-600 font-bold flex items-center justify-center transition-colors cursor-pointer border-l border-gray-300 select-none text-sm"
                  title="Increase"
                >
                  <i class="fas fa-plus text-xs"></i>
                </button>
              </div>

              <!-- Denomination Label & Subtotal -->
              <div class="flex-1 text-right">
                <span class="font-bold text-sm text-gray-900 font-mono">
                  {{ denom.toFixed(2) }} Rs.
                </span>
                <span 
                  v-if="(counts[denom] || 0) > 0" 
                  class="block text-[10px] text-purple-800 font-mono font-bold"
                >
                  = Rs {{ (denom * (counts[denom] || 0)).toLocaleString() }}
                </span>
              </div>
            </div>

            <!-- Clear All Quick Action -->
            <div class="pt-2 text-right">
              <button 
                type="button"
                @click="handleReset"
                class="text-[11px] font-bold text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                title="Reset all bills to 0"
              >
                <i class="fas fa-undo-alt mr-1"></i>
                <span>Reset Counts</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      <!-- Footer Matching Screenshot 1:1: [Confirm] ... [Total 0.00 Rs.] -->
      <div class="px-6 py-4 bg-white border-t border-gray-100 flex items-center justify-between">
        <button 
          @click="handleConfirm"
          class="px-6 py-2.5 bg-[#714B67] hover:bg-[#5c3d54] active:bg-[#4a3144] text-white font-bold rounded-lg text-sm transition-colors shadow-sm cursor-pointer"
        >
          Confirm
        </button>

        <div class="text-right">
          <span class="font-extrabold text-base sm:text-lg text-gray-900 font-mono">
            Total {{ totalAmount.toFixed(2) }} Rs.
          </span>
        </div>
      </div>

    </div>
  </div>
</template>
