<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useProductStore, type Product } from '../../stores/useProductStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { taxService, type TaxGroup } from '../../services/taxService'
import ManagerPinModal from './ManagerPinModal.vue'
import { db } from '../../db/client'
import * as schema from '../../db/schema'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useToast } from '../../composables/useToast'

import { getProductUOMs, saveProductUOMs, type ProductUOM } from '../../services/uomService'

const props = defineProps<{
  show: boolean
  editProduct?: Product | null   // if set, modal operates in edit mode
}>()

const emit = defineEmits(['close', 'product-created', 'product-updated'])
const productStore = useProductStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const toast = useToast()

const productName = ref('')
const barcode = ref('')
const trackInventory = ref(true)
const productType = ref<'FINISHED_GOOD' | 'SERVICE' | 'RAW_MATERIAL'>('FINISHED_GOOD')
const salesPrice = ref<number | ''>(150.00)
const initialStock = ref<number>(50)
const salesTaxRate = ref(5) // 5%, 10%, 12%
const selectedTaxGroupId = ref('')
const posCategory = ref('beverages')
const customCategory = ref('')
const imageUrl = ref('')
const isSaving = ref(false)
const availableTaxGroups = ref<TaxGroup[]>([])

// Nested UOM Hierarchy State
export interface UomTierItem {
  uom_id?: string
  uom_name: string
  multiplier_to_base: number
  cost_price: number
  selling_price: number
  barcode: string
  is_base_uom: boolean
}

const baseUomName = ref('PCS')
const uomTiers = ref<UomTierItem[]>([
  { uom_name: 'Piece', multiplier_to_base: 1, cost_price: 0, selling_price: 0, barcode: '', is_base_uom: true }
])

function addUomTier() {
  uomTiers.value.push({
    uom_name: 'Pack',
    multiplier_to_base: 12,
    cost_price: 0,
    selling_price: 0,
    barcode: '',
    is_base_uom: false
  })
}

function removeUomTier(index: number) {
  if (uomTiers.value[index].is_base_uom) return
  uomTiers.value.splice(index, 1)
}

const isManagerPinModalOpen = ref(false)
const isEditMode = computed(() => !!props.editProduct)

async function loadTaxes() {
  try {
    const groups = await taxService.getTaxGroups()
    availableTaxGroups.value = groups.filter(g => g.tax_type !== 'BILL')
    
    if (props.editProduct) {
      try {
        const pt = await db.select().from(schema.product_taxes).where(eq(schema.product_taxes.product_id, props.editProduct.id)).get()
        if (pt) {
          selectedTaxGroupId.value = pt.tax_group_id
          const matched = availableTaxGroups.value.find(g => g.tax_group_id === pt.tax_group_id)
          if (matched) {
            salesTaxRate.value = matched.rate_percentage
          }
        }
      } catch (e) {
        console.warn('Could not read product tax association:', e)
      }
    } else if (availableTaxGroups.value.length > 0 && !selectedTaxGroupId.value) {
      selectedTaxGroupId.value = availableTaxGroups.value[0].tax_group_id
      salesTaxRate.value = availableTaxGroups.value[0].rate_percentage
    }
  } catch (e) {
    console.warn('Failed to load tax groups:', e)
  }
}

async function loadProductUoms(productId: string) {
  try {
    const fetched = await getProductUOMs(productId)
    if (fetched.length > 0) {
      uomTiers.value = fetched.map(u => ({
        uom_id: u.uom_id,
        uom_name: u.uom_name,
        multiplier_to_base: u.multiplier_to_base,
        cost_price: u.cost_price,
        selling_price: u.selling_price,
        barcode: '',
        is_base_uom: u.is_base_uom
      }))
    }
  } catch (e) {
    console.warn('Could not load UOMs for product:', e)
  }
}

function handleTaxGroupChange() {
  const tg = availableTaxGroups.value.find(g => g.tax_group_id === selectedTaxGroupId.value)
  if (tg) {
    salesTaxRate.value = tg.rate_percentage
  } else {
    salesTaxRate.value = 0
  }
}

watch(() => props.show, async (isOpen) => {
  if (isOpen) {
    await loadTaxes()
  }
}, { immediate: true })

watch(() => props.editProduct, async (prod) => {
  if (prod) {
    productName.value = prod.name
    barcode.value = prod.barcode || ''
    salesPrice.value = prod.price
    initialStock.value = prod.stock ?? 50
    imageUrl.value = prod.image || ''
    posCategory.value = prod.category || 'general'
    customCategory.value = ''
    await loadTaxes()
    await loadProductUoms(prod.id)
  }
}, { immediate: true })

onMounted(async () => {
  await loadTaxes()
})

const priceWithTax = computed(() => {
  const p = Number(salesPrice.value) || 0
  const tax = p * (salesTaxRate.value / 100)
  return (p + tax).toFixed(2)
})

const finalCategoryName = computed(() => {
  if (customCategory.value.trim()) return customCategory.value.trim().toLowerCase()
  return posCategory.value
})

const resetForm = () => {
  productName.value = ''
  barcode.value = ''
  trackInventory.value = true
  salesPrice.value = 150.00
  initialStock.value = 50
  salesTaxRate.value = availableTaxGroups.value[0]?.rate_percentage || 0
  selectedTaxGroupId.value = availableTaxGroups.value[0]?.tax_group_id || ''
  posCategory.value = 'general'
  customCategory.value = ''
  imageUrl.value = ''
}

const handleSaveClick = () => {
  if (!productName.value.trim()) {
    toast.warning('Please enter a product name.')
    return
  }

  // Check if current user has Manager Privileges
  if (authStore.hasManagerPrivileges) {
    executeSaveProduct()
  } else {
    // Non-manager requires Manager PIN approval
    isManagerPinModalOpen.value = true
  }
}

const executeSaveProduct = async () => {
  if (isEditMode.value && props.editProduct) {
    await executeUpdateProduct()
  } else {
    await executeCreateProduct()
  }
}

const executeCreateProduct = async () => {
  isSaving.value = true
  try {
    const newId = uuidv4()
    const finalPrice = 0 // Selling prices & cost rates are established via Purchase Orders in Inventory module
    const finalBarcode = barcode.value.trim() || `OD${Math.floor(1000 + Math.random() * 9000)}`
    const defaultImage = imageUrl.value.trim() || `https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=200`
    const taxAmt = 0
    const initQty = 0 // Stock is added strictly via Purchase Orders in Inventory module
    const catName = finalCategoryName.value

    const finalType = settingsStore.posMode === 'retail' 
      ? (productType.value === 'RAW_MATERIAL' ? 'FINISHED_GOOD' : productType.value)
      : productType.value

    try {
      await db.insert(schema.products).values({
        product_id: newId,
        name: productName.value.trim(),
        product_type: finalType,
        default_price: finalPrice,
        uom: 'PCS',
        barcode: finalBarcode,
        image: defaultImage,
        description: productName.value.trim(),
        category: catName
      })

      // Insert Initial Stock Entry into Inventory (0 Pcs, restocked via Purchase Orders)
      await db.insert(schema.inventory).values({
        inventory_id: uuidv4(),
        node_id: 'NODE_POS_001',
        product_id: newId,
        quantity: 0,
        min_stock_alert: 10,
        last_updated: Date.now()
      })

      // Insert Initial Inventory Log
      await db.insert(schema.inventory_logs).values({
        log_id: uuidv4(),
        node_id: 'NODE_POS_001',
        product_id: newId,
        movement_type: 'INITIAL_SEED',
        quantity_change: initQty,
        quantity_after: initQty,
        reference_note: `Product Created as ${finalType} with ${salesTaxRate.value}% Tax & ${initQty} Pcs Stock`,
        user_name: authStore.currentUser?.name || 'Store Manager',
        created_at: Date.now()
      })

      // Insert Product Tax Association
      // Save Configured Nested UOM Tiers
      await saveProductUOMs(newId, uomTiers.value.map(u => ({
        ...u,
        selling_price: u.is_base_uom ? finalPrice : u.selling_price
      })))

      if (selectedTaxGroupId.value) {
        await db.insert(schema.product_taxes).values({
          product_tax_id: uuidv4(),
          product_id: newId,
          tax_group_id: selectedTaxGroupId.value
        })
      }
    } catch (dbErr) {
      console.warn('SQLite insert note (updating store):', dbErr)
    }

    const newProdObj: Product = {
      id: newId,
      sku: finalBarcode,
      barcode: finalBarcode,
      name: productName.value.trim(),
      category: catName,
      price: finalPrice,
      type: finalType,
      stock: initQty,
      taxGroupId: selectedTaxGroupId.value || '',
      image: defaultImage,
      description: productName.value.trim(),
      taxAmount: taxAmt
    }

    // Ensure category exists in store
    if (!productStore.categories.some(c => c.id === catName)) {
      productStore.categories.push({
        id: catName,
        name: catName.charAt(0).toUpperCase() + catName.slice(1),
        icon: 'fa-tag',
        color: 'bg-purple-100 text-purple-900 font-bold'
      })
    }

    productStore.products.unshift(newProdObj)
    productStore.setCategory(catName)
    toast.success(`Product "${newProdObj.name}" created successfully!`)
    emit('product-created', newProdObj)
    resetForm()
    emit('close')
  } finally {
    isSaving.value = false
  }
}

const executeUpdateProduct = async () => {
  if (!props.editProduct) return
  isSaving.value = true
  try {
    const finalBarcode = barcode.value.trim() || props.editProduct.barcode
    const finalImage = imageUrl.value.trim() || props.editProduct.image
    const catName = finalCategoryName.value
    const existingPrice = props.editProduct.price || 0

    await db.update(schema.products)
      .set({
        name: productName.value.trim(),
        barcode: finalBarcode,
        image: finalImage,
        description: productName.value.trim(),
        category: catName
      })
      .where(eq(schema.products.product_id, props.editProduct.id))

    // Save/Update Configured Nested UOM Tiers
    await saveProductUOMs(props.editProduct.id, uomTiers.value.map(u => ({
      ...u,
      selling_price: u.is_base_uom ? existingPrice : (u.selling_price || existingPrice * u.multiplier_to_base)
    })))

    // Update Product Tax Association in SQLite
    try {
      await db.delete(schema.product_taxes).where(eq(schema.product_taxes.product_id, props.editProduct.id))
      if (selectedTaxGroupId.value) {
        await db.insert(schema.product_taxes).values({
          product_tax_id: uuidv4(),
          product_id: props.editProduct.id,
          tax_group_id: selectedTaxGroupId.value
        })
      }
    } catch (ptErr) {
      console.warn('Failed updating product_taxes:', ptErr)
    }

    // Update Pinia store in-place
    const idx = productStore.products.findIndex(p => p.id === props.editProduct!.id)
    if (idx !== -1) {
      productStore.products[idx] = {
        ...productStore.products[idx],
        name: productName.value.trim(),
        barcode: finalBarcode,
        image: finalImage,
        category: catName,
        taxGroupId: selectedTaxGroupId.value,
        taxAmount: existingPrice * (salesTaxRate.value / 100)
      }
    }

    toast.success(`Product definition for "${productName.value.trim()}" updated successfully!`)
    emit('product-updated', props.editProduct.id)
    emit('close')
  } catch (err: any) {
    toast.error('Failed to update product: ' + (err.message || err))
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-purple-900/20">
      
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-[#714B67] text-white">
        <div class="flex items-center gap-2">
          <i :class="isEditMode ? 'fas fa-edit text-amber-300 text-lg' : 'fas fa-plus-circle text-amber-300 text-lg'"></i>
          <h2 class="font-bold text-base">{{ isEditMode ? 'Edit Product Details' : 'New Product & Tax Assignment' }}</h2>
        </div>
        <button @click="$emit('close')" class="text-white/80 hover:text-white transition-colors text-lg font-bold">
          ✕
        </button>
      </div>

      <!-- Modal Content -->
      <div class="p-6 bg-white flex gap-6 max-h-[75vh] overflow-y-auto">
        
        <!-- Left Side: Form Fields -->
        <div class="flex-1 space-y-3.5 text-xs text-gray-800">
          
          <!-- Product Name -->
          <div>
            <label class="block font-bold text-gray-900 mb-1">Product Name</label>
            <input 
              v-model="productName" 
              type="text" 
              placeholder="e.g. Artisanal Cappuccino" 
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#714B67]"
              required 
            />
          </div>

          <!-- Product Type Classification -->
          <div>
            <label class="block font-bold text-gray-900 mb-1">Product Type / Classification</label>
            <select 
              v-model="productType" 
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#714B67] bg-white"
            >
              <option value="FINISHED_GOOD">🛍️ Finished Good / Retail Product (Direct Sale)</option>
              <option value="SERVICE">🛠️ Service / Non-Stock Item</option>
              <option value="RAW_MATERIAL" :disabled="settingsStore.posMode === 'retail'">
                🥗 Raw Material / Recipe Ingredient {{ settingsStore.posMode === 'retail' ? '(Restaurant POS Only)' : '(BOM)' }}
              </option>
            </select>
            <p v-if="settingsStore.posMode === 'retail'" class="text-[10px] text-amber-700 font-semibold mt-1">
              ℹ️ Raw products are only for Restaurant POS (BOM recipes), not Store POS.
            </p>
          </div>

          <!-- Inventory & Price Architecture Notice -->
          <div class="bg-blue-50/80 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-950">
            <i class="fas fa-info-circle text-blue-600 text-sm mt-0.5 shrink-0"></i>
            <div>
              <div class="font-bold">Inventory Stock & Selling Price Management:</div>
              <p class="text-[11px] text-blue-800 mt-0.5 leading-normal">
                Product stock additions and active selling rates are established strictly through 
                <span class="font-bold text-blue-950">Purchase Orders (POs)</span>, <span class="font-bold text-blue-950">Inventory Restocks</span>, and <span class="font-bold text-blue-950">Price Readjustments</span> in the Inventory module.
              </p>
            </div>
          </div>

          <!-- Barcode / SKU & Read-only Current Status (Edit Mode) -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-gray-900 mb-1">Barcode / SKU</label>
              <input 
                v-model="barcode" 
                type="text" 
                placeholder="e.g. BAR-101" 
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-[#714B67]" 
              />
            </div>

            <div>
              <label class="block font-bold text-purple-950 mb-1">Assigned Tax Group</label>
              <select 
                v-model="selectedTaxGroupId"
                @change="handleTaxGroupChange"
                class="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-xs font-bold text-purple-900 focus:outline-none focus:border-[#714B67]"
              >
                <template v-if="availableTaxGroups.length > 0">
                  <option :value="''">No Tax (0%)</option>
                  <option 
                    v-for="tg in availableTaxGroups" 
                    :key="tg.tax_group_id" 
                    :value="tg.tax_group_id"
                  >
                    {{ tg.name }} ({{ tg.rate_percentage }}% — {{ tg.is_inclusive ? 'Inclusive' : 'Exclusive' }})
                  </option>
                </template>
                <template v-else>
                  <option :value="''">No Tax Groups (0%)</option>
                </template>
              </select>
            </div>
          </div>

          <!-- Current Inventory & Active Selling Price Status (Edit Mode) -->
          <div v-if="isEditMode" class="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
            <div>
              <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Current Inventory Stock</span>
              <div class="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                {{ editProduct?.stock || 0 }} Pcs
              </div>
            </div>
            <div>
              <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Current Active Selling Price</span>
              <div class="font-mono font-bold text-purple-900 text-sm mt-0.5">
                Rs {{ (editProduct?.price || 0).toFixed(2) }}
              </div>
            </div>
          </div>

          <!-- Nested UOM Hierarchy Builder Card -->
          <div class="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-3">
            <div class="flex justify-between items-center">
              <div>
                <h4 class="font-bold text-xs text-purple-950 uppercase tracking-wider">
                  <i class="fas fa-boxes text-[#714B67] mr-1"></i> Nested Units of Measure (UOM) Hierarchy
                </h4>
                <p class="text-[11px] text-gray-500">Configure upper packaging tiers (Piece ➔ Pack ➔ Box ➔ Carton) and multipliers relative to Base Unit.</p>
              </div>
              <button 
                @click="addUomTier" 
                type="button" 
                class="text-xs px-2.5 py-1 bg-[#714B67] text-white rounded-lg font-bold hover:bg-[#5a3a52] transition-colors cursor-pointer"
              >
                + Add UOM Tier
              </button>
            </div>

            <div class="space-y-2">
              <div 
                v-for="(uom, idx) in uomTiers" 
                :key="idx" 
                class="grid grid-cols-12 gap-2 bg-white p-2.5 rounded-lg border border-purple-100 items-center text-xs"
              >
                <div class="col-span-5">
                  <label class="block text-[10px] font-bold text-gray-500 mb-0.5">Tier Name</label>
                  <input v-model="uom.uom_name" type="text" placeholder="e.g. Box" class="w-full px-2 py-1 border border-gray-300 rounded font-bold text-gray-900" />
                </div>
                <div class="col-span-4">
                  <label class="block text-[10px] font-bold text-gray-500 mb-0.5">Base Multiplier</label>
                  <div class="flex items-center gap-1">
                    <input 
                      v-model.number="uom.multiplier_to_base" 
                      type="number" 
                      min="0.001" 
                      step="any" 
                      :disabled="uom.is_base_uom" 
                      class="w-full px-2 py-1 border border-gray-300 rounded font-mono font-bold text-purple-900" 
                    />
                    <span class="text-[10px] text-gray-400 font-bold shrink-0">Pcs</span>
                  </div>
                </div>
                <div class="col-span-3 flex items-center justify-end gap-1 pt-3">
                  <span v-if="uom.is_base_uom" class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-200 text-purple-900">Base Unit</span>
                  <button v-else @click="removeUomTier(idx)" type="button" class="text-xs text-rose-600 hover:text-rose-800 font-bold p-1">
                    <i class="fas fa-trash-alt"></i> Remove
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Category Selection or Custom Category Creation -->
          <div>
            <label class="block font-bold text-gray-900 mb-1">Product Category (Select or Type New)</label>
            <div class="grid grid-cols-2 gap-2">
              <select 
                v-model="posCategory" 
                class="border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold capitalize focus:outline-none focus:border-[#714B67]"
              >
                <option 
                  v-for="cat in productStore.categories.filter(c => c.id !== 'all')" 
                  :key="cat.id"
                  :value="cat.id"
                >
                  {{ cat.name }}
                </option>
              </select>

              <input 
                v-model="customCategory"
                type="text"
                placeholder="or Type New Category..."
                class="border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#714B67]"
              />
            </div>
          </div>

          <!-- Image URL Input -->
          <div>
            <label class="block font-bold text-gray-900 mb-1">Product Image URL</label>
            <input 
              v-model="imageUrl" 
              type="text" 
              placeholder="Paste Image URL (e.g. https://images.unsplash.com/...)" 
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 focus:outline-none focus:border-[#714B67]"
            />
          </div>

        </div>

        <!-- Right Side: Product Image Preview Box -->
        <div class="w-36 flex flex-col items-center shrink-0 space-y-2">
          <label class="font-bold text-gray-800 text-xs">Image Preview</label>
          <div class="w-32 h-32 bg-slate-100 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 relative overflow-hidden group hover:border-[#714B67]">
            <img v-if="imageUrl" :src="imageUrl" class="w-full h-full object-cover" />
            <template v-else>
              <i class="fas fa-camera text-3xl mb-1 text-gray-300"></i>
              <span class="text-[10px] text-gray-400 font-bold">+ Image</span>
            </template>
          </div>
          <span class="text-[10px] text-gray-400 text-center font-medium">Shows on POS Register grid</span>
        </div>

      </div>

      <!-- Footer Buttons -->
      <div class="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        <button 
          @click="$emit('close')" 
          class="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-xs transition-colors shadow-xs"
        >
          Discard
        </button>

        <button 
          @click="handleSaveClick" 
          :disabled="isSaving"
          class="px-5 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white font-bold rounded-xl text-xs transition-colors shadow-md flex items-center gap-1.5 cursor-pointer"
        >
          <i v-if="isSaving" class="fas fa-spinner fa-spin"></i>
          <i v-else :class="isEditMode ? 'fas fa-save' : 'fas fa-check-circle'"></i>
          <span>{{ isEditMode ? 'Save Changes' : 'Save & Add to Catalog' }}</span>
        </button>
      </div>

    </div>

    <!-- Manager Authorization PIN Modal -->
    <ManagerPinModal 
      :show="isManagerPinModalOpen" 
      title="Manager PIN Required for Product & Tax Setup"
      actionDescription="Only Store Manager can create products, assign taxes, and manage inventory stock. Please enter Manager PIN code."
      @close="isManagerPinModalOpen = false"
      @authorized="executeSaveProduct"
    />
  </div>
</template>
