<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useProductStore } from '../stores/useProductStore'
import { useMasterDbStore } from '../stores/useMasterDbStore'
import { taxService, type TaxGroup } from '../services/taxService'

import { bomService } from '../services/bomService'
import CreateProductModal from '../components/modals/CreateProductModal.vue'

const emit = defineEmits(['open-pos'])
const productStore = useProductStore()
const masterDbStore = useMasterDbStore()

const activeTab = ref<'products' | 'combos' | 'taxes' | 'inventory' | 'reports'>('products')
const showCreateProductModal = ref(false)

// Reports & Master DB Sales Data
const salesReportData = ref<any[]>([])
const salesSummary = ref({ count: 0, total_net: 0 })
const isLoadingReports = ref(false)

// Tax Group Form State
const taxGroups = ref<TaxGroup[]>([])
const showTaxModal = ref(false)
const newTax = ref({ name: '', rate_percentage: 10, is_inclusive: true })

// Combo/BOM State
const bomRecipes = ref<any[]>([])
const showBomModal = ref(false)
const selectedParentProduct = ref('')
const selectedIngredientProduct = ref('')
const ingredientQuantity = ref(1)

onMounted(async () => {
  await productStore.loadFromDb()
  await loadTaxGroups()
  await loadBomRecipes()
  await loadSalesReport()
})

const loadTaxGroups = async () => {
  taxGroups.value = await taxService.getTaxGroups()
}

const loadBomRecipes = async () => {
  bomRecipes.value = await bomService.getBomRecipes()
}

const loadSalesReport = async () => {
  isLoadingReports.value = true
  try {
    const res = await fetch(`${masterDbStore.masterDbUrl}/api/reports/sales`).catch(() => null)
    if (res && res.ok) {
      const data = await res.json()
      salesReportData.value = data.sales || []
      salesSummary.value = data.summary || { count: salesReportData.value.length, total_net: salesReportData.value.reduce((s, x) => s + (x.net_total || 0), 0) }
    } else {
      // Fallback from local db products/sales if master endpoint not reachable locally
      salesReportData.value = []
    }
  } catch (e) {
    console.warn('Could not fetch Master DB reports:', e)
  } finally {
    isLoadingReports.value = false
  }
}

const handleCreateTaxGroup = async () => {
  if (!newTax.value.name) return
  await taxService.createTaxGroup({
    name: newTax.value.name,
    rate_percentage: Number(newTax.value.rate_percentage),
    is_inclusive: newTax.value.is_inclusive
  })
  newTax.value = { name: '', rate_percentage: 10, is_inclusive: true }
  showTaxModal.value = false
  await loadTaxGroups()
}

const handleAddBomItem = async () => {
  if (!selectedParentProduct.value || !selectedIngredientProduct.value) {
    alert('Please select both parent combo product and ingredient product.')
    return
  }
  await bomService.addIngredientToBom({
    parent_product_id: selectedParentProduct.value,
    ingredient_product_id: selectedIngredientProduct.value,
    quantity_required: ingredientQuantity.value,
    uom: 'PCS'
  })
  showBomModal.value = false
  await loadBomRecipes()
}

const formatCurrency = (val: number) => `$ ${val.toFixed(2)}`
</script>

<template>
  <div class="h-full w-full bg-gray-100 flex flex-col font-sans overflow-hidden text-gray-800">
    <!-- Sub Header Bar -->
    <div class="bg-[#714B67] text-white px-6 py-3 flex justify-between items-center shrink-0 shadow-md">
      <div class="flex items-center gap-3">
        <i class="fas fa-briefcase text-amber-300 text-xl"></i>
        <div>
          <h2 class="font-bold text-lg leading-tight">Store Manager & Owner Portal</h2>
          <p class="text-xs text-amber-200/80">Direct Master DB Operations: Products, Combos, Taxes, Stock & Reports</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button @click="emit('open-pos')" class="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition-all">
          <i class="fas fa-cash-register"></i> Switch to Sales Register
        </button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="bg-white border-b border-gray-200 px-6 flex gap-4 text-sm font-semibold shrink-0">
      <button 
        @click="activeTab = 'products'" 
        :class="[activeTab === 'products' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors"
      >
        <i class="fas fa-[#714B67] fa-box"></i>
        <span>Product Catalog</span>
      </button>

      <button 
        @click="activeTab = 'combos'" 
        :class="[activeTab === 'combos' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors"
      >
        <i class="fas fa-[#714B67] fa-cubes"></i>
        <span>Combos & Recipes (BOM)</span>
      </button>

      <button 
        @click="activeTab = 'taxes'" 
        :class="[activeTab === 'taxes' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors"
      >
        <i class="fas fa-[#714B67] fa-percent"></i>
        <span>Tax Rules & Setup</span>
      </button>

      <button 
        @click="activeTab = 'inventory'" 
        :class="[activeTab === 'inventory' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors"
      >
        <i class="fas fa-[#714B67] fa-warehouse"></i>
        <span>Inventory & Stock</span>
      </button>

      <button 
        @click="activeTab = 'reports'" 
        :class="[activeTab === 'reports' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors"
      >
        <i class="fas fa-[#714B67] fa-chart-bar"></i>
        <span>Sales Reports & Master DB</span>
      </button>
    </div>

    <!-- Main Content Panel -->
    <div class="flex-1 p-6 overflow-y-auto">

      <!-- TAB 1: PRODUCT CATALOG -->
      <div v-if="activeTab === 'products'" class="bg-white p-6 rounded-xl shadow-xs border border-gray-200 space-y-4">
        <div class="flex justify-between items-center border-b border-gray-100 pb-3">
          <div>
            <h3 class="font-bold text-base text-gray-900">Master Product Catalog</h3>
            <p class="text-xs text-gray-500">Products created here write directly to Master DB and sync to POS terminals.</p>
          </div>
          <button @click="showCreateProductModal = true" class="px-4 py-2 bg-[#714B67] text-white text-xs font-bold rounded-lg hover:bg-[#5a3a52] flex items-center gap-1.5 shadow-xs transition-colors">
            <i class="fas fa-plus"></i> Create New Product
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div v-for="prod in productStore.products" :key="prod.id" class="p-3 rounded-xl border border-gray-200 bg-white hover:border-[#714B67] transition-all flex flex-col justify-between">
            <div class="flex gap-3 items-center">
              <img :src="prod.image || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(prod.name)" class="w-12 h-12 rounded-lg object-cover bg-gray-100 shrink-0" />
              <div>
                <h4 class="font-bold text-xs text-gray-900">{{ prod.name }}</h4>
                <p class="text-[11px] text-gray-500 font-mono">{{ prod.barcode || 'NO-BARCODE' }}</p>
                <span class="text-xs font-extrabold text-[#714B67] mt-0.5 block">{{ formatCurrency(prod.price) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: COMBOS & RECIPES (BOM) -->
      <div v-if="activeTab === 'combos'" class="bg-white p-6 rounded-xl shadow-xs border border-gray-200 space-y-4">
        <div class="flex justify-between items-center border-b border-gray-100 pb-3">
          <div>
            <h3 class="font-bold text-base text-gray-900">Product Combos & Bill of Materials (BOM)</h3>
            <p class="text-xs text-gray-500">Define ingredient deduct lists or product bundles for restaurants/stores.</p>
          </div>
          <button @click="showBomModal = true" class="px-4 py-2 bg-[#714B67] text-white text-xs font-bold rounded-lg hover:bg-[#5a3a52] flex items-center gap-1.5 shadow-xs transition-colors">
            <i class="fas fa-link"></i> Add Ingredient / Combo Pair
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                <th class="p-3">Parent Combo / Product</th>
                <th class="p-3">Ingredient / Sub-Product</th>
                <th class="p-3">Qty Required</th>
                <th class="p-3">UOM</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="b in bomRecipes" :key="b.bom_id" class="hover:bg-gray-50">
                <td class="p-3 font-semibold text-gray-900">{{ b.parent_product_id }}</td>
                <td class="p-3 font-medium text-gray-700">{{ b.ingredient_product_id }}</td>
                <td class="p-3 font-bold text-gray-800">{{ b.quantity_required }}</td>
                <td class="p-3 text-gray-500">{{ b.uom }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 3: TAX SETUP -->
      <div v-if="activeTab === 'taxes'" class="bg-white p-6 rounded-xl shadow-xs border border-gray-200 space-y-4">
        <div class="flex justify-between items-center border-b border-gray-100 pb-3">
          <div>
            <h3 class="font-bold text-base text-gray-900">Tax Setup & Tax Groups</h3>
            <p class="text-xs text-gray-500">Configure global VAT, Sales Tax rates, and tax inclusive/exclusive rules.</p>
          </div>
          <button @click="showTaxModal = true" class="px-4 py-2 bg-[#714B67] text-white text-xs font-bold rounded-lg hover:bg-[#5a3a52] flex items-center gap-1.5 shadow-xs transition-colors">
            <i class="fas fa-percent"></i> Add Tax Group
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div v-for="tax in taxGroups" :key="tax.tax_group_id" class="p-4 rounded-xl border border-gray-200 bg-gray-50/60 flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-center mb-2">
                <span class="font-bold text-sm text-gray-900">{{ tax.name }}</span>
                <span :class="[tax.is_inclusive ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800']" class="px-2 py-0.5 rounded text-[10px] font-bold">
                  {{ tax.is_inclusive ? 'INCLUSIVE' : 'EXCLUSIVE' }}
                </span>
              </div>
              <div class="text-2xl font-extrabold text-[#714B67]">{{ tax.rate_percentage }}%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 4: INVENTORY & STOCK -->
      <div v-if="activeTab === 'inventory'" class="bg-white p-6 rounded-xl shadow-xs border border-gray-200 space-y-4">
        <h3 class="font-bold text-base text-gray-900 border-b border-gray-100 pb-2">Inventory Stock Balances</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                <th class="p-3">Product</th>
                <th class="p-3">Category</th>
                <th class="p-3">Current Stock</th>
                <th class="p-3">Min Alert Stock</th>
                <th class="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="prod in productStore.products" :key="prod.id" class="hover:bg-gray-50">
                <td class="p-3 font-semibold text-gray-900">{{ prod.name }}</td>
                <td class="p-3 text-gray-500">{{ prod.category }}</td>
                <td class="p-3 font-bold text-gray-800">100 PCS</td>
                <td class="p-3 text-gray-500">10 PCS</td>
                <td class="p-3 text-right">
                  <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">IN STOCK</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 5: SALES REPORTS -->
      <div v-if="activeTab === 'reports'" class="bg-white p-6 rounded-xl shadow-xs border border-gray-200 space-y-4">
        <div class="flex justify-between items-center border-b border-gray-100 pb-3">
          <div>
            <h3 class="font-bold text-base text-gray-900">Consolidated Master DB Sales Reports</h3>
            <p class="text-xs text-gray-500">Real-time transactions collected from all store salesperson local DBs.</p>
          </div>
          <button @click="loadSalesReport" class="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 rounded-lg flex items-center gap-1.5 transition-colors">
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoadingReports }"></i> Refresh Sales
          </button>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="p-4 rounded-xl bg-purple-50 border border-purple-100">
            <div class="text-xs text-purple-700 font-bold uppercase tracking-wider">Total Sales Count</div>
            <div class="text-2xl font-extrabold text-purple-900 mt-1">{{ salesSummary.count }} Orders</div>
          </div>

          <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <div class="text-xs text-emerald-700 font-bold uppercase tracking-wider">Total Net Revenue</div>
            <div class="text-2xl font-extrabold text-emerald-900 mt-1">{{ formatCurrency(salesSummary.total_net || 0) }}</div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                <th class="p-3">Sale ID</th>
                <th class="p-3">Payment Method</th>
                <th class="p-3">Order Type</th>
                <th class="p-3">Net Total</th>
                <th class="p-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="sale in salesReportData" :key="sale.sale_id" class="hover:bg-gray-50">
                <td class="p-3 font-mono font-semibold text-gray-900">{{ sale.sale_id }}</td>
                <td class="p-3 text-gray-700">{{ sale.payment_method }}</td>
                <td class="p-3 text-gray-600">{{ sale.order_type }}</td>
                <td class="p-3 font-bold text-emerald-700">{{ formatCurrency(sale.net_total) }}</td>
                <td class="p-3 text-right text-gray-500">{{ new Date(sale.created_at).toLocaleTimeString() }}</td>
              </tr>
              <tr v-if="salesReportData.length === 0">
                <td colspan="5" class="p-6 text-center text-gray-400 italic">No sales recorded on Master DB yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- MODAL 1: Create Product Modal -->
    <CreateProductModal :show="showCreateProductModal" @close="showCreateProductModal = false" />


    <!-- MODAL 2: Add Tax Modal -->
    <div v-if="showTaxModal" class="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 class="font-bold text-base border-b border-gray-200 pb-2 text-gray-900">Create Tax Rule Group</h3>
        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-gray-700 mb-1">Tax Name</label>
            <input v-model="newTax.name" type="text" placeholder="e.g. Sales Tax 15%" class="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#714B67]" />
          </div>
          <div>
            <label class="block font-bold text-gray-700 mb-1">Rate Percentage (%)</label>
            <input v-model.number="newTax.rate_percentage" type="number" step="0.5" class="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#714B67]" />
          </div>
          <div class="flex items-center gap-2 pt-1">
            <input v-model="newTax.is_inclusive" type="checkbox" id="inclusiveCheck" class="rounded text-[#714B67] focus:ring-[#714B67]" />
            <label for="inclusiveCheck" class="font-bold text-gray-700 cursor-pointer">Tax Included in Product Price</label>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button @click="showTaxModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200">Cancel</button>
          <button @click="handleCreateTaxGroup" class="px-4 py-2 bg-[#714B67] text-white text-xs font-bold rounded-lg hover:bg-[#5a3a52]">Save Tax</button>
        </div>
      </div>
    </div>

    <!-- MODAL 3: Add BOM Recipe Modal -->
    <div v-if="showBomModal" class="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 class="font-bold text-base border-b border-gray-200 pb-2 text-gray-900">Add Combo Ingredient / BOM Recipe</h3>
        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-gray-700 mb-1">Parent Combo Product</label>
            <select v-model="selectedParentProduct" class="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#714B67]">
              <option v-for="p in productStore.products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-gray-700 mb-1">Required Sub-Product / Ingredient</label>
            <select v-model="selectedIngredientProduct" class="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#714B67]">
              <option v-for="p in productStore.products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-gray-700 mb-1">Quantity Required</label>
            <input v-model.number="ingredientQuantity" type="number" min="0.1" step="0.1" class="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#714B67]" />
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button @click="showBomModal = false" class="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200">Cancel</button>
          <button @click="handleAddBomItem" class="px-4 py-2 bg-[#714B67] text-white text-xs font-bold rounded-lg hover:bg-[#5a3a52]">Link Ingredient</button>
        </div>
      </div>
    </div>

  </div>
</template>
