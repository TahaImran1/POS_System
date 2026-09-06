<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useCartStore } from '../../stores/useCartStore'
import { useSessionStore } from '../../stores/useSessionStore'
import { useToast } from '../../composables/useToast'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close', 'success'])

const cart = useCartStore()
const session = useSessionStore()
const toast = useToast()

const tendered = ref(0)
const paymentMethod = ref('Cash')

// Automatically set tendered to cart.total whenever modal opens
watch(() => props.show, (newVal) => {
  if (newVal) {
    tendered.value = cart.total
  }
}, { immediate: true })

const changeReturn = computed(() => {
  return Math.max(0, tendered.value - cart.total)
})

const addTendered = (amount: number) => {
  tendered.value = amount
}

const handleTenderKey = (key: string) => {
  if (key === 'C') {
    tendered.value = 0
    return
  }
  const currentStr = tendered.value === 0 ? '' : tendered.value.toString()
  tendered.value = parseFloat(currentStr + key) || 0
}

const validateOrder = async () => {
  if (tendered.value < cart.total) {
    toast.warning('Insufficient funds tendered!')
    return
  }
  
  const currentTotal = cart.total
  const calculatedChange = Math.max(0, tendered.value - currentTotal)

  try {
    const result = await cart.checkout(paymentMethod.value)
    if (result) {
      emit('success', { 
        ...result, 
        total: currentTotal,
        tendered: tendered.value, 
        change: calculatedChange 
      })
    }
  } catch (error: any) {
    toast.error(error.message || 'Failed to checkout')
  }
}

// Physical keyboard listener when modal is open
const handleCheckoutKeydown = (e: KeyboardEvent) => {
  if (!props.show) return

  const target = e.target as HTMLElement
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
    return
  }

  if (e.key >= '0' && e.key <= '9') {
    handleTenderKey(e.key)
    e.preventDefault()
    return
  }

  if (e.key === '.' || e.key === ',') {
    handleTenderKey('.')
    e.preventDefault()
    return
  }

  if (e.key === 'Backspace' || e.key === 'Delete') {
    handleTenderKey('C')
    e.preventDefault()
    return
  }

  if (e.key === 'Enter') {
    validateOrder()
    e.preventDefault()
    return
  }

  if (e.key === 'Escape') {
    emit('close')
    e.preventDefault()
    return
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleCheckoutKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleCheckoutKeydown)
})
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
    <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col overflow-hidden max-h-[90vh]">
      
      <!-- Header -->
      <div class="bg-[#714B67] text-white p-4 flex items-center justify-between shrink-0">
        <button @click="$emit('close')" class="flex items-center gap-2 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors font-semibold">
          <i class="fas fa-arrow-left"></i> Back
        </button>
        <div class="text-xl font-bold">Payment Register</div>
        <div class="text-white/80 text-sm">Amount Due: <span class="font-bold text-white font-mono">Rs{{ cart.total.toFixed(2) }}</span></div>
      </div>

      <!-- Content -->
      <div class="flex flex-1 overflow-hidden">
        
        <!-- Left: Methods -->
        <div class="w-1/2 p-6 border-r border-gray-200 overflow-y-auto bg-gray-50">
          <h3 class="text-gray-500 font-semibold uppercase tracking-wider text-xs mb-4">Payment Method</h3>
          <div class="grid grid-cols-3 gap-2.5 mb-8">
            <button 
              @click="paymentMethod = 'Cash'"
              :class="['p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 font-bold transition-all text-xs', paymentMethod === 'Cash' ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-400' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300']"
            >
              <i class="fas fa-money-bill-wave text-xl text-emerald-600"></i>
              <span>Cash</span>
            </button>
            <button 
              @click="paymentMethod = 'Credit'"
              :class="['p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 font-bold transition-all text-xs', paymentMethod === 'Credit' ? 'border-[#714B67] bg-purple-50 text-[#714B67] ring-1 ring-purple-300' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300']"
            >
              <i class="fas fa-user-tag text-xl text-[#714B67]"></i>
              <span>Credit</span>
            </button>
            <button 
              @click="paymentMethod = 'Card'"
              :class="['p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 font-bold transition-all text-xs', paymentMethod === 'Card' ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-400' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300']"
            >
              <i class="fas fa-credit-card text-xl text-blue-600"></i>
              <span>Bank / Card</span>
            </button>
          </div>

          <h3 class="text-gray-500 font-semibold uppercase tracking-wider text-xs mb-4">Quick Cash</h3>
          <div class="flex flex-wrap gap-2">
            <button @click="addTendered(10)" class="px-4 py-2 bg-white border border-gray-200 rounded-lg font-bold text-gray-700 hover:bg-gray-50 shadow-sm">+Rs10</button>
            <button @click="addTendered(20)" class="px-4 py-2 bg-white border border-gray-200 rounded-lg font-bold text-gray-700 hover:bg-gray-50 shadow-sm">+Rs20</button>
            <button @click="addTendered(50)" class="px-4 py-2 bg-white border border-gray-200 rounded-lg font-bold text-gray-700 hover:bg-gray-50 shadow-sm">+Rs50</button>
            <button @click="addTendered(100)" class="px-4 py-2 bg-white border border-gray-200 rounded-lg font-bold text-gray-700 hover:bg-gray-50 shadow-sm">+Rs100</button>
            <button @click="addTendered(cart.total)" class="px-4 py-2 bg-[#017E84] text-white rounded-lg font-bold shadow-sm hover:bg-[#00A09D]">Exact</button>
          </div>
        </div>

        <!-- Right: Calculation & Numpad -->
        <div class="w-1/2 bg-white flex flex-col">
          <div class="p-6 bg-gray-50/50 border-b border-gray-200">
            <div class="flex justify-between items-center mb-2">
              <span class="text-gray-500 font-semibold">Tendered:</span>
              <span class="text-2xl font-bold font-mono text-gray-800">Rs{{ tendered.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-500 font-semibold">Change Return:</span>
              <span class="text-3xl font-bold font-mono text-emerald-600">Rs{{ changeReturn.toFixed(2) }}</span>
            </div>
          </div>

          <!-- Numpad for Tender -->
          <div class="flex-1 grid grid-cols-3 p-4 gap-2">
            <button @click="handleTenderKey('1')" class="bg-gray-100 rounded-xl text-xl font-bold text-gray-700 hover:bg-gray-200">1</button>
            <button @click="handleTenderKey('2')" class="bg-gray-100 rounded-xl text-xl font-bold text-gray-700 hover:bg-gray-200">2</button>
            <button @click="handleTenderKey('3')" class="bg-gray-100 rounded-xl text-xl font-bold text-gray-700 hover:bg-gray-200">3</button>
            <button @click="handleTenderKey('4')" class="bg-gray-100 rounded-xl text-xl font-bold text-gray-700 hover:bg-gray-200">4</button>
            <button @click="handleTenderKey('5')" class="bg-gray-100 rounded-xl text-xl font-bold text-gray-700 hover:bg-gray-200">5</button>
            <button @click="handleTenderKey('6')" class="bg-gray-100 rounded-xl text-xl font-bold text-gray-700 hover:bg-gray-200">6</button>
            <button @click="handleTenderKey('7')" class="bg-gray-100 rounded-xl text-xl font-bold text-gray-700 hover:bg-gray-200">7</button>
            <button @click="handleTenderKey('8')" class="bg-gray-100 rounded-xl text-xl font-bold text-gray-700 hover:bg-gray-200">8</button>
            <button @click="handleTenderKey('9')" class="bg-gray-100 rounded-xl text-xl font-bold text-gray-700 hover:bg-gray-200">9</button>
            <button @click="handleTenderKey('.')" class="bg-gray-100 rounded-xl text-xl font-bold text-gray-700 hover:bg-gray-200">.</button>
            <button @click="handleTenderKey('0')" class="bg-gray-100 rounded-xl text-xl font-bold text-gray-700 hover:bg-gray-200">0</button>
            <button @click="handleTenderKey('C')" class="bg-red-50 text-red-600 rounded-xl text-xl font-bold hover:bg-red-100"><i class="fas fa-backspace"></i></button>
          </div>

          <div class="p-4 pt-0">
            <button 
              @click="validateOrder"
              :disabled="tendered < cart.total"
              :class="['w-full py-4 rounded-xl text-xl font-bold shadow-sm transition-all flex items-center justify-center gap-3', tendered >= cart.total ? 'bg-[#017E84] hover:bg-[#00A09D] text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed']"
            >
              <i class="fas fa-check-circle"></i>
              Validate Order
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
