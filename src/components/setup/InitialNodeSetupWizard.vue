<template>
  <div class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 font-sans text-slate-800">
    <div class="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-purple-900/20">
      
      <!-- Header Banner -->
      <div class="bg-gradient-to-r from-[#3f2538] to-[#714B67] p-6 text-white flex justify-between items-center relative">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-400 text-gray-900 shadow-sm">
              App Deployment Setup
            </span>
            <span class="text-xs text-amber-200/90 font-mono font-bold">Step {{ step }} of 6</span>
          </div>
          <h1 class="text-2xl font-black tracking-tight text-white">Universal POS Setup Wizard</h1>
          <p class="text-xs text-purple-100/80">Select deployment role, POS workspace mode & initialize user credentials</p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 text-2xl font-bold shadow-inner">
          <i class="fas" :class="step === 1 ? 'fa-laptop' : (step === 2 ? 'fa-store' : (step === 3 ? 'fa-code' : (step === 4 ? 'fa-user-tie' : (step === 5 ? 'fa-cash-register' : 'fa-rocket'))))"></i>
        </div>
      </div>

      <!-- Step Navigation Bar -->
      <div class="grid grid-cols-6 bg-gray-100 border-b border-gray-200 text-[11px] font-bold text-center">
        <div 
          :class="[
            'py-2.5 border-b-2 transition-all flex items-center justify-center space-x-1',
            step === 1 ? 'border-[#714B67] text-[#714B67] bg-white' : (step > 1 ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-gray-400')
          ]"
        >
          <i class="fas" :class="step > 1 ? 'fa-check-circle text-emerald-600' : 'fa-laptop'"></i>
          <span>1. Deployment</span>
        </div>

        <div 
          :class="[
            'py-2.5 border-b-2 transition-all flex items-center justify-center space-x-1',
            step === 2 ? 'border-[#714B67] text-[#714B67] bg-white' : (step > 2 ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-gray-400')
          ]"
        >
          <i class="fas" :class="step > 2 ? 'fa-check-circle text-emerald-600' : 'fa-store'"></i>
          <span>2. POS Type</span>
        </div>

        <div 
          :class="[
            'py-2.5 border-b-2 transition-all flex items-center justify-center space-x-1',
            step === 3 ? 'border-[#714B67] text-[#714B67] bg-white' : (step > 3 ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-gray-400')
          ]"
        >
          <i class="fas" :class="step > 3 ? 'fa-check-circle text-emerald-600' : 'fa-code'"></i>
          <span>3. Dev PIN</span>
        </div>

        <div 
          :class="[
            'py-2.5 border-b-2 transition-all flex items-center justify-center space-x-1',
            step === 4 ? 'border-[#714B67] text-[#714B67] bg-white' : (step > 4 ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-gray-400')
          ]"
        >
          <i class="fas" :class="step > 4 ? 'fa-check-circle text-emerald-600' : 'fa-user-tie'"></i>
          <span>4. Manager</span>
        </div>

        <div 
          :class="[
            'py-2.5 border-b-2 transition-all flex items-center justify-center space-x-1',
            step === 5 ? 'border-[#714B67] text-[#714B67] bg-white' : (step > 5 ? 'border-emerald-500 text-emerald-700 bg-white' : 'border-transparent text-gray-400')
          ]"
        >
          <i class="fas" :class="step > 5 ? 'fa-check-circle text-emerald-600' : 'fa-cash-register'"></i>
          <span>5. Cashiers</span>
        </div>

        <div 
          :class="[
            'py-2.5 border-b-2 transition-all flex items-center justify-center space-x-1',
            step === 6 ? 'border-[#714B67] text-[#714B67] bg-white' : 'border-transparent text-gray-400'
          ]"
        >
          <i class="fas fa-rocket"></i>
          <span>6. Launch</span>
        </div>
      </div>

      <!-- Step Content Container -->
      <div class="p-6 flex-1 overflow-y-auto space-y-6 bg-slate-50">

        <!-- STEP 1: SELECT APPLICATION DEPLOYMENT ROLE -->
        <div v-if="step === 1" class="space-y-4">
          <div class="flex items-center justify-between border-b pb-2">
            <div>
              <h2 class="text-sm font-bold text-gray-800 uppercase tracking-wider">Step 1: Select Application Deployment Role</h2>
              <p class="text-xs text-gray-500">Choose the role for this system installation</p>
            </div>
            <span class="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1.5 shadow-xs">
              <i class="fas fa-check-circle text-emerald-600"></i>
              <span>Active Target: POS Terminal</span>
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            
            <!-- STANDALONE POS / POS TERMINAL CARD -->
            <div 
              @click="selectDeploymentRole('STANDALONE_POS')"
              :class="[
                'p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between shadow-sm',
                selectedRole === 'STANDALONE_POS'
                  ? 'border-[#714B67] bg-purple-50/40 ring-4 ring-[#714B67]/10 shadow-md'
                  : 'border-gray-200 bg-white hover:border-purple-300'
              ]"
            >
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div class="w-10 h-10 rounded-xl bg-[#714B67] text-white flex items-center justify-center text-lg font-bold shadow-sm">
                    ⚡
                  </div>
                  <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Ready
                  </span>
                </div>
                <h3 class="font-bold text-base text-gray-900">POS Terminal</h3>
                <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                  Independent store checkout terminal operating locally with cash register & offline sync capabilities.
                </p>
              </div>

              <div class="mt-4 pt-3 border-t border-gray-100 text-[11px] font-mono text-[#714B67] font-semibold flex items-center justify-between">
                <span>Core Target Active</span>
                <i class="fas fa-check-circle text-emerald-600"></i>
              </div>
            </div>

            <!-- BRANCH SERVER CARD -->
            <div 
              @click="selectDeploymentRole('BRANCH_SERVER')"
              :class="[
                'p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between shadow-sm opacity-75',
                selectedRole === 'BRANCH_SERVER'
                  ? 'border-amber-400 ring-2 ring-amber-200 bg-amber-50/30'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              ]"
            >
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div class="w-10 h-10 rounded-xl bg-gray-200 text-gray-600 flex items-center justify-center text-lg font-bold">
                    🖥️
                  </div>
                  <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                    Phase 2
                  </span>
                </div>
                <h3 class="font-bold text-base text-gray-800">Branch Server</h3>
                <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                  Central Master Server node managing multiple checkout terminals.
                </p>
              </div>

              <div class="mt-4 pt-3 border-t border-gray-200/60 text-[11px] font-mono text-amber-700 font-semibold flex items-center justify-between">
                <span>Multi-Terminal Server</span>
                <i class="fas fa-lock text-amber-600"></i>
              </div>
            </div>

            <!-- ENTERPRISE HQ CARD -->
            <div 
              @click="selectDeploymentRole('LEAF_POS')"
              :class="[
                'p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between shadow-sm opacity-75',
                selectedRole === 'LEAF_POS'
                  ? 'border-amber-400 ring-2 ring-amber-200 bg-amber-50/30'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              ]"
            >
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div class="w-10 h-10 rounded-xl bg-gray-200 text-gray-600 flex items-center justify-center text-lg font-bold">
                    🏢
                  </div>
                  <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                    Phase 2
                  </span>
                </div>
                <h3 class="font-bold text-base text-gray-800">Enterprise HQ Node</h3>
                <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                  Cloud HQ node managing global branch chains and regional servers.
                </p>
              </div>

              <div class="mt-4 pt-3 border-t border-gray-200/60 text-[11px] font-mono text-amber-700 font-semibold flex items-center justify-between">
                <span>HQ Chain Master</span>
                <i class="fas fa-lock text-amber-600"></i>
              </div>
            </div>

          </div>

          <div v-if="notImplementedNotice" class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center space-x-3 shadow-xs">
            <i class="fas fa-exclamation-triangle text-amber-600 text-base shrink-0"></i>
            <div>
              <span class="font-bold">Phase 2 Notice:</span> Server and HQ sync modes are for multi-terminal networks. Please select <strong>POS Terminal</strong> to configure your local terminal workspace.
            </div>
          </div>
        </div>

        <!-- STEP 2: SELECT POS SYSTEM TYPE (RESTAURANT VS STORE/RETAIL) -->
        <div v-else-if="step === 2" class="space-y-4">
          <div class="flex items-center justify-between border-b pb-2">
            <div>
              <h2 class="text-sm font-bold text-gray-800 uppercase tracking-wider">Step 2: Select POS System Type</h2>
              <p class="text-xs text-gray-500">Choose the workspace mode for this POS Terminal</p>
            </div>
            <span class="text-[11px] font-extrabold px-3 py-1 rounded-full bg-purple-100 text-[#714B67] border border-purple-300 flex items-center space-x-1.5 shadow-xs">
              <i class="fas fa-laptop text-[#714B67]"></i>
              <span>Role: POS Terminal</span>
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            
            <!-- RESTAURANT POS CARD -->
            <div 
              @click="managerForm.posMode = 'restaurant'"
              :class="[
                'p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between shadow-sm',
                managerForm.posMode === 'restaurant'
                  ? 'border-[#714B67] bg-purple-50/40 ring-4 ring-[#714B67]/10 shadow-md'
                  : 'border-gray-200 bg-white hover:border-purple-300'
              ]"
            >
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div class="w-12 h-12 rounded-xl bg-[#714B67] text-white flex items-center justify-center text-xl font-bold shadow-sm">
                    🍽️
                  </div>
                  <span 
                    v-if="managerForm.posMode === 'restaurant'" 
                    class="text-[11px] font-black uppercase px-2.5 py-1 rounded-full bg-[#714B67] text-white shadow-xs"
                  >
                    SELECTED
                  </span>
                </div>
                <h3 class="font-bold text-lg text-gray-900">Restaurant POS</h3>
                <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                  Optimized for restaurants, cafés, and food outlets. Includes Floor Plan table canvas, Kitchen Order Tickets (KOT/KDS), and BOM recipe ingredient stock deductions.
                </p>
              </div>

              <div class="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-[#714B67]">Table Canvas</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-[#714B67]">Kitchen KOT</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-[#714B67]">BOM Recipes</span>
              </div>
            </div>

            <!-- STORE / RETAIL POS CARD -->
            <div 
              @click="managerForm.posMode = 'retail'"
              :class="[
                'p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between shadow-sm',
                managerForm.posMode === 'retail'
                  ? 'border-[#00A09D] bg-teal-50/40 ring-4 ring-[#00A09D]/10 shadow-md'
                  : 'border-gray-200 bg-white hover:border-teal-300'
              ]"
            >
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div class="w-12 h-12 rounded-xl bg-[#00A09D] text-white flex items-center justify-center text-xl font-bold shadow-sm">
                    🛒
                  </div>
                  <span 
                    v-if="managerForm.posMode === 'retail'" 
                    class="text-[11px] font-black uppercase px-2.5 py-1 rounded-full bg-[#00A09D] text-white shadow-xs"
                  >
                    SELECTED
                  </span>
                </div>
                <h3 class="font-bold text-lg text-gray-900">Store / Retail POS</h3>
                <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                  Optimized for retail stores, supermarkets, and shops. Includes fast barcode scanner checkout grid, direct inventory management, and serial/lot number tracking.
                </p>
              </div>

              <div class="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-[#00A09D]">Barcode Scanner</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-[#00A09D]">Quick Grid</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-[#00A09D]">Stock Control</span>
              </div>
            </div>

          </div>
        </div>

        <!-- STEP 3: DEVELOPER PIN SETUP -->
        <div v-else-if="step === 3" class="space-y-4">
          <div class="border-b pb-2">
            <h2 class="text-sm font-bold text-gray-800 uppercase tracking-wider">Step 3: Setup Developer PIN & System Account</h2>
            <p class="text-xs text-gray-500">Set the master PIN code for system developer & super admin access</p>
          </div>

          <div class="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 text-xs">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-gray-700 font-bold mb-1">Developer Full Name</label>
                <input 
                  v-model="devForm.name" 
                  type="text" 
                  class="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-gray-900 font-semibold focus:outline-none focus:border-[#714B67] focus:bg-white" 
                  placeholder="e.g. Super Developer"
                  required
                />
              </div>

              <div>
                <label class="block text-gray-700 font-bold mb-1">Developer Username</label>
                <input 
                  v-model="devForm.username" 
                  type="text" 
                  class="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-gray-900 font-semibold focus:outline-none focus:border-[#714B67] focus:bg-white" 
                  placeholder="e.g. dev"
                  required
                />
              </div>
            </div>

            <div>
              <label class="block text-gray-700 font-bold mb-1">Set Developer PIN Code (4 Digits)</label>
              <input 
                v-model="devForm.pin" 
                type="password" 
                maxLength="8"
                class="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-purple-950 font-mono tracking-widest focus:outline-none focus:border-[#714B67] focus:bg-white text-lg font-bold" 
                placeholder="e.g. 1234"
                required
              />
              <p class="text-[11px] text-gray-500 mt-1">
                🔑 Developer PIN grants full access to Developer Settings, DB export/purge, and cloud sync configurations.
              </p>
            </div>
          </div>
        </div>

        <!-- STEP 4: DEVELOPER CREATES STORE MANAGER & STORE DETAILS -->
        <div v-else-if="step === 4" class="space-y-4">
          <div class="border-b pb-2">
            <h2 class="text-sm font-bold text-gray-800 uppercase tracking-wider">Step 4: Create Store Manager & Outlet Configuration</h2>
            <p class="text-xs text-gray-500">Developer creates the primary Store Manager account and configures store details</p>
          </div>

          <div class="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 text-xs">
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-gray-700 font-bold mb-1">Store / Outlet Name</label>
                <input 
                  v-model="managerForm.storeName" 
                  type="text" 
                  class="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-gray-900 font-semibold focus:outline-none focus:border-[#714B67] focus:bg-white" 
                  placeholder="e.g. Main Flagship Store"
                  required
                />
              </div>

              <div>
                <label class="block text-gray-700 font-bold mb-1">Selected POS System Type</label>
                <input 
                  :value="managerForm.posMode === 'restaurant' ? '🍽️ Restaurant POS' : '🛒 Store / Retail POS'" 
                  type="text" 
                  disabled
                  class="w-full bg-gray-100 border border-gray-300 rounded-xl px-3.5 py-2.5 text-gray-800 font-bold"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-gray-700 font-bold mb-1">Manager Full Name</label>
                <input 
                  v-model="managerForm.name" 
                  type="text" 
                  class="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-gray-900 font-semibold focus:outline-none focus:border-[#714B67] focus:bg-white" 
                  placeholder="e.g. Store Manager"
                  required
                />
              </div>

              <div>
                <label class="block text-gray-700 font-bold mb-1">Manager Username</label>
                <input 
                  v-model="managerForm.username" 
                  type="text" 
                  class="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-gray-900 font-semibold focus:outline-none focus:border-[#714B67] focus:bg-white" 
                  placeholder="e.g. manager"
                  required
                />
              </div>

              <div>
                <label class="block text-gray-700 font-bold mb-1">Manager PIN Code</label>
                <input 
                  v-model="managerForm.pin" 
                  type="password" 
                  maxLength="8"
                  class="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-gray-900 font-mono tracking-widest focus:outline-none focus:border-[#714B67] focus:bg-white font-bold" 
                  placeholder="e.g. 5555"
                  required
                />
              </div>
            </div>

            <div>
              <label class="block text-gray-700 font-bold mb-1">Primary Local Database Storage Folder</label>
              <div class="flex gap-2">
                <input 
                  v-model="managerForm.db_storage_path" 
                  type="text" 
                  class="flex-1 bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2 text-gray-900 font-mono text-xs focus:outline-none focus:border-[#714B67] focus:bg-white" 
                  placeholder="F:\POS_Data"
                />
                <button 
                  type="button"
                  @click="handleSelectFolderInWizard" 
                  class="px-3.5 py-2 bg-purple-100 hover:bg-purple-200 text-[#714B67] border border-purple-300 font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                >
                  <i class="fas fa-folder-open"></i>
                  <span>Select Folder</span>
                </button>
              </div>
              <p class="text-[11px] text-gray-500 mt-1">
                📁 This folder will store your actual live SQLite database file (<code class="bg-gray-100 px-1 rounded text-gray-800 font-mono">pos.sqlite</code>) used by the POS system.
              </p>
            </div>
          </div>
        </div>

        <!-- STEP 5: MANAGER CREATES SALESPERSON / CASHIER ACCOUNTS -->
        <div v-else-if="step === 5" class="space-y-4">
          <div class="flex justify-between items-center border-b pb-2">
            <div>
              <h2 class="text-sm font-bold text-gray-800 uppercase tracking-wider">Step 5: Manager Creates Salesperson Accounts</h2>
              <p class="text-xs text-gray-500">Create checkout cashier accounts for POS register operations</p>
            </div>
            <button 
              @click="addSalespersonAccount"
              class="px-3 py-1.5 bg-[#714B67] hover:bg-[#5a3a52] text-white font-bold rounded-lg text-xs flex items-center space-x-1 shadow-xs"
            >
              <i class="fas fa-plus"></i>
              <span>+ Add Salesperson</span>
            </button>
          </div>

          <div class="space-y-3">
            <div 
              v-for="(cashier, index) in salespersons" 
              :key="index"
              class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between gap-3 text-xs"
            >
              <div class="grid grid-cols-3 gap-3 flex-1">
                <div>
                  <label class="block text-gray-600 font-bold mb-0.5 text-[11px]">Salesperson Name</label>
                  <input 
                    v-model="cashier.name" 
                    type="text" 
                    class="w-full bg-slate-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-900 font-semibold focus:outline-none focus:border-[#714B67]" 
                    placeholder="e.g. Alex Salesperson"
                  />
                </div>
                <div>
                  <label class="block text-gray-600 font-bold mb-0.5 text-[11px]">Username</label>
                  <input 
                    v-model="cashier.username" 
                    type="text" 
                    class="w-full bg-slate-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-900 font-semibold focus:outline-none focus:border-[#714B67]" 
                    placeholder="e.g. cashier1"
                  />
                </div>
                <div>
                  <label class="block text-gray-600 font-bold mb-0.5 text-[11px]">PIN Code</label>
                  <input 
                    v-model="cashier.pin" 
                    type="password" 
                    maxLength="8"
                    class="w-full bg-slate-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-900 font-mono tracking-widest focus:outline-none focus:border-[#714B67]" 
                    placeholder="e.g. 0000"
                  />
                </div>
              </div>

              <button 
                v-if="salespersons.length > 1"
                @click="removeSalesperson(index)" 
                class="text-rose-600 hover:text-rose-800 p-2 font-bold"
              >
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- STEP 6: COMPLETE SETUP & LAUNCH -->
        <div v-else-if="step === 6" class="space-y-4 text-center py-4">
          <div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-300 flex items-center justify-center text-3xl mx-auto mb-2 shadow-inner">
            <i class="fas fa-check"></i>
          </div>
          <h2 class="text-xl font-bold text-gray-900">Setup Ready to Launch!</h2>
          <p class="text-xs text-gray-500 max-w-md mx-auto">
            Your Developer, Manager, and Salesperson accounts are ready to be saved into SQLite database.
          </p>

          <div class="bg-white p-5 rounded-2xl border border-gray-200 text-xs font-mono text-left max-w-md mx-auto space-y-2.5 shadow-sm">
            <div class="flex justify-between items-center border-b pb-2">
              <span class="text-gray-500 font-sans font-bold">Deployment Role:</span> 
              <span class="font-bold text-[#714B67]">POS Terminal</span>
            </div>
            <div class="flex justify-between items-center border-b pb-2">
              <span class="text-gray-500 font-sans font-bold">Developer Account:</span> 
              <span class="font-bold text-purple-700">{{ devForm.name }} (PIN: {{ devForm.pin }})</span>
            </div>
            <div class="flex justify-between items-center border-b pb-2">
              <span class="text-gray-500 font-sans font-bold">Store Manager:</span> 
              <span class="font-bold text-blue-700">{{ managerForm.name }} (PIN: {{ managerForm.pin }})</span>
            </div>
            <div class="flex justify-between items-center border-b pb-2">
              <span class="text-gray-500 font-sans font-bold">Salesperson Cashiers:</span> 
              <span class="font-bold text-emerald-700">{{ salespersons.map(s => s.name).join(', ') }}</span>
            </div>
            <div class="flex justify-between"><span class="text-gray-500 font-sans">Store Name:</span> <span class="text-gray-900 font-semibold">{{ managerForm.storeName }}</span></div>
            <div class="flex justify-between"><span class="text-gray-500 font-sans">POS Mode:</span> <span class="text-gray-900 font-semibold uppercase">{{ managerForm.posMode }}</span></div>
          </div>
        </div>

      </div>

      <!-- Wizard Footer Controls -->
      <div class="p-4 bg-white border-t border-gray-200 flex justify-between items-center">
        <button 
          v-if="step > 1"
          @click="step--"
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all border border-gray-300"
        >
          ← Back
        </button>
        <div v-else></div>

        <button 
          @click="handleNext"
          class="px-6 py-2.5 bg-gradient-to-r from-[#714B67] to-[#714B67]/90 hover:opacity-90 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center space-x-2 cursor-pointer"
        >
          <span>{{ step === 6 ? 'Complete Setup & Launch POS App →' : 'Next Step →' }}</span>
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore, type POSMode } from '../../stores/useSettingsStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useNodeConfigStore } from '../../stores/useNodeConfigStore'
import { useSessionStore } from '../../stores/useSessionStore'
import { useMasterDbStore } from '../../stores/useMasterDbStore'
import { useToast } from '../../composables/useToast'
import type { NodeRole } from '../../types/nodeConfig'

const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const nodeConfigStore = useNodeConfigStore()
const sessionStore = useSessionStore()
const masterDbStore = useMasterDbStore()
const toast = useToast()

const step = ref(1)
const selectedRole = ref<NodeRole>('STANDALONE_POS')
const notImplementedNotice = ref(false)

// Developer Form
const devForm = ref({
  name: 'Super Developer',
  username: 'dev',
  pin: '1234'
})

// Store Manager Form
const managerForm = ref({
  storeName: settingsStore.storeName || 'Main Flagship Store',
  posMode: 'restaurant' as POSMode,
  name: 'Store Manager',
  username: 'manager',
  pin: '5555',
  db_storage_path: 'F:\\tempdb'
})

// Salespersons List created by Manager
const salespersons = ref([
  { name: 'Salesperson Cashier', username: 'cashier', pin: '0000' }
])

function selectDeploymentRole(role: NodeRole) {
  selectedRole.value = role
  if (role === 'BRANCH_SERVER' || role === 'LEAF_POS') {
    notImplementedNotice.value = true
  } else {
    notImplementedNotice.value = false
  }
}

function addSalespersonAccount() {
  salespersons.value.push({
    name: `Cashier ${salespersons.value.length + 1}`,
    username: `cashier${salespersons.value.length + 1}`,
    pin: '0000'
  })
}

function removeSalesperson(index: number) {
  salespersons.value.splice(index, 1)
}

async function handleSelectFolderInWizard() {
  if ((window as any).electronAPI && (window as any).electronAPI.openDirectoryDialog) {
    const selected = await (window as any).electronAPI.openDirectoryDialog()
    if (selected) {
      managerForm.value.db_storage_path = selected
      toast.success(`Selected DB Storage Folder: ${selected}`)
    }
  } else {
    toast.info('Directory picker is active in Electron desktop application mode.')
  }
}

async function handleNext() {
  if (selectedRole.value === 'BRANCH_SERVER' || selectedRole.value === 'LEAF_POS') {
    notImplementedNotice.value = true
    return
  }

  if (step.value === 1) {
    step.value = 2
  } else if (step.value === 2) {
    step.value = 3
  } else if (step.value === 3) {
    if (!devForm.value.pin || !devForm.value.username || !devForm.value.name) {
      toast.warning('Please fill in Developer credentials and set a PIN code.')
      return
    }
    step.value = 4
  } else if (step.value === 4) {
    if (!managerForm.value.storeName || !managerForm.value.username || !managerForm.value.name || !managerForm.value.pin) {
      toast.warning('Please fill in Manager credentials and store details.')
      return
    }
    step.value = 5
  } else if (step.value === 5) {
    step.value = 6
  } else if (step.value === 6) {
    // 1. Save Settings & POS mode
    settingsStore.setMode(managerForm.value.posMode)
    settingsStore.setStoreName(managerForm.value.storeName)

    // Reset session so store starts in CLOSED status
    sessionStore.resetSessionState()
    sessionStore.cashierName = managerForm.value.name

    // Store ONLY the single created terminal (replaces old/dummy terminals!)
    settingsStore.setSingleTerminal(managerForm.value.storeName, managerForm.value.posMode)

    // 2. Save Branch Hierarchy Nodes to DB
    try {
      if (masterDbStore.nodes.length >= 2) {
        await masterDbStore.updateNode(masterDbStore.nodes[0].node_id, { location_name: `${managerForm.value.storeName} HQ` })
        await masterDbStore.updateNode(masterDbStore.nodes[1].node_id, { location_name: `${managerForm.value.storeName} POS Terminal` })
      } else {
        await masterDbStore.addNode({ location_name: `${managerForm.value.storeName} HQ`, node_type: 'ROOT' })
        await masterDbStore.addNode({ location_name: `${managerForm.value.storeName} POS Terminal`, node_type: 'POS' })
      }
    } catch (e) {
      console.warn('Branch hierarchy node setup handled:', e)
    }

    // 3. Save Accounts to SQLite Database
    try {
      await authStore.loadUsers()

      // Save / Update Developer Account
      await authStore.addUser({
        username: devForm.value.username,
        name: devForm.value.name,
        pin: devForm.value.pin,
        role: 'DEVELOPER'
      })

      // Save / Update Manager Account
      const savedManager = await authStore.addUser({
        username: managerForm.value.username,
        name: managerForm.value.name,
        pin: managerForm.value.pin,
        role: 'MANAGER'
      })

      // Save / Update Salesperson Accounts created by Manager
      for (const sp of salespersons.value) {
        if (sp.name && sp.username && sp.pin) {
          await authStore.addUser({
            username: sp.username,
            name: sp.name,
            pin: sp.pin,
            role: 'SALESPERSON'
          })
        }
      }

      // Set logged-in Manager Account by default
      if (savedManager) {
        authStore.currentUser = savedManager
      } else {
        authStore.currentUser = {
          user_id: `mgr-${Date.now()}`,
          username: managerForm.value.username,
          name: managerForm.value.name,
          pin: managerForm.value.pin,
          role: 'MANAGER'
        }
      }
      authStore.activeRole = 'MANAGER'
      authStore.isAuthenticated = true
    } catch (e) {
      console.warn('User account creation handled:', e)
    }

    // 4. Mark Setup as Completed
    nodeConfigStore.completeSetup('STANDALONE_POS', {
      branch_id: managerForm.value.storeName,
      pos_id: 'Register 1',
      db_storage_path: managerForm.value.db_storage_path
    })
  }
}
</script>
