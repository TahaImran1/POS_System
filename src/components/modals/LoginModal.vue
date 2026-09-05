<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore, type UserAccount } from '../../stores/useAuthStore'
import { useToast } from '../../composables/useToast'

const emit = defineEmits(['close', 'role-changed'])
const authStore = useAuthStore()
const toast = useToast()

const selectedUser = ref<UserAccount | null>(null)
const pinInput = ref('')
const errorMsg = ref('')
const isSubmitting = ref(false)

const selectUser = (user: UserAccount) => {
  if (selectedUser.value?.user_id === user.user_id) {
    selectedUser.value = null
  } else {
    selectedUser.value = user
  }
  pinInput.value = ''
  errorMsg.value = ''
}

const appendPin = (num: string) => {
  if (pinInput.value.length < 6) {
    pinInput.value += num
    errorMsg.value = ''
  }
  // Auto-submit if PIN reaches standard 4 digits and user selected, or wait for Enter
  if (pinInput.value.length === 4 && selectedUser.value) {
    handleLogin()
  }
}

const clearPin = () => {
  pinInput.value = ''
  errorMsg.value = ''
}

const handleBackspace = () => {
  if (pinInput.value.length > 0) {
    pinInput.value = pinInput.value.slice(0, -1)
    errorMsg.value = ''
  }
}

const handleLogin = async () => {
  if (!pinInput.value) {
    errorMsg.value = 'Please enter your secret PIN.'
    return
  }

  isSubmitting.value = true
  errorMsg.value = ''

  try {
    const result = await authStore.verifyPinAndLogin(
      pinInput.value,
      selectedUser.value ? selectedUser.value.user_id : undefined
    )

    if (result.success && result.user) {
      toast.success(`Welcome ${result.user.name}! Switched to ${authStore.roleLabel}`)
      pinInput.value = ''
      selectedUser.value = null
      emit('role-changed', authStore.activeRole)
      emit('close')
    } else {
      errorMsg.value = result.error || 'Invalid PIN code. Please try again.'
      pinInput.value = ''
    }
  } catch (err: any) {
    errorMsg.value = 'Failed to authenticate user.'
  } finally {
    isSubmitting.value = false
  }
}

// Handle physical keyboard typing for PIN entry
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key >= '0' && e.key <= '9') {
    appendPin(e.key)
    e.preventDefault()
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    handleBackspace()
    e.preventDefault()
  } else if (e.key === 'Enter') {
    handleLogin()
    e.preventDefault()
  } else if (e.key === 'Escape') {
    if (authStore.isAuthenticated) {
      emit('close')
    }
    e.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-150">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-purple-900/20 flex flex-col">
      <!-- Header -->
      <div class="bg-[#714B67] text-white px-5 py-4 flex justify-between items-center shadow-xs">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#e0a96d] border border-white/10">
            <i class="fas" :class="authStore.isAuthenticated ? 'fa-user-lock' : 'fa-shield-alt'"></i>
          </div>
          <div>
            <h3 class="font-bold text-base tracking-tight leading-tight">
              {{ authStore.isAuthenticated ? 'Switch User / Cashier' : 'System Locked — Enter PIN' }}
            </h3>
            <p class="text-[11px] text-amber-200/80">
              {{ authStore.isAuthenticated ? 'Enter your 4-6 digit secret PIN to switch' : 'Please enter your secret PIN to unlock the POS system' }}
            </p>
          </div>
        </div>
        <button 
          v-if="authStore.isAuthenticated"
          @click="emit('close')" 
          class="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Cancel and return to active session"
        >
          <i class="fas fa-times text-base"></i>
        </button>
      </div>

      <!-- User Account Selection List -->
      <div class="p-4 bg-gray-50/80 border-b border-gray-200">
        <div class="flex justify-between items-center mb-2">
          <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Select Account (Optional)</span>
          <span v-if="selectedUser" @click="selectedUser = null" class="text-[11px] font-bold text-[#714B67] hover:underline cursor-pointer">
            Clear Selection
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
          <button 
            v-for="u in authStore.users" 
            :key="u.user_id"
            @click="selectUser(u)"
            :class="[
              selectedUser?.user_id === u.user_id 
                ? 'bg-[#714B67] text-white border-[#714B67] shadow-sm ring-2 ring-[#714B67]/30' 
                : 'bg-white text-gray-800 border-gray-200 hover:border-purple-300 hover:bg-purple-50/40'
            ]"
            class="p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer"
          >
            <div 
              :class="[
                selectedUser?.user_id === u.user_id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              ]"
              class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs"
            >
              <i class="fas fa-user-shield"></i>
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-bold text-xs truncate leading-tight">{{ u.name }}</div>
              <div 
                :class="selectedUser?.user_id === u.user_id ? 'text-amber-200' : 'text-gray-400'"
                class="text-[10px] font-semibold tracking-wider truncate"
              >
                {{ u.designation || u.role || 'Staff Member' }}
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- PIN Input & Keypad -->
      <div class="p-6 flex flex-col items-center bg-white">
        <!-- Target Info & Masked PIN Display -->
        <div class="text-xs font-semibold text-gray-600 mb-2">
          {{ selectedUser ? `Enter PIN for ${selectedUser.name}:` : 'Enter any Registered User PIN:' }}
        </div>

        <div 
          :class="[
            errorMsg ? 'border-red-400 bg-red-50/50 ring-2 ring-red-200' : 'border-gray-300 bg-gray-50 focus-within:ring-2 focus-within:ring-[#714B67]/20'
          ]"
          class="flex items-center gap-3.5 mb-3 h-12 px-6 rounded-xl w-64 justify-center border transition-all"
        >
          <template v-if="pinInput.length > 0">
            <div 
              v-for="i in pinInput.length" 
              :key="i" 
              class="w-3.5 h-3.5 rounded-full bg-[#714B67] shadow-xs animate-in zoom-in-50 duration-100"
            ></div>
          </template>
          <span v-else class="text-xs text-gray-400 font-medium">••••</span>
        </div>

        <!-- Error Message -->
        <div v-if="errorMsg" class="text-xs text-red-600 font-semibold mb-3 text-center animate-in fade-in flex items-center gap-1.5">
          <i class="fas fa-exclamation-circle text-xs"></i>
          <span>{{ errorMsg }}</span>
        </div>

        <!-- Numpad 0-9 Grid -->
        <div class="grid grid-cols-3 gap-2.5 w-64 mb-2">
          <button 
            v-for="n in 9" 
            :key="n" 
            @click="appendPin(n.toString())" 
            class="h-12 rounded-xl bg-gray-50 border border-gray-200 text-lg font-bold text-gray-800 shadow-2xs hover:bg-gray-100 active:bg-gray-200 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
          >
            {{ n }}
          </button>
          
          <button 
            @click="clearPin" 
            class="h-12 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-600 hover:bg-red-100 active:bg-red-200 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
          >
            CLEAR
          </button>
          
          <button 
            @click="appendPin('0')" 
            class="h-12 rounded-xl bg-gray-50 border border-gray-200 text-lg font-bold text-gray-800 shadow-2xs hover:bg-gray-100 active:bg-gray-200 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
          >
            0
          </button>
          
          <button 
            @click="handleLogin" 
            :disabled="isSubmitting"
            class="h-12 rounded-xl bg-[#714B67] text-white text-xs font-bold shadow-xs hover:bg-[#5a3a52] active:bg-[#482e42] active:scale-95 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <i v-if="isSubmitting" class="fas fa-circle-notch fa-spin"></i>
            <span v-else>ENTER</span>
          </button>
        </div>

        <div class="mt-2 text-[11px] text-gray-400 font-medium flex items-center gap-1">
          <i class="fas fa-keyboard text-[10px]"></i>
          <span>Physical keyboard numpad supported (0-9, Enter)</span>
        </div>
      </div>
    </div>
  </div>
</template>
