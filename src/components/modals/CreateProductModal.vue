<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProductStore, type Product } from '../../stores/useProductStore'
import { db } from '../../db/client'
import * as schema from '../../db/schema'
import { v4 as uuidv4 } from 'uuid'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close', 'product-created'])
const productStore = useProductStore()

const productName = ref('')
const barcode = ref('')
const trackInventory = ref(true)
const salesPrice = ref<number | ''>(1.00)
const salesTaxRate = ref(10) // 10% VAT
const posCategory = ref('misc')
const colorTag = ref('#ffffff')
const imageUrl = ref('')
const isSaving = ref(false)

const priceWithTax = computed(() => {
  const p = Number(salesPrice.value) || 0
  const tax = p * (salesTaxRate.value / 100)
  return (p + tax).toFixed(2)
})

const resetForm = () => {
  productName.value = ''
  barcode.value = ''
  trackInventory.value = true
  salesPrice.value = 1.00
  posCategory.value = 'misc'
  imageUrl.value = ''
}

const handleSave = async () => {
  if (!productName.value.trim()) {
    alert('Please enter a product name.')
    return
  }

  isSaving.value = true
  try {
    const newId = uuidv4()
    const finalPrice = Number(salesPrice.value) || 0
    const finalBarcode = barcode.value.trim() || `OD${Math.floor(1000 + Math.random() * 9000)}`
    const defaultImage = imageUrl.value.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(productName.value)}&background=f1f3f5&color=495057&size=128`
    const taxAmt = finalPrice * (salesTaxRate.value / 100)

    try {
      await db.insert(schema.products).values({
        product_id: newId,
        name: productName.value.trim(),
        product_type: trackInventory.value ? 'FINISHED_GOOD' : 'SERVICE',
        default_price: finalPrice,
        uom: 'PCS',
        barcode: finalBarcode,
        image: defaultImage,
        description: productName.value.trim()
      })
    } catch (dbErr) {
      console.warn('SQLite insert note (updating store):', dbErr)
    }

    const newProdObj: Product = {
      id: newId,
      sku: finalBarcode,
      barcode: finalBarcode,
      name: productName.value.trim(),
      category: posCategory.value,
      price: finalPrice,
      type: trackInventory.value ? 'FINISHED_GOOD' : 'SERVICE',
      stock: 100,
      taxGroupId: '',
      image: defaultImage,
      description: productName.value.trim(),
      taxAmount: taxAmt
    }

    productStore.products.unshift(newProdObj)
    productStore.setCategory(posCategory.value)

    emit('product-created', newProdObj)
    resetForm()
    emit('close')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      
      <!-- Modal Header matching Odoo (Clean White with title & close icon) -->
      <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
        <h2 class="font-bold text-lg text-gray-900">New Product</h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-700 transition-colors">
          <i class="fas fa-times text-lg"></i>
        </button>
      </div>

      <!-- Modal Content matching Odoo exact layout -->
      <div class="p-6 bg-white flex gap-6">
        
        <!-- Left Side: Form Fields -->
        <div class="flex-1 space-y-3.5 text-sm text-gray-800">
          
          <!-- Product Name -->
          <div class="grid grid-cols-12 items-center gap-2">
            <label class="col-span-4 font-bold text-gray-900 text-xs">Product Name</label>
            <input 
              v-model="productName" 
              type="text" 
              placeholder="e.g. Cheese Burger" 
              class="col-span-8 border-b border-gray-300 px-1 py-1 text-sm focus:outline-none focus:border-[#714B67] bg-transparent"
              required 
            />
          </div>

          <!-- Barcode -->
          <div class="grid grid-cols-12 items-center gap-2">
            <label class="col-span-4 font-bold text-gray-900 text-xs">Barcode</label>
            <div class="col-span-8 flex items-center gap-2 border-b border-gray-300 py-1">
              <input 
                v-model="barcode" 
                type="text" 
                placeholder="e.g. 1234567890" 
                class="flex-1 px-1 text-sm focus:outline-none bg-transparent" 
              />
              <i class="fas fa-barcode text-gray-500"></i>
            </div>
          </div>

          <!-- Track Inventory -->
          <div class="grid grid-cols-12 items-center gap-2">
            <div class="col-span-4 font-bold text-gray-900 text-xs flex items-center gap-1">
              <span>Track Inventory</span>
              <span class="text-[#017E84] text-[10px] font-bold cursor-pointer" title="Enable stock tracking">?</span>
            </div>
            <div class="col-span-8 flex items-center gap-2 text-xs">
              <input v-model="trackInventory" type="checkbox" id="trackInv" class="w-4 h-4 text-[#017E84] rounded border-gray-300" />
              <label for="trackInv" class="font-medium text-gray-700">By Quantity</label>
            </div>
          </div>

          <!-- Sales Price -->
          <div class="grid grid-cols-12 items-center gap-2">
            <div class="col-span-4 font-bold text-gray-900 text-xs flex items-center gap-1">
              <span>Sales Price</span>
              <span class="text-[#017E84] text-[10px] font-bold cursor-pointer" title="Base sales price">?</span>
            </div>
            <input 
              v-model.number="salesPrice" 
              type="number" 
              step="0.01" 
              min="0"
              class="col-span-8 border-b border-gray-300 px-1 py-1 text-sm focus:outline-none focus:border-[#714B67] bg-transparent font-mono" 
            />
          </div>

          <!-- Sales Taxes -->
          <div class="grid grid-cols-12 items-center gap-2">
            <div class="col-span-4 font-bold text-gray-900 text-xs flex items-center gap-1">
              <span>Sales Taxes</span>
              <span class="text-[#017E84] text-[10px] font-bold cursor-pointer" title="Customer sales tax">?</span>
            </div>
            <div class="col-span-8 flex items-center gap-3 text-xs">
              <span class="px-2 py-0.5 bg-gray-200 text-gray-800 rounded-full font-bold flex items-center gap-1">
                {{ salesTaxRate }}% <i class="fas fa-times cursor-pointer text-[10px]" @click="salesTaxRate = 0"></i>
              </span>
              <span class="text-gray-500 font-mono text-[11px]">(= {{ priceWithTax }} Rs. Incl. Taxes)</span>
            </div>
          </div>

          <!-- POS Category -->
          <div class="grid grid-cols-12 items-center gap-2">
            <div class="col-span-4 font-bold text-gray-900 text-xs flex items-center gap-1">
              <span>POS Category</span>
              <span class="text-[#017E84] text-[10px] font-bold cursor-pointer" title="Category in POS catalog">?</span>
            </div>
            <select 
              v-model="posCategory" 
              class="col-span-8 border-b border-gray-300 px-1 py-1 text-sm focus:outline-none focus:border-[#714B67] bg-transparent capitalize"
            >
              <option value="misc">Misc</option>
              <option value="desks">Desks</option>
              <option value="chairs">Chairs</option>
            </select>
          </div>

          <!-- Color -->
          <div class="grid grid-cols-12 items-center gap-2">
            <label class="col-span-4 font-bold text-gray-900 text-xs">Color</label>
            <div class="col-span-8 flex items-center gap-2">
              <input v-model="colorTag" type="color" class="w-6 h-6 rounded-full border border-gray-300 cursor-pointer p-0" />
            </div>
          </div>

        </div>

        <!-- Right Side: Camera Image Upload Box matching Odoo -->
        <div class="w-32 flex flex-col items-center shrink-0">
          <div class="w-28 h-28 bg-[#f8f9fa] border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 relative overflow-hidden group cursor-pointer hover:border-[#714B67]">
            <img v-if="imageUrl" :src="imageUrl" class="w-full h-full object-cover" />
            <template v-else>
              <i class="fas fa-camera text-3xl mb-1 text-gray-300"></i>
              <span class="text-[10px] text-gray-400 font-semibold">+ Image</span>
            </template>
          </div>
        </div>

      </div>

      <!-- Footer Buttons matching Odoo (`Save` in `#714B67` purple, `Discard` in light grey) -->
      <div class="px-6 py-3 bg-[#f8f9fa] border-t border-gray-200 flex justify-start gap-2">
        <button 
          @click="handleSave" 
          :disabled="isSaving"
          class="px-5 py-1.5 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded text-sm transition-colors shadow-sm flex items-center gap-2"
        >
          <i v-if="isSaving" class="fas fa-spinner fa-spin"></i>
          <span>Save</span>
        </button>
        <button 
          @click="$emit('close')" 
          class="px-5 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold rounded text-sm transition-colors shadow-xs"
        >
          Discard
        </button>
      </div>

    </div>
  </div>
</template>
