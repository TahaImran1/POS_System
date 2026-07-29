<script setup lang="ts">
import { ref, computed } from 'vue'

export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  city?: string
}

const props = defineProps<{
  show: boolean
  selectedCustomer?: Customer | null
}>()

const emit = defineEmits(['close', 'select-customer'])

const searchQuery = ref('')
const isCreating = ref(false)

// Mock/live customer list matching Odoo defaults
const customers = ref<Customer[]>([
  { id: '1', name: 'Flour Power', email: 'flour.power@example.com', phone: '+92 300 1234567', city: 'Lahore' },
  { id: '2', name: 'Deco Addict', email: 'deco.addict@example.com', phone: '+92 321 9876543', city: 'Karachi' },
  { id: '3', name: 'Azure Interior', email: 'azure.interior@example.com', phone: '+92 333 5551212', city: 'Islamabad' },
  { id: '4', name: 'Ready Mat', email: 'ready.mat@example.com', phone: '+92 301 4443322', city: 'Rawalpindi' }
])

// Form for creating new customer
const newCustomer = ref<Customer>({
  id: '',
  name: '',
  email: '',
  phone: '',
  city: ''
})

const filteredCustomers = computed(() => {
  if (!searchQuery.value.trim()) return customers.value
  const q = searchQuery.value.toLowerCase()
  return customers.value.filter(c => 
    c.name.toLowerCase().includes(q) || 
    c.phone?.includes(q) || 
    c.city?.toLowerCase().includes(q)
  )
})

const handleSelect = (customer: Customer) => {
  emit('select-customer', customer)
  emit('close')
}

const handleDeselect = () => {
  emit('select-customer', null)
  emit('close')
}

const handleSaveCustomer = () => {
  if (!newCustomer.value.name.trim()) return
  const created: Customer = {
    ...newCustomer.value,
    id: Math.random().toString(36).substring(2, 9)
  }
  customers.value.unshift(created)
  emit('select-customer', created)
  isCreating.value = false
  emit('close')
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Header -->
      <div class="bg-white border-b border-gray-200 p-4 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <h2 class="text-xl font-bold text-gray-800">Choose Customer</h2>
          <button 
            v-if="!isCreating"
            @click="isCreating = true" 
            class="px-4 py-1.5 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded-lg text-sm transition-colors shadow-sm"
          >
            + Create
          </button>
        </div>

        <!-- Search Bar -->
        <div v-if="!isCreating" class="relative w-72">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search Customers..." 
            class="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#714B67]"
          />
        </div>

        <button @click="$emit('close')" class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors">
          <i class="fas fa-times text-lg"></i>
        </button>
      </div>

      <!-- Content: Customer List or Create Form -->
      <div class="flex-1 overflow-y-auto p-4 bg-gray-50">
        <!-- Create Form -->
        <div v-if="isCreating" class="max-w-lg mx-auto bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 class="text-lg font-bold text-gray-900 mb-2">Create Customer</h3>
          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Customer Name *</label>
            <input v-model="newCustomer.name" type="text" placeholder="e.g. Flour Power" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-[#714B67] focus:border-[#714B67]" />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Phone Number</label>
            <input v-model="newCustomer.phone" type="text" placeholder="+92 300 0000000" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-[#714B67] focus:border-[#714B67]" />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Email Address</label>
            <input v-model="newCustomer.email" type="email" placeholder="customer@example.com" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-[#714B67] focus:border-[#714B67]" />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase mb-1">City</label>
            <input v-model="newCustomer.city" type="text" placeholder="Lahore" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-[#714B67] focus:border-[#714B67]" />
          </div>

          <div class="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button @click="isCreating = false" class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 font-bold hover:bg-gray-50 text-sm">
              Discard
            </button>
            <button @click="handleSaveCustomer" class="px-5 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded-md text-sm">
              Save Customer
            </button>
          </div>
        </div>

        <!-- Customer List Cards Grid -->
        <div v-else class="grid grid-cols-2 gap-3">
          <div 
            v-for="customer in filteredCustomers" 
            :key="customer.id"
            @click="handleSelect(customer)"
            :class="[
              'p-4 bg-white border rounded-xl cursor-pointer transition-all shadow-xs flex flex-col justify-between hover:border-[#714B67]',
              selectedCustomer?.id === customer.id ? 'border-2 border-[#714B67] bg-purple-50/40 ring-2 ring-[#714B67]/20' : 'border-gray-200'
            ]"
          >
            <div>
              <div class="font-bold text-gray-900 text-base mb-1">{{ customer.name }}</div>
              <div v-if="customer.phone" class="text-xs text-gray-500 flex items-center gap-1.5">
                <i class="fas fa-phone text-gray-400"></i> {{ customer.phone }}
              </div>
              <div v-if="customer.email" class="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                <i class="fas fa-envelope text-gray-400"></i> {{ customer.email }}
              </div>
            </div>

            <div v-if="customer.city" class="mt-3 text-xs text-gray-400 font-medium">
              <i class="fas fa-map-marker-alt text-gray-400"></i> {{ customer.city }}
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div v-if="!isCreating" class="p-4 bg-white border-t border-gray-200 flex justify-between items-center shrink-0">
        <button 
          v-if="selectedCustomer" 
          @click="handleDeselect" 
          class="px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 font-bold rounded-lg text-sm transition-colors"
        >
          Deselect Customer
        </button>
        <div v-else></div>

        <button @click="$emit('close')" class="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-sm transition-colors">
          Close
        </button>
      </div>

    </div>
  </div>
</template>
