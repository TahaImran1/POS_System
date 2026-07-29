<script setup lang="ts">
const props = defineProps<{
  show: boolean
  guestCount?: number
}>()

const emit = defineEmits(['close', 'action'])

const handleAction = (actionName: string) => {
  emit('action', actionName)
  emit('close')
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Header -->
      <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
        <h2 class="text-lg font-bold text-gray-800">Actions</h2>
        <button @click="$emit('close')" class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
          <i class="fas fa-times text-base"></i>
        </button>
      </div>

      <!-- 3x3 Grid of Action Cards -->
      <div class="p-6 bg-gray-50/50 grid grid-cols-3 gap-4">
        
        <!-- 1. Customer Note -->
        <button 
          @click="handleAction('customer-note')"
          class="p-6 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <i class="fas fa-sticky-note text-gray-700 text-xl group-hover:scale-110 transition-transform"></i>
          <span class="font-bold text-gray-800 text-sm">Customer Note</span>
        </button>

        <!-- 2. Guests -->
        <button 
          @click="handleAction('guests')"
          class="p-6 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <div class="w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center font-bold text-xs">
            {{ guestCount || 1 }}
          </div>
          <span class="font-bold text-gray-800 text-sm">Guests</span>
        </button>

        <!-- 3. Transfer / Merge -->
        <button 
          @click="handleAction('transfer')"
          class="p-6 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <i class="fas fa-long-arrow-alt-right text-gray-700 text-xl group-hover:scale-110 transition-transform"></i>
          <span class="font-bold text-gray-800 text-sm">Transfer / Merge</span>
        </button>

        <!-- 4. Transfer Course -->
        <button 
          @click="handleAction('transfer-course')"
          class="p-6 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <i class="fas fa-arrow-down text-gray-700 text-xl group-hover:scale-110 transition-transform"></i>
          <span class="font-bold text-gray-800 text-sm">Transfer course</span>
        </button>

        <!-- 5. Edit Order Name -->
        <button 
          @click="handleAction('edit-name')"
          class="p-6 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <i class="fas fa-edit text-gray-700 text-xl group-hover:scale-110 transition-transform"></i>
          <span class="font-bold text-gray-800 text-sm">Edit Order Name</span>
        </button>

        <!-- 6. Quotation / Order -->
        <button 
          @click="handleAction('quotation')"
          class="p-6 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <i class="fas fa-link text-gray-700 text-xl group-hover:scale-110 transition-transform"></i>
          <span class="font-bold text-gray-800 text-sm">Quotation/Order</span>
        </button>

        <!-- 7. Pricelist -->
        <button 
          @click="handleAction('pricelist')"
          class="p-6 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <i class="fas fa-list text-gray-700 text-xl group-hover:scale-110 transition-transform"></i>
          <span class="font-bold text-gray-800 text-sm">Pricelist</span>
        </button>

        <!-- 8. Refund -->
        <button 
          @click="handleAction('refund')"
          class="p-6 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <i class="fas fa-undo text-gray-700 text-xl group-hover:scale-110 transition-transform"></i>
          <span class="font-bold text-gray-800 text-sm">Refund</span>
        </button>

        <!-- 9. Cancel Order -->
        <button 
          @click="handleAction('cancel')"
          class="p-6 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-2 group"
        >
          <i class="fas fa-trash-alt text-gray-700 text-xl group-hover:scale-110 transition-transform"></i>
          <span class="font-bold text-gray-800 text-sm">Cancel Order</span>
        </button>

      </div>
    </div>
  </div>
</template>
