<script setup lang="ts">
import { useSettingsStore } from '../../stores/useSettingsStore'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close'])
const settingsStore = useSettingsStore()
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-200">
      
      <!-- Header -->
      <div class="bg-[#714B67] text-white p-4 flex items-center justify-between">
        <h2 class="text-lg font-bold flex items-center gap-2">
          <i class="fas fa-cog"></i> Terminal Settings
        </h2>
        <button 
          @click="$emit('close')" 
          class="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          title="Close"
        >
          <i class="fas fa-times text-sm"></i>
        </button>
      </div>

      <!-- Content Area -->
      <div class="p-6 space-y-5 text-gray-800 text-xs">
        
        <!-- Immutable Protection Banner -->
        <div class="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900 space-y-1">
          <div class="font-bold flex items-center gap-1.5 text-xs text-[#714B67]">
            <i class="fas fa-shield-alt"></i>
            <span>Protected Installed Node Identity</span>
          </div>
          <p class="text-[11px] leading-relaxed text-purple-800">
            POS type and Store Name are locked at installation setup to protect sales logs, inventory receipts, and financial audit integrity. Switching is disabled in the installed app.
          </p>
        </div>

        <!-- Store Name (Locked) -->
        <div>
          <div class="flex justify-between items-center mb-1">
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider">Store / Outlet Name</label>
            <span class="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1">
              <i class="fas fa-lock text-[8px]"></i> Locked
            </span>
          </div>
          <div class="relative flex items-center">
            <input 
              :value="settingsStore.storeName || 'Main Store'" 
              disabled 
              type="text" 
              class="w-full bg-gray-100 border border-gray-300 rounded-lg shadow-2xs px-3 py-2 text-gray-700 font-bold text-sm cursor-not-allowed select-all"
            />
            <span class="absolute right-3 text-gray-400">
              <i class="fas fa-lock text-xs"></i>
            </span>
          </div>
          <p class="text-[10px] text-gray-400 mt-1">Declared during initial terminal installation setup.</p>
        </div>

        <!-- POS Mode / Type (Locked) -->
        <div>
          <div class="flex justify-between items-center mb-1">
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider">Configured POS Type</label>
            <span class="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1">
              <i class="fas fa-lock text-[8px]"></i> Permanent
            </span>
          </div>

          <!-- Read-only Display of Active Mode -->
          <div class="p-4 rounded-xl border-2 border-purple-200 bg-purple-50/50 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-[#714B67] text-white flex items-center justify-center text-lg shadow-2xs">
                <i :class="settingsStore.posMode === 'restaurant' ? 'fas fa-utensils' : 'fas fa-shopping-cart'"></i>
              </div>
              <div>
                <span class="font-extrabold text-sm text-gray-900 block">
                  {{ settingsStore.posMode === 'restaurant' ? 'Restaurant POS' : 'Store / Retail POS' }}
                </span>
                <span class="text-[11px] text-gray-500">
                  {{ settingsStore.posMode === 'restaurant' 
                    ? 'Enabled Table Canvas & Ingredient BOM Recipes' 
                    : 'Standard Retail Product Catalog & Barcode Sales' }}
                </span>
              </div>
            </div>

            <span class="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-white border border-purple-200 text-[#714B67]">
              Active
            </span>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="bg-gray-50 p-4 border-t border-gray-100 flex justify-end">
        <button 
          @click="$emit('close')" 
          class="px-5 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>

    </div>
  </div>
</template>
