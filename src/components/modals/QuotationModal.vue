<script setup lang="ts">
import { useToast } from '../../composables/useToast'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close'])
const toast = useToast()

const handleConfirm = () => {
  toast.success('Quotation created successfully!')
  emit('close')
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div class="bg-[#714B67] text-white p-4 flex justify-between items-center">
        <h2 class="font-bold text-lg flex items-center gap-2">
          <i class="fas fa-file-invoice"></i> Create Quotation / Order
        </h2>
        <button @click="$emit('close')" class="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-white">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="p-6 space-y-4 bg-gray-50">
        <p class="text-sm text-gray-600">Save current order lines as a Sales Order / Quotation in Odoo Backend.</p>
        
        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Expiration Date</label>
          <input type="date" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white" />
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Notes</label>
          <textarea placeholder="Add quotation terms..." class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white h-24"></textarea>
        </div>
      </div>

      <div class="p-4 bg-white border-t border-gray-200 flex justify-end gap-2">
        <button @click="$emit('close')" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-sm">
          Cancel
        </button>
        <button @click="handleConfirm" class="px-5 py-2 bg-[#017E84] hover:bg-[#00A09D] text-white font-bold rounded-lg text-sm shadow-sm">
          Confirm Quotation
        </button>
      </div>
    </div>
  </div>
</template>
