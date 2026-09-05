<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useProductStore } from '../stores/useProductStore'
import { useMasterDbStore } from '../stores/useMasterDbStore'
import { taxService, type TaxGroup } from '../services/taxService'
import { bomService } from '../services/bomService'
import CreateProductModal from '../components/modals/CreateProductModal.vue'
import InventoryHistoryView from './InventoryHistoryView.vue'
import ReportsView from './ReportsView.vue'
import { useToast } from '../composables/useToast'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { desc } from 'drizzle-orm'
import type { Product } from '../stores/useProductStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useCartStore } from '../stores/useCartStore'
import { useAuthStore, SYSTEM_RIGHTS, getDefaultRightsForUser, type UserAccount } from '../stores/useAuthStore'

const settingsStore = useSettingsStore()
const authStore = useAuthStore()

const emit = defineEmits(['open-pos'])
const productStore = useProductStore()
const masterDbStore = useMasterDbStore()
const cartStore = useCartStore()
const toast = useToast()

const activeTab = ref<'products' | 'combos' | 'taxes' | 'inventory' | 'reports' | 'users'>('products')
const showCreateProductModal = ref(false)
const editingProduct = ref<Product | null>(null)

function handleEditProduct(prod: Product) {
  editingProduct.value = prod
  showCreateProductModal.value = true
}

function handleModalClose() {
  showCreateProductModal.value = false
  editingProduct.value = null
}

// Reports & Master DB Sales Data
const salesReportData = ref<any[]>([])
const salesSummary = ref({ count: 0, total_net: 0 })
const isLoadingReports = ref(false)

// Tax Group Form State
const taxGroups = ref<TaxGroup[]>([])
const showTaxModal = ref(false)
const editingTaxId = ref<string | null>(null)
const newTax = ref<{name: string, rate_percentage: number, is_inclusive: boolean, tax_type: 'ITEM'|'BILL'}>({ name: '', rate_percentage: 10, is_inclusive: true, tax_type: 'ITEM' })

// Combo/BOM State
const bomRecipes = ref<any[]>([])
const showBomModal = ref(false)
const selectedParentProduct = ref('')
const selectedIngredientProduct = ref('')
const ingredientQuantity = ref(1)

import { watch } from 'vue'

onMounted(async () => {
  await productStore.loadFromDb()
  await loadTaxGroups()
  await loadBomRecipes()
  await loadSalesReport()
})

watch(activeTab, async (newTab) => {
  if (newTab === 'reports') {
    await loadSalesReport()
  } else if (newTab === 'inventory' || newTab === 'products') {
    await productStore.loadFromDb()
  } else if (newTab === 'users') {
    await authStore.loadUsers()
  }
})

const loadTaxGroups = async () => {
  taxGroups.value = await taxService.getTaxGroups()
  await cartStore.fetchActiveBillTaxes()
}

const loadBomRecipes = async () => {
  bomRecipes.value = await bomService.getBomRecipes()
}

const loadSalesReport = async () => {
  isLoadingReports.value = true
  try {
    // Primary: load from local SQLite
    const localSales = await db.select().from(schema.sales).orderBy(desc(schema.sales.created_at))
    salesReportData.value = localSales.map((s: any) => ({
      sale_id: s.sale_id,
      node_id: s.node_id,
      payment_method: s.payment_method,
      net_total: Number(s.net_total || 0),
      subtotal: Number(s.subtotal || 0),
      tax_total: Number(s.tax_total || 0),
      created_at: s.created_at
    }))
    salesSummary.value = {
      count: localSales.length,
      total_net: localSales.reduce((s: number, x: any) => s + Number(x.net_total || 0), 0)
    }

    // Secondary: try to merge with remote Master DB
    try {
      const res = await fetch(`${masterDbStore.masterDbUrl}/api/reports/sales`, { signal: AbortSignal.timeout(3000) }).catch(() => null)
      if (res && res.ok) {
        const data = await res.json()
        const remoteRaw = (data.sales || []) as any[]
        const remoteMapped = remoteRaw.map((r: any) => ({
          sale_id: r.sale_id || r.order_id || 'remote-' + Math.random().toString(36).substring(2, 9),
          node_id: r.node_id || 'NODE_POS_001',
          payment_method: r.payment_method || 'Cash',
          net_total: Number(r.net_total || 0),
          subtotal: Number(r.subtotal || 0),
          tax_total: Number(r.tax_total || 0),
          created_at: r.created_at ? (typeof r.created_at === 'number' ? r.created_at : new Date(r.created_at).getTime()) : Date.now()
        }))

        const localIds = new Set(salesReportData.value.map((s: any) => s.sale_id))
        const merged = [...salesReportData.value, ...remoteMapped.filter((r: any) => !localIds.has(r.sale_id))]
        salesReportData.value = merged
        salesSummary.value = {
          count: merged.length,
          total_net: merged.reduce((s: number, x: any) => s + Number(x.net_total || 0), 0)
        }
      }
    } catch (_) { /* offline — local data only */ }

    // Load item-wise aggregated sales report for date range
    await loadItemWiseReport()
  } catch (e) {
    console.warn('Could not load sales report:', e)
  } finally {
    isLoadingReports.value = false
  }
}

// Date Filter & Item-Wise Sales Report State
const getTodayStr = () => new Date().toISOString().slice(0, 10)
const getMonthStartStr = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

const reportFromDate = ref(getMonthStartStr())
const reportToDate = ref(getTodayStr())
const reportSubTab = ref<'item_wise' | 'transactions'>('item_wise')

interface ItemWiseReportRow {
  product_id: string
  product_name: string
  barcode: string
  category: string
  unit_tax_per_item: number
  tax_rate_pct: number
  total_quantity: number
  unit_price_excl_tax: number
  total_tax_amount: number
  total_amount_incl_tax: number
}

const itemWiseReportData = ref<ItemWiseReportRow[]>([])
const itemWiseSummary = ref({
  total_untaxed_amount: 0,
  total_item_tax: 0,
  total_bill_tax: 0,
  total_tax_amount: 0,
  effective_tax_rate: 0,
  grand_total: 0
})

function setDatePreset(preset: 'today' | 'this_week' | 'this_month' | 'all_time') {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  reportToDate.value = todayStr

  if (preset === 'today') {
    reportFromDate.value = todayStr
  } else if (preset === 'this_week') {
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    reportFromDate.value = weekAgo.toISOString().slice(0, 10)
  } else if (preset === 'this_month') {
    reportFromDate.value = getMonthStartStr()
  } else if (preset === 'all_time') {
    reportFromDate.value = '2020-01-01'
  }

  loadSalesReport()
}

const loadItemWiseReport = async () => {
  try {
    const fromMs = new Date(`${reportFromDate.value}T00:00:00`).getTime()
    const toMs = new Date(`${reportToDate.value}T23:59:59.999`).getTime()

    const allSales = await db.select().from(schema.sales)
    const filteredSales = allSales.filter((s: any) => {
      const t = Number(s.created_at || 0)
      return t >= fromMs && t <= toMs
    })

    if (filteredSales.length === 0) {
      itemWiseReportData.value = []
      itemWiseSummary.value = {
        total_untaxed_amount: 0,
        total_item_tax: 0,
        total_bill_tax: 0,
        total_tax_amount: 0,
        effective_tax_rate: 0,
        grand_total: 0
      }
      return
    }

    const saleIds = new Set(filteredSales.map((s: any) => s.sale_id))
    const allSaleItems = await db.select().from(schema.sale_items)
    const filteredItems = allSaleItems.filter((i: any) => saleIds.has(i.sale_id))

    const productMap = new Map<string, ItemWiseReportRow>()

    for (const item of filteredItems) {
      const pid = item.product_id
      const qty = Number(item.quantity) || 0
      const taxAmt = Number(item.tax_amount) || 0
      const lineTotal = Number(item.line_total) || 0
      const unitPrice = Number(item.unit_price) || 0

      const prod = productStore.products.find(p => p.id === pid)
      const pName = prod ? prod.name : `Product (${pid.slice(0, 8)})`
      const pBarcode = prod ? (prod.barcode || prod.sku) : pid.slice(0, 8)
      const pCat = prod ? prod.category : 'General'

      const unitTaxPerItem = qty > 0 ? (taxAmt / qty) : 0
      const unitPriceExclTax = qty > 0 ? Math.max(0, (lineTotal - taxAmt) / qty) : unitPrice
      const taxRatePct = unitPriceExclTax > 0 ? ((unitTaxPerItem / unitPriceExclTax) * 100) : 0

      // Composite grouping key: Product ID + Tax Per Unit (rounded to 2 decimals)
      // This splits sales of the same item under different tax rates into separate rows
      const groupKey = `${pid}_tax_${unitTaxPerItem.toFixed(2)}`

      if (productMap.has(groupKey)) {
        const existing = productMap.get(groupKey)!
        existing.total_quantity += qty
        existing.total_tax_amount += taxAmt
        existing.total_amount_incl_tax += lineTotal
      } else {
        productMap.set(groupKey, {
          product_id: pid,
          product_name: pName,
          barcode: pBarcode,
          category: pCat,
          unit_tax_per_item: unitTaxPerItem,
          tax_rate_pct: taxRatePct,
          total_quantity: qty,
          unit_price_excl_tax: unitPriceExclTax,
          total_tax_amount: taxAmt,
          total_amount_incl_tax: lineTotal
        })
      }
    }

    const rows = Array.from(productMap.values())
    itemWiseReportData.value = rows

    const totalUntaxed = rows.reduce((sum, r) => sum + (r.unit_price_excl_tax * r.total_quantity), 0)
    const totalItemTax = rows.reduce((sum, r) => sum + r.total_tax_amount, 0)
    const totalNetSales = filteredSales.reduce((sum: number, s: any) => sum + Number(s.net_total || 0), 0)
    const totalTaxAll = filteredSales.reduce((sum: number, s: any) => sum + Number(s.tax_total || 0), 0)
    const totalBillTax = Math.max(0, totalTaxAll - totalItemTax)

    const effectiveTaxRate = totalUntaxed > 0 ? (totalTaxAll / totalUntaxed) * 100 : 0

    itemWiseSummary.value = {
      total_untaxed_amount: totalUntaxed,
      total_item_tax: totalItemTax,
      total_bill_tax: totalBillTax,
      total_tax_amount: totalTaxAll,
      effective_tax_rate: effectiveTaxRate,
      grand_total: totalNetSales || (totalUntaxed + totalTaxAll)
    }

  } catch (err) {
    console.error('Failed to load item-wise sales report:', err)
  }
}

const showPdfReportModal = ref(false)

function openPdfReportPreview() {
  if (reportSubTab.value === 'item_wise' && itemWiseReportData.value.length === 0) {
    toast.warning('No sales data available for the selected date range to preview.')
    return
  }
  if (reportSubTab.value === 'transactions' && salesReportData.value.length === 0) {
    toast.warning('No transaction records available for the selected date range to preview.')
    return
  }
  showPdfReportModal.value = true
}

function handleExecutePrint() {
  window.print()
}

function exportItemWiseCsv() {
  if (itemWiseReportData.value.length === 0) {
    toast.warning('No data available to export for the selected date range.')
    return
  }

  let csv = 'Product Name,Barcode/SKU,Category,Tax Rate (%),Unit Tax Amount,Quantity Sold,Unit Price (Excl Tax),Total Tax Amount,Total Amount (Incl Tax)\n'
  for (const r of itemWiseReportData.value) {
    csv += `"${r.product_name}","${r.barcode}","${r.category}",${r.tax_rate_pct.toFixed(1)}%,${r.unit_tax_per_item.toFixed(2)},${r.total_quantity},${r.unit_price_excl_tax.toFixed(2)},${r.total_tax_amount.toFixed(2)},${r.total_amount_incl_tax.toFixed(2)}\n`
  }

  csv += '\nSUMMARY & TAX BREAKDOWN\n'
  csv += `Total Untaxed Amount,Rs ${itemWiseSummary.value.total_untaxed_amount.toFixed(2)}\n`
  csv += `Total Item Taxes,Rs ${itemWiseSummary.value.total_item_tax.toFixed(2)}\n`
  csv += `Total Bill Taxes,Rs ${itemWiseSummary.value.total_bill_tax.toFixed(2)}\n`
  csv += `Total Tax Amount (${itemWiseSummary.value.effective_tax_rate.toFixed(1)}%),Rs ${itemWiseSummary.value.total_tax_amount.toFixed(2)}\n`
  csv += `Grand Total Revenue,Rs ${itemWiseSummary.value.grand_total.toFixed(2)}\n`

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `item_wise_tax_report_${reportFromDate.value}_to_${reportToDate.value}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}



const handleClearAllProducts = async () => {
  if (confirm('Are you sure you want to clear all products and reset inventory history? This cannot be undone.')) {
    await productStore.clearAllProductsAndReset()
    toast.success('Products catalog and inventory history cleared successfully!')
  }
}

// Category Management State
const showAddCategoryForm = ref(false)
const newCategoryName = ref('')
const newCategoryEmoji = ref('')
const newCategoryColor = ref('bg-amber-200 text-amber-900 font-bold')

const getCategoryProductCount = (catId: string): number => {
  if (catId === 'all') return productStore.products.length
  return productStore.products.filter(p => p.category === catId).length
}

const handleAddCategory = () => {
  const name = newCategoryName.value.trim()
  if (!name) return
  const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const emoji = newCategoryEmoji.value.trim()
  const displayName = emoji ? `${emoji} ${name}` : name
  
  const added = productStore.addCategory({
    id,
    name: displayName,
    icon: 'fa-tag',
    color: newCategoryColor.value
  })

  if (added) {
    newCategoryName.value = ''
    newCategoryEmoji.value = ''
    newCategoryColor.value = 'bg-amber-200 text-amber-900 font-bold'
    showAddCategoryForm.value = false
  } else {
    toast.warning(`Category "${name}" already exists!`)
  }
}

const handleRemoveCategory = (catId: string) => {
  const count = getCategoryProductCount(catId)
  if (count > 0) {
    toast.warning(`Cannot remove this category — it has ${count} product(s) assigned. Reassign them first.`)
    return
  }
  if (confirm(`Remove category "${catId}"? This action cannot be undone.`)) {
    productStore.removeCategory(catId)
  }
}

const handleCreateTaxGroup = async () => {
  if (!newTax.value.name) return
  if (editingTaxId.value) {
    await taxService.updateTaxGroup(editingTaxId.value, {
      name: newTax.value.name,
      rate_percentage: Number(newTax.value.rate_percentage),
      is_inclusive: newTax.value.is_inclusive,
      tax_type: newTax.value.tax_type
    })
  } else {
    await taxService.createTaxGroup({
      name: newTax.value.name,
      rate_percentage: Number(newTax.value.rate_percentage),
      is_inclusive: newTax.value.is_inclusive,
      tax_type: newTax.value.tax_type
    })
  }
  newTax.value = { name: '', rate_percentage: 10, is_inclusive: true, tax_type: 'ITEM' }
  showTaxModal.value = false
  editingTaxId.value = null
  await loadTaxGroups()
}

const handleEditTaxGroup = (tax: TaxGroup) => {
  editingTaxId.value = tax.tax_group_id
  newTax.value = { 
    name: tax.name, 
    rate_percentage: tax.rate_percentage, 
    is_inclusive: tax.is_inclusive,
    tax_type: tax.tax_type || 'ITEM'
  }
  showTaxModal.value = true
}

const handleDeleteTaxGroup = async (tax: TaxGroup) => {
  if (confirm(`Are you sure you want to delete the tax group "${tax.name}"? This cannot be undone.`)) {
    await taxService.deleteTaxGroup(tax.tax_group_id)
    await loadTaxGroups()
  }
}

const handleAddBomItem = async () => {
  if (!selectedParentProduct.value || !selectedIngredientProduct.value) {
    toast.warning('Please select both parent combo product and ingredient product.')
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

// Staff & User Management Methods
const managerStaffUsers = computed(() => authStore.users.filter(u => u.role !== 'DEVELOPER'))
const showStaffModal = ref(false)
const editingStaffId = ref<string | null>(null)
const staffForm = ref<{
  name: string
  username: string
  pin: string
  designation: string
  rights: string[]
  reports_to_user_id?: string | null
  node_id?: string
}>({
  name: '',
  username: '',
  pin: '',
  designation: 'Salesperson / Cashier',
  rights: ['pos_register_screen', 'sales_returns_screen', 'apply_discounts', 'cash_drawer_drops'],
  reports_to_user_id: null,
  node_id: ''
})

const generateRandomStaffPin = () => {
  staffForm.value.pin = Math.floor(1000 + Math.random() * 9000).toString()
}

const toggleStaffRight = (key: string) => {
  const idx = staffForm.value.rights.indexOf(key)
  if (idx > -1) {
    staffForm.value.rights.splice(idx, 1)
  } else {
    staffForm.value.rights.push(key)
  }
}

const selectAllStaffRights = () => {
  staffForm.value.rights = SYSTEM_RIGHTS.map(r => r.key)
}

const clearAllStaffRights = () => {
  staffForm.value.rights = []
}

const handleOpenCreateStaff = () => {
  editingStaffId.value = null
  staffForm.value = {
    name: '',
    username: '',
    pin: Math.floor(1000 + Math.random() * 9000).toString(),
    designation: 'Salesperson / Cashier',
    rights: ['pos_register_screen', 'sales_returns_screen', 'apply_discounts', 'cash_drawer_drops'],
    reports_to_user_id: null,
    node_id: masterDbStore.nodes[0]?.node_id || ''
  }
  showStaffModal.value = true
}

const handleEditStaff = (user: UserAccount) => {
  editingStaffId.value = user.user_id
  staffForm.value = {
    name: user.name,
    username: user.username,
    pin: user.pin,
    designation: user.designation || 'Staff Member',
    rights: [...getDefaultRightsForUser(user)],
    reports_to_user_id: user.reports_to_user_id || null,
    node_id: user.node_id || masterDbStore.nodes[0]?.node_id || ''
  }
  showStaffModal.value = true
}

const handleSaveStaff = async () => {
  const name = staffForm.value.name.trim()
  const username = staffForm.value.username.trim().toLowerCase()
  const pin = staffForm.value.pin.trim()
  const designation = staffForm.value.designation.trim() || 'Staff Member'
  const rights = staffForm.value.rights
  const reports_to_user_id = staffForm.value.reports_to_user_id || null

  if (!name || !username || !pin) {
    toast.warning('Please enter Name, Username, and PIN.')
    return
  }

  if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    toast.warning('PIN must be a 4 to 6 digit numeric code.')
    return
  }

  try {
    if (editingStaffId.value) {
      await authStore.updateUser(editingStaffId.value, {
        name,
        username,
        pin,
        designation,
        rights,
        reports_to_user_id,
        node_id: staffForm.value.node_id
      })
      toast.success(`Updated user account: ${name}`)
    } else {
      await authStore.addUser({
        name,
        username,
        pin,
        designation,
        rights,
        reports_to_user_id,
        node_id: staffForm.value.node_id
      })
      toast.success(`Created staff account: ${name} (${designation})`)
    }
    showStaffModal.value = false
    editingStaffId.value = null
    await authStore.loadUsers()
  } catch (err: any) {
    toast.error(`Failed to save user account: ${err.message}`)
  }
}

const handleDeleteStaff = async (user: UserAccount) => {
  if (user.role === 'DEVELOPER' || (user.rights && user.rights.includes('*'))) {
    toast.warning('Developer / Super Admin accounts cannot be deleted here.')
    return
  }
  if (user.user_id === authStore.currentUser?.user_id) {
    toast.warning('You cannot delete your own currently active account.')
    return
  }
  if (confirm(`Are you sure you want to delete staff account "${user.name}"? This action cannot be undone.`)) {
    try {
      await authStore.deleteUser(user.user_id)
      toast.success(`Deleted user account: ${user.name}`)
    } catch (err: any) {
      toast.error(`Failed to delete user: ${err.message}`)
    }
  }
}

const formatCurrency = (val: number) => `Rs ${val.toFixed(2)}`
</script>

<template>
  <div class="h-full w-full bg-gray-100 flex flex-col font-sans overflow-hidden text-gray-800">
    <!-- Sub Header Bar -->
    <div class="bg-[#714B67] text-white px-6 py-3 flex justify-between items-center shrink-0 shadow-md">
      <div class="flex items-center gap-3">
        <i class="fas fa-briefcase text-amber-300 text-xl"></i>
        <div>
          <h2 class="font-bold text-lg leading-tight">Store Manager & Owner Portal</h2>
          <p class="text-xs text-amber-200/80">Direct Master DB Operations: Products, Combos, Taxes, Stock History & Reports</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button @click="emit('open-pos')" class="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer">
          <i class="fas fa-cash-register"></i> Switch to Sales Register
        </button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="bg-white border-b border-gray-200 px-6 flex gap-4 text-sm font-semibold shrink-0">
      <button 
        @click="activeTab = 'products'" 
        :class="[activeTab === 'products' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors cursor-pointer"
      >
        <i class="fas fa-[#714B67] fa-box"></i>
        <span>Product Catalog</span>
      </button>

      <button 
        @click="activeTab = 'combos'" 
        :class="[activeTab === 'combos' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors cursor-pointer"
      >
        <i class="fas fa-[#714B67] fa-cubes"></i>
        <span>Combos & Recipes (BOM)</span>
      </button>

      <button 
        @click="activeTab = 'taxes'" 
        :class="[activeTab === 'taxes' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors cursor-pointer"
      >
        <i class="fas fa-[#714B67] fa-percent"></i>
        <span>Tax Rules & Setup</span>
      </button>

      <button 
        @click="activeTab = 'inventory'" 
        :class="[activeTab === 'inventory' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors cursor-pointer"
      >
        <i class="fas fa-[#714B67] fa-warehouse"></i>
        <span>Purchase Orders & Inventory</span>
      </button>

      <button 
        @click="activeTab = 'reports'" 
        :class="[activeTab === 'reports' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors cursor-pointer"
      >
        <i class="fas fa-[#714B67] fa-chart-bar"></i>
        <span>Sales Reports & Master DB</span>
      </button>

      <button 
        @click="activeTab = 'users'" 
        :class="[activeTab === 'users' ? 'border-[#714B67] text-[#714B67] border-b-2 font-bold' : 'text-gray-600 hover:text-gray-900']"
        class="py-3 px-2 flex items-center gap-2 transition-colors cursor-pointer"
      >
        <i class="fas fa-users text-[#714B67]"></i>
        <span>Staff & Salespersons</span>
      </button>
    </div>

    <!-- Main Content Panel -->
    <div class="flex-1 p-6 overflow-y-auto">

      <!-- TAB 1: PRODUCT CATALOG -->
      <div v-if="activeTab === 'products'" class="space-y-5">

        <!-- Products List Card -->
        <div class="bg-white p-6 rounded-xl shadow-xs border border-gray-200 space-y-4">
          <div class="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h3 class="font-bold text-base text-gray-900">Master Product Catalog</h3>
              <p class="text-xs text-gray-500">Products created here write directly to Master DB and sync to POS terminals.</p>
            </div>

            <div class="flex items-center gap-2">
              <button 
                v-if="productStore.products.length > 0"
                @click="handleClearAllProducts" 
                class="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Clear all pre-existing seeded products"
              >
                <i class="fas fa-trash-alt"></i> Clear Seeded Catalog
              </button>

              <button 
                @click="showCreateProductModal = true" 
                class="px-4 py-2 bg-[#714B67] text-white text-xs font-bold rounded-lg hover:bg-[#5a3a52] flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <i class="fas fa-plus"></i> + Create New Product
              </button>
            </div>
          </div>

          <div v-if="productStore.products.length === 0" class="p-12 text-center text-gray-400 flex flex-col items-center">
            <i class="fas fa-box-open text-4xl text-gray-300 mb-3"></i>
            <p class="text-sm font-bold text-gray-700">Catalog is empty.</p>
            <p class="text-xs text-gray-500 mt-1">Click "+ Create New Product" to manually create your products!</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div v-for="prod in productStore.products" :key="prod.id" class="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-[#714B67] transition-all flex flex-col justify-between shadow-2xs group relative">
              <!-- Edit button (top right, visible on hover) -->
              <button
                @click="handleEditProduct(prod)"
                class="absolute top-2 right-2 w-7 h-7 bg-[#714B67] hover:bg-[#5a3a52] text-white rounded-full flex items-center justify-center text-[11px] opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                title="Edit product"
              >
                <i class="fas fa-pencil-alt"></i>
              </button>

              <div class="flex gap-3 items-center">
                <img :src="prod.image || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(prod.name)" class="w-12 h-12 rounded-lg object-cover bg-gray-100 shrink-0 border border-gray-200" />
                <div>
                  <h4 class="font-bold text-xs text-gray-900 pr-6">{{ prod.name }}</h4>
                  <p class="text-[11px] text-gray-500 font-mono">Barcode: {{ prod.barcode || 'NO-BARCODE' }}</p>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs font-extrabold text-[#714B67]">{{ formatCurrency(prod.price) }}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Stock: {{ prod.stock }} Pcs
                    </span>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 capitalize border border-purple-100">
                      {{ prod.category }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Product Categories Management Card -->
        <div class="bg-white p-6 rounded-xl shadow-xs border border-gray-200 space-y-4">
          <div class="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h3 class="font-bold text-base text-gray-900">
                <i class="fas fa-tags text-[#714B67] mr-1.5"></i>Product Categories
              </h3>
              <p class="text-xs text-gray-500">Manage POS product categories. Categories with assigned products cannot be removed.</p>
            </div>

            <button 
              @click="showAddCategoryForm = !showAddCategoryForm"
              class="px-4 py-2 bg-[#714B67] text-white text-xs font-bold rounded-lg hover:bg-[#5a3a52] flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <i :class="showAddCategoryForm ? 'fas fa-times' : 'fas fa-plus'"></i>
              {{ showAddCategoryForm ? 'Cancel' : '+ Add New Category' }}
            </button>
          </div>

          <!-- Add New Category Form -->
          <div v-if="showAddCategoryForm" class="bg-purple-50/60 border border-purple-100 rounded-xl p-4 space-y-3">
            <h4 class="text-xs font-bold text-purple-900 uppercase tracking-wider">Create New Category</h4>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label class="block text-[11px] font-bold text-gray-700 mb-1">Category Name</label>
                <input 
                  v-model="newCategoryName"
                  type="text"
                  placeholder="e.g. Organic Juices"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#714B67]"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-gray-700 mb-1">Emoji / Icon</label>
                <input 
                  v-model="newCategoryEmoji"
                  type="text"
                  placeholder="e.g. 🧃"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#714B67]"
                  maxlength="4"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-gray-700 mb-1">Color Theme</label>
                <select 
                  v-model="newCategoryColor"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#714B67]"
                >
                  <option value="bg-amber-200 text-amber-900 font-bold">🟡 Amber</option>
                  <option value="bg-orange-200 text-orange-900 font-bold">🟠 Orange</option>
                  <option value="bg-pink-200 text-pink-900 font-bold">🩷 Pink</option>
                  <option value="bg-red-200 text-red-900 font-bold">🔴 Red</option>
                  <option value="bg-purple-200 text-purple-900 font-bold">🟣 Purple</option>
                  <option value="bg-blue-200 text-blue-900 font-bold">🔵 Blue</option>
                  <option value="bg-teal-200 text-teal-900 font-bold">🩵 Teal</option>
                  <option value="bg-emerald-200 text-emerald-900 font-bold">🟢 Emerald</option>
                  <option value="bg-lime-200 text-lime-900 font-bold">🟢 Lime</option>
                  <option value="bg-gray-300 text-gray-900 font-bold">⚪ Gray</option>
                </select>
              </div>
              <div>
                <button 
                  @click="handleAddCategory"
                  :disabled="!newCategoryName.trim()"
                  :class="[
                    'w-full px-4 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors',
                    newCategoryName.trim() 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer' 
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  ]"
                >
                  <i class="fas fa-check-circle"></i> Add Category
                </button>
              </div>
            </div>
          </div>

          <!-- Current Categories Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <div 
              v-for="cat in productStore.categories" 
              :key="cat.id"
              class="relative group rounded-xl border border-gray-200 p-3.5 flex flex-col gap-2 transition-all hover:shadow-md"
              :class="cat.id === 'all' ? 'bg-gray-50' : 'bg-white'"
            >
              <!-- Remove Button (top-right) -->
              <button
                v-if="cat.id !== 'all' && cat.id !== 'misc'"
                @click="handleRemoveCategory(cat.id)"
                class="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px] shadow-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                :title="getCategoryProductCount(cat.id) > 0 ? 'Cannot remove: has ' + getCategoryProductCount(cat.id) + ' products' : 'Remove category'"
              >
                <i class="fas fa-times"></i>
              </button>

              <!-- Category Color Badge -->
              <div 
                class="w-full h-8 rounded-lg flex items-center justify-center text-sm"
                :class="cat.color || 'bg-gray-200 text-gray-900'"
              >
                {{ cat.name }}
              </div>

              <!-- Category Info -->
              <div class="flex justify-between items-center">
                <span class="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{{ cat.id }}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                  {{ getCategoryProductCount(cat.id) }} product{{ getCategoryProductCount(cat.id) === 1 ? '' : 's' }}
                </span>
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
          <button @click="showBomModal = true" class="px-4 py-2 bg-[#714B67] text-white text-xs font-bold rounded-lg hover:bg-[#5a3a52] flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer">
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
            <h3 class="font-bold text-base text-gray-900">Tax Setup &amp; Tax Groups</h3>
            <p class="text-xs text-gray-500">Configure global VAT, Sales Tax rates, and tax inclusive/exclusive rules.</p>
          </div>
          <div class="flex items-center gap-4">
            <button 
            @click="() => { showTaxModal = !showTaxModal; if(!showTaxModal) { editingTaxId = null; newTax = {name: '', rate_percentage: 10, is_inclusive: true, tax_type: 'ITEM'} } }" 
            class="px-4 py-2 bg-[#714B67] text-white text-xs font-bold rounded-lg hover:bg-[#5a3a52] flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <i :class="showTaxModal ? 'fas fa-times' : 'fas fa-percent'"></i>
            {{ showTaxModal ? 'Cancel' : 'Add Tax Group' }}
          </button>
          </div>
        </div>

        <!-- Inline Add Tax Group Form -->
        <div v-if="showTaxModal" class="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 space-y-3">
          <h4 class="text-xs font-bold text-indigo-900 uppercase tracking-wider">{{ editingTaxId ? 'Edit Tax Group' : 'Create New Tax Group' }}</h4>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label class="block text-[11px] font-bold text-gray-700 mb-1">Tax Name</label>
              <input 
                v-model="newTax.name"
                type="text"
                placeholder="e.g. GST 18%"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#714B67]"
              />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-gray-700 mb-1">Rate (%)</label>
              <input 
                v-model.number="newTax.rate_percentage"
                type="number"
                step="0.5"
                min="0"
                max="100"
                placeholder="10"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-[#714B67]"
              />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-gray-700 mb-1">Tax Target</label>
              <select 
                v-model="newTax.tax_type"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#714B67]"
              >
                <option value="ITEM">Applies to individual items</option>
                <option value="BILL">Applies to whole bill (Global)</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-gray-700 mb-1">Tax Mode</label>
              <select 
                v-model="newTax.is_inclusive"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#714B67]"
              >
                <option :value="true">Inclusive (In price)</option>
                <option :value="false">Exclusive (On top)</option>
              </select>
            </div>
            <div>
              <button 
                @click="handleCreateTaxGroup"
                :disabled="!newTax.name.trim()"
                :class="[
                  'w-full px-4 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors',
                  newTax.name.trim() 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                ]"
              >
                <i class="fas fa-check-circle"></i> {{ editingTaxId ? 'Update Tax Group' : 'Save Tax Group' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Existing Tax Groups Grid -->
        <div v-if="taxGroups.length === 0 && !showTaxModal" class="p-12 text-center text-gray-400 flex flex-col items-center">
          <i class="fas fa-percent text-4xl text-gray-300 mb-3"></i>
          <p class="text-sm font-bold text-gray-700">No tax groups configured yet.</p>
          <p class="text-xs text-gray-500 mt-1">Click "Add Tax Group" to create your first tax rule.</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div v-for="tax in taxGroups" :key="tax.tax_group_id" class="p-4 rounded-xl border border-gray-200 bg-gray-50/60 flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-center mb-2">
                <span class="font-bold text-sm text-gray-900">{{ tax.name }}</span>
                <span :class="[tax.is_inclusive ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800']" class="px-2 py-0.5 rounded text-[10px] font-bold">
                  {{ tax.is_inclusive ? 'INCLUSIVE' : 'EXCLUSIVE' }}
                </span>
              </div>
              <div class="mb-1 text-[10px] font-bold text-gray-400">
                <i :class="tax.tax_type === 'BILL' ? 'fas fa-receipt' : 'fas fa-tag'"></i> {{ tax.tax_type === 'BILL' ? 'WHOLE BILL' : 'ITEM LEVEL' }}
              </div>
              <div class="text-2xl font-extrabold text-[#714B67]">{{ tax.rate_percentage }}%</div>
            </div>
            <div class="flex gap-2 mt-4 pt-3 border-t border-gray-200">
              <button @click="handleEditTaxGroup(tax)" class="flex-1 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
                <i class="fas fa-edit mr-1"></i> Edit
              </button>
              <button @click="handleDeleteTaxGroup(tax)" class="flex-1 py-1.5 bg-rose-50 border border-rose-200 rounded text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer">
                <i class="fas fa-trash-alt mr-1"></i> Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 4: INVENTORY & STOCK HISTORY (MANAGER OPTIONS) -->
      <div v-if="activeTab === 'inventory'" class="h-[calc(100vh-170px)] rounded-xl border border-gray-200 overflow-hidden shadow-xs">
        <InventoryHistoryView />
      </div>

      <!-- TAB 5: MULTI-DIMENSIONAL REPORTS -->
      <div v-if="activeTab === 'reports'" class="h-[calc(100vh-170px)] rounded-xl border border-gray-200 overflow-hidden shadow-xs">
        <ReportsView />
      </div>

      <!-- TAB 6: STAFF & USER MANAGEMENT -->
      <div v-if="activeTab === 'users'" class="space-y-5">
        <!-- Top Stats Row -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <div class="text-xs font-bold text-gray-500 uppercase tracking-wider">Total User Accounts</div>
              <div class="text-2xl font-black text-gray-900 mt-1">{{ managerStaffUsers.length }}</div>
            </div>
            <div class="w-12 h-12 rounded-xl bg-purple-50 text-[#714B67] flex items-center justify-center text-xl font-bold border border-purple-100">
              <i class="fas fa-users"></i>
            </div>
          </div>

          <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <div class="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Register Users</div>
              <div class="text-2xl font-black text-emerald-600 mt-1">
                {{ managerStaffUsers.filter(u => getDefaultRightsForUser(u).includes('access_pos')).length }}
              </div>
            </div>
            <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold border border-emerald-100">
              <i class="fas fa-cash-register"></i>
            </div>
          </div>

          <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <div class="text-xs font-bold text-gray-500 uppercase tracking-wider">Portal Managers</div>
              <div class="text-2xl font-black text-indigo-600 mt-1">
                {{ managerStaffUsers.filter(u => getDefaultRightsForUser(u).includes('access_manager_portal')).length }}
              </div>
            </div>
            <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold border border-indigo-100">
              <i class="fas fa-user-tie"></i>
            </div>
          </div>
        </div>

        <!-- Staff List Card -->
        <div class="bg-white p-6 rounded-xl shadow-xs border border-gray-200 space-y-4">
          <div class="flex justify-between items-center border-b border-gray-100 pb-4">
            <div>
              <h3 class="font-bold text-base text-gray-900">User Accounts & Rights Directory</h3>
              <p class="text-xs text-gray-500">Create user accounts, set freeform designations, assign secret PINs, and toggle granular access rights.</p>
            </div>
            <button 
              @click="handleOpenCreateStaff" 
              class="px-4 py-2 bg-[#714B67] hover:bg-[#5a3a52] text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <i class="fas fa-user-plus"></i>
              <span>+ Create New User Account</span>
            </button>
          </div>

          <!-- Staff Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px] tracking-wider">
                  <th class="p-3">User Name</th>
                  <th class="p-3">Login Username</th>
                  <th class="p-3">Designation</th>
                  <th class="p-3">Granted Rights / Access</th>
                  <th class="p-3">Terminal / Branch</th>
                  <th class="p-3">PIN Code</th>
                  <th class="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-if="managerStaffUsers.length === 0">
                  <td colspan="7" class="p-8 text-center text-gray-400 font-medium">
                    No staff accounts found. Click "+ Create New User Account" above to add one.
                  </td>
                </tr>
                <tr v-for="u in managerStaffUsers" :key="u.user_id" class="hover:bg-gray-50/80 transition-colors">
                  <td class="p-3">
                    <div class="flex items-center gap-3">
                      <div 
                        class="w-9 h-9 rounded-xl bg-purple-100 text-[#714B67] flex items-center justify-center font-bold text-sm shrink-0 border border-purple-200"
                      >
                        <i class="fas fa-user"></i>
                      </div>
                      <div>
                        <div class="font-bold text-gray-900 text-xs">{{ u.name }}</div>
                        <div class="text-[10px] text-gray-400">ID: {{ u.user_id?.substr(0, 8) }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="p-3 font-mono font-bold text-gray-700 text-xs">@{{ u.username }}</td>
                  <td class="p-3">
                    <span 
                      class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 text-[#714B67] border border-purple-200"
                    >
                      {{ u.designation || u.role || 'Staff Member' }}
                    </span>
                  </td>
                  <td class="p-3">
                    <div class="flex flex-wrap gap-1 items-center max-w-xs">
                      <template v-if="getDefaultRightsForUser(u).includes('*')">
                        <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">Full Super Access (*)</span>
                      </template>
                      <template v-else>
                        <span 
                          v-for="rKey in getDefaultRightsForUser(u).slice(0, 3)" 
                          :key="rKey"
                          class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[9px] font-bold border border-gray-200"
                        >
                          {{ SYSTEM_RIGHTS.find(r => r.key === rKey)?.label || rKey }}
                        </span>
                        <span v-if="getDefaultRightsForUser(u).length > 3" class="text-[10px] font-bold text-purple-700">
                          +{{ getDefaultRightsForUser(u).length - 3 }} more
                        </span>
                      </template>
                    </div>
                  </td>
                  <td class="p-3 text-gray-600 text-xs">
                    {{ u.node_id ? (masterDbStore.nodes.find(n => n.node_id === u.node_id)?.location_name || 'Main Register') : 'All Terminals' }}
                  </td>
                  <td class="p-3 font-mono font-bold text-gray-600 text-xs">
                    <span class="bg-gray-100 px-2 py-1 rounded border border-gray-200">
                      {{ u.pin ? `${u.pin.slice(0, 1)}•••${u.pin.slice(-1)}` : '••••' }}
                    </span>
                  </td>
                  <td class="p-3 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                      <button 
                        @click="handleEditStaff(u)"
                        class="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        title="Edit Designation, PIN or Rights"
                      >
                        <i class="fas fa-edit text-xs"></i>
                        <span>Edit / Rights</span>
                      </button>
                      <button 
                        @click="handleDeleteStaff(u)"
                        class="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Delete User Account"
                      >
                        <i class="fas fa-trash-alt text-xs"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>

    <!-- Modals -->
    <CreateProductModal 
      :show="showCreateProductModal" 
      :editProduct="editingProduct"
      @close="handleModalClose" 
    />

    <!-- Create / Edit Staff Modal -->
    <div v-if="showStaffModal" class="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        <!-- Modal Header -->
        <div class="bg-[#714B67] text-white px-6 py-4 flex justify-between items-center shadow-xs shrink-0">
          <div class="flex items-center gap-2.5">
            <i class="fas fa-user-shield text-[#e0a96d] text-lg"></i>
            <h3 class="font-bold text-base">{{ editingStaffId ? 'Edit Account & Rights' : 'Create New User Account' }}</h3>
          </div>
          <button @click="showStaffModal = false" class="text-white/70 hover:text-white transition-colors cursor-pointer">
            <i class="fas fa-times text-base"></i>
          </button>
        </div>

        <!-- Form Body -->
        <div class="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Full User Name *</label>
              <input 
                v-model="staffForm.name" 
                type="text" 
                placeholder="e.g. Bilal Ahmed" 
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#714B67]"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Login Username *</label>
              <input 
                v-model="staffForm.username" 
                type="text" 
                placeholder="e.g. bilal" 
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#714B67]"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Designation / String Title *</label>
            <input 
              v-model="staffForm.designation" 
              type="text" 
              placeholder="e.g. Senior Cashier, Store Manager, Shift Supervisor, Head Chef..." 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold text-[#714B67] focus:outline-none focus:ring-2 focus:ring-[#714B67]"
            />
            <div class="flex gap-1.5 mt-1.5 flex-wrap">
              <span class="text-[10px] text-gray-400 font-medium">Quick suggestions:</span>
              <button 
                v-for="preset in ['Salesperson / Cashier', 'Senior Cashier', 'Shift Supervisor', 'Store Manager', 'Inventory Admin']"
                :key="preset"
                @click="staffForm.designation = preset"
                type="button"
                class="text-[10px] px-2 py-0.5 rounded bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-900 border border-gray-200 transition-colors cursor-pointer"
              >
                {{ preset }}
              </button>
            </div>
          </div>

          <!-- Reports To Hierarchy Selector -->
          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Reports To (Superior / Manager in Hierarchy)</label>
            <select 
              v-model="staffForm.reports_to_user_id" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#714B67] bg-white text-gray-900"
            >
              <option :value="null">None (Root / Top Level Manager)</option>
              <option 
                v-for="u in authStore.users.filter(x => x.user_id !== editingStaffId)" 
                :key="u.user_id" 
                :value="u.user_id"
              >
                {{ u.name }} (@{{ u.username }}) — {{ u.designation || 'Staff' }}
              </option>
            </select>
          </div>

          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wider">Secret Login PIN (4-6 Digits) *</label>
              <button 
                @click="generateRandomStaffPin" 
                type="button" 
                class="text-[11px] font-bold text-[#714B67] hover:underline cursor-pointer flex items-center gap-1"
              >
                <i class="fas fa-dice"></i> Auto-Generate
              </button>
            </div>
            <input 
              v-model="staffForm.pin" 
              type="text" 
              maxlength="6"
              placeholder="e.g. 4829" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono font-bold tracking-widest text-[#714B67] focus:outline-none focus:ring-2 focus:ring-[#714B67]"
            />
            <p class="text-[10px] text-gray-400 mt-1">Users will enter this PIN code to switch account on the register.</p>
          </div>

          <!-- Rights & Permissions Checklist Grid -->
          <div class="border-t border-gray-200 pt-3 space-y-2">
            <div class="flex justify-between items-center">
              <div>
                <h4 class="font-extrabold text-xs text-gray-900 uppercase tracking-wider">Assigned Rights & Permissions</h4>
                <p class="text-[11px] text-gray-500">Toggle individual rights to grant or restrict features for this user.</p>
              </div>
              <div class="flex gap-2">
                <button @click="selectAllStaffRights" type="button" class="text-[10px] font-bold text-[#714B67] hover:underline cursor-pointer">
                  Select All
                </button>
                <span class="text-gray-300">|</span>
                <button @click="clearAllStaffRights" type="button" class="text-[10px] font-bold text-gray-500 hover:underline cursor-pointer">
                  Clear All
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 max-h-56 overflow-y-auto">
              <div 
                v-for="r in SYSTEM_RIGHTS" 
                :key="r.key"
                @click="toggleStaffRight(r.key)"
                :class="[
                  staffForm.rights.includes(r.key) 
                    ? 'bg-purple-50/80 border-[#714B67]/40 ring-1 ring-[#714B67]/20' 
                    : 'bg-white border-gray-200 opacity-70 hover:opacity-100'
                ]"
                class="p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer select-none"
              >
                <input 
                  type="checkbox" 
                  :checked="staffForm.rights.includes(r.key)" 
                  class="mt-0.5 text-[#714B67] rounded focus:ring-[#714B67] cursor-pointer" 
                  @click.stop="toggleStaffRight(r.key)"
                />
                <div>
                  <div class="font-bold text-xs text-gray-900 leading-tight">{{ r.label }}</div>
                  <div class="text-[10px] text-gray-500 leading-normal">{{ r.description }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2 shrink-0">
          <button 
            @click="showStaffModal = false" 
            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button 
            @click="handleSaveStaff" 
            class="px-5 py-2 bg-[#714B67] hover:bg-[#5a3a52] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <i class="fas fa-save"></i>
            <span>{{ editingStaffId ? 'Save Rights & Account' : 'Create User Account' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- PDF Report Document Preview & Print Modal -->
    <div v-if="showPdfReportModal" class="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex flex-col p-4 md:p-6 overflow-hidden animate-in fade-in duration-200">
      <!-- Modal Top Toolbar -->
      <div class="w-full max-w-5xl mx-auto mb-4 bg-slate-900/90 text-white px-5 py-3 rounded-2xl border border-white/10 flex justify-between items-center shadow-xl no-print">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
            <i class="fas fa-file-pdf text-lg"></i>
          </div>
          <div>
            <h3 class="font-bold text-sm leading-tight text-white">
              {{ reportSubTab === 'item_wise' ? 'Item-Wise Sales & Tax Audit Report' : 'Sales Transactions Ledger' }}
            </h3>
            <p class="text-[11px] text-gray-400">Previewing document before sending to printer or saving as PDF</p>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <button 
            @click="handleExecutePrint" 
            class="px-4 py-2 bg-[#714B67] hover:bg-[#5c3d54] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <i class="fas fa-print text-amber-300"></i>
            <span>Print Report</span>
          </button>

          <button 
            @click="showPdfReportModal = false" 
            class="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <i class="fas fa-times"></i>
            <span>Close Preview</span>
          </button>
        </div>
      </div>

      <!-- Printable A4 Document Sheet Canvas -->
      <div class="flex-1 overflow-y-auto flex justify-center p-2">
        <div 
          id="printable-pdf-document" 
          class="w-full max-w-4xl bg-white text-gray-900 rounded-xl shadow-2xl p-8 md:p-12 border border-gray-200 min-h-[900px] flex flex-col justify-between font-sans"
        >
          <!-- Document Header -->
          <div>
            <div class="flex justify-between items-start border-b-2 border-purple-900 pb-5 mb-6">
              <div>
                <h1 class="text-2xl font-black text-[#714B67] tracking-tight uppercase">
                  {{ settingsStore.storeName || 'POS ENTERPRISE SYSTEM' }}
                </h1>
                <div class="text-xs text-gray-500 mt-1 font-semibold">
                  Official Sales, Tax & Revenue Accounting Report
                </div>
                <div class="text-[11px] text-gray-400 mt-0.5">
                  Generated On: {{ new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }) }}
                </div>
              </div>

              <div class="text-right">
                <span class="inline-block px-3 py-1 bg-purple-100 text-[#714B67] font-black text-xs uppercase rounded-md tracking-wider border border-purple-200">
                  {{ reportSubTab === 'item_wise' ? 'ITEM-WISE TAX AUDIT' : 'TRANSACTION LOG' }}
                </span>
                <div class="text-xs font-mono text-gray-600 mt-2">
                  Period: <span class="font-bold text-gray-900">{{ reportFromDate }}</span> to <span class="font-bold text-gray-900">{{ reportToDate }}</span>
                </div>
                <div class="text-[11px] text-gray-500 mt-0.5">
                  Generated By: <span class="font-bold text-gray-800">{{ authStore.currentUser?.name || 'Manager' }}</span>
                </div>
              </div>
            </div>

            <!-- KPI Cards Overview -->
            <div class="grid grid-cols-4 gap-3 mb-6">
              <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div class="text-[10px] font-bold text-gray-500 uppercase">Untaxed Base</div>
                <div class="text-base font-black text-gray-900 mt-0.5">
                  {{ formatCurrency(itemWiseSummary.total_untaxed_amount) }}
                </div>
              </div>
              <div class="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                <div class="text-[10px] font-bold text-indigo-700 uppercase">Item Taxes</div>
                <div class="text-base font-black text-indigo-700 mt-0.5">
                  {{ formatCurrency(itemWiseSummary.total_item_tax) }}
                </div>
              </div>
              <div class="p-3 bg-purple-50/50 border border-purple-100 rounded-lg">
                <div class="text-[10px] font-bold text-purple-700 uppercase">Bill / Order Taxes</div>
                <div class="text-base font-black text-purple-700 mt-0.5">
                  {{ formatCurrency(itemWiseSummary.total_bill_tax) }}
                </div>
              </div>
              <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div class="text-[10px] font-bold text-emerald-800 uppercase">Total Net Revenue</div>
                <div class="text-base font-black text-emerald-700 mt-0.5">
                  {{ formatCurrency(itemWiseSummary.grand_total) }}
                </div>
              </div>
            </div>

            <!-- Content Table: Item-Wise Report -->
            <div v-if="reportSubTab === 'item_wise'" class="mb-6">
              <table class="w-full text-left text-xs border-collapse border border-gray-300">
                <thead>
                  <tr class="bg-gray-100 border-b border-gray-300 text-gray-800 font-bold uppercase text-[10px] tracking-wider">
                    <th class="p-2.5 border-r border-gray-300">Product Name</th>
                    <th class="p-2.5 border-r border-gray-300 text-center">Category</th>
                    <th class="p-2.5 border-r border-gray-300 text-center">Tax Rate</th>
                    <th class="p-2.5 border-r border-gray-300 text-center">Qty Sold</th>
                    <th class="p-2.5 border-r border-gray-300 text-right">Unit Excl. Tax</th>
                    <th class="p-2.5 border-r border-gray-300 text-right">Tax Total</th>
                    <th class="p-2.5 text-right">Gross Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="r in itemWiseReportData" :key="r.product_id" class="border-b border-gray-200">
                    <td class="p-2.5 border-r border-gray-200">
                      <div class="font-bold text-gray-900">{{ r.product_name }}</div>
                      <div class="text-[9px] text-gray-500 font-mono">SKU: {{ r.barcode || 'N/A' }}</div>
                    </td>
                    <td class="p-2.5 border-r border-gray-200 text-center uppercase text-[10px] font-bold text-gray-600">
                      {{ r.category }}
                    </td>
                    <td class="p-2.5 border-r border-gray-200 text-center font-bold text-purple-900 text-[11px]">
                      {{ r.tax_rate_pct > 0 ? `${r.tax_rate_pct.toFixed(1)}%` : '0%' }}
                    </td>
                    <td class="p-2.5 border-r border-gray-200 text-center font-mono font-bold text-gray-900">
                      {{ r.total_quantity }}
                    </td>
                    <td class="p-2.5 border-r border-gray-200 text-right font-mono text-gray-700">
                      {{ formatCurrency(r.unit_price_excl_tax) }}
                    </td>
                    <td class="p-2.5 border-r border-gray-200 text-right font-mono font-bold text-indigo-700">
                      {{ formatCurrency(r.total_tax_amount) }}
                    </td>
                    <td class="p-2.5 text-right font-mono font-black text-gray-900">
                      {{ formatCurrency(r.total_amount_incl_tax) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Content Table: Transaction Log -->
            <div v-else class="mb-6">
              <table class="w-full text-left text-xs border-collapse border border-gray-300">
                <thead>
                  <tr class="bg-gray-100 border-b border-gray-300 text-gray-800 font-bold uppercase text-[10px] tracking-wider">
                    <th class="p-2.5 border-r border-gray-300">Receipt #</th>
                    <th class="p-2.5 border-r border-gray-300">Date & Time</th>
                    <th class="p-2.5 border-r border-gray-300">Method</th>
                    <th class="p-2.5 border-r border-gray-300 text-right">Subtotal</th>
                    <th class="p-2.5 border-r border-gray-300 text-right">Tax Total</th>
                    <th class="p-2.5 text-right">Net Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="s in salesReportData" :key="s.sale_id" class="border-b border-gray-200">
                    <td class="p-2.5 border-r border-gray-200 font-mono font-bold text-gray-900">
                      POS-{{ s.sale_id?.substr(0, 8).toUpperCase() }}
                    </td>
                    <td class="p-2.5 border-r border-gray-200 text-gray-600">
                      {{ s.created_at ? new Date(s.created_at).toLocaleString() : 'N/A' }}
                    </td>
                    <td class="p-2.5 border-r border-gray-200 font-bold uppercase text-[10px] text-purple-900">
                      {{ s.payment_method }}
                    </td>
                    <td class="p-2.5 border-r border-gray-200 text-right font-mono text-gray-700">
                      {{ formatCurrency(Number(s.subtotal || 0)) }}
                    </td>
                    <td class="p-2.5 border-r border-gray-200 text-right font-mono font-bold text-indigo-700">
                      {{ formatCurrency(Number(s.tax_total || 0)) }}
                    </td>
                    <td class="p-2.5 text-right font-mono font-black text-gray-900">
                      {{ formatCurrency(Number(s.net_total || 0)) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tax Breakdown Summary Card -->
            <div class="flex justify-end mb-8">
              <div class="w-80 bg-gray-50 border border-gray-300 rounded-lg p-4 font-mono text-xs space-y-2">
                <div class="font-bold text-gray-900 border-b border-gray-300 pb-1.5 uppercase font-sans">
                  Tax Calculation Breakdown
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600 font-sans">Untaxed Subtotal:</span>
                  <span class="font-bold">{{ formatCurrency(itemWiseSummary.total_untaxed_amount) }}</span>
                </div>
                <div class="flex justify-between text-indigo-900">
                  <span class="text-gray-600 font-sans">Combined Taxes ({{ itemWiseSummary.effective_tax_rate.toFixed(1) }}%):</span>
                  <span class="font-bold">{{ formatCurrency(itemWiseSummary.total_tax_amount) }}</span>
                </div>
                <div class="flex justify-between text-emerald-950 font-black border-t-2 border-gray-400 pt-1.5 text-sm font-sans">
                  <span>Grand Total:</span>
                  <span class="font-mono text-emerald-700">{{ formatCurrency(itemWiseSummary.grand_total) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Document Footer / Signatures -->
          <div class="border-t border-gray-300 pt-6 mt-6">
            <div class="grid grid-cols-2 gap-12 text-xs">
              <div>
                <div class="text-gray-500 font-medium text-[11px]">System Verification:</div>
                <div class="font-mono text-[10px] text-gray-400 mt-1">SEC-AUDIT-{{ Date.now().toString(36).toUpperCase() }} | Verified Clean</div>
              </div>
              <div class="text-right">
                <div class="border-b border-gray-400 pb-8 mb-1"></div>
                <div class="font-bold text-gray-800 text-xs">Authorized Store Manager Signature</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  body * {
    visibility: hidden;
  }
  #printable-pdf-document, #printable-pdf-document * {
    visibility: visible;
  }
  #printable-pdf-document {
    position: absolute;
    left: 0;
    top: 0;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 24px !important;
    background: white !important;
    color: black !important;
    box-shadow: none !important;
    border: none !important;
  }
  .no-print {
    display: none !important;
  }
}
</style>
