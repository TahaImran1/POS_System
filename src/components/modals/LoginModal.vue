<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore, type UserRole } from '../../stores/useAuthStore'
import { useToast } from '../../composables/useToast'

const emit = defineEmits(['close', 'role-changed'])
const authStore = useAuthStore()
const toast = useToast()

const pinInput = ref('')
const errorMsg = ref('')

const appendPin = (num: string) => {
  if (pinInput.value.length < 6) {
    pinInput.value += num
  }
}

const clearPin = () => {
  pinInput.value = ''
  errorMsg.value = ''
}

const handleLogin = async () => {
  if (!pinInput.value) {
    errorMsg.value = 'Please enter a PIN code.'
    return
  }

  const success = await authStore.verifyPinAndLogin(pinInput.value)
  if (success) {
    const userObj = authStore.currentUser
    toast.success(`Welcome ${userObj?.name || 'User'}! Active role: ${authStore.roleLabel}`)
    pinInput.value = ''
    errorMsg.value = ''
    emit('role-changed', authStore.activeRole)
    emit('close')
  } else {
    errorMsg.value = 'Invalid PIN code. Please try again.'
    pinInput.value = ''
  }
}

const quickSwitchRole = (role: UserRole) => {
  authStore.switchRole(role)
  toast.success(`Switched active view to ${authStore.roleLabel}`)
  emit('role-changed', role)
  emit('close')
}

// Handle physical keyboard typing for PIN entry
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key >= '0' && e.key <= '9') {
    appendPin(e.key)
    e.preventDefault()
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    if (pinInput.value.length > 0) {
      pinInput.value = pinInput.value.slice(0, -1)
    } else {
      clearPin()
    }
    e.preventDefault()
  } else if (e.key === 'Enter') {
    handleLogin()
    e.preventDefault()
  } else if (e.key === 'Escape') {
    emit('close')
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
  <div class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 flex flex-col">
      <!-- Header -->
      <div class="bg-[#714B67] text-white p-4 flex justify-between items-center">
        <div class="flex items-center gap-2">
          <i class="fas fa-[#e0a96d] fa-user-shield text-lg"></i>
          <div>
            <h3 class="font-bold text-base tracking-tight">System Security & Role Login</h3>
            <p class="text-xs text-amber-200/80">Select role or enter PIN</p>
          </div>
        </div>
        <button @click="emit('close')" class="text-white/70 hover:text-white text-lg">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Quick Role Select Tabs -->
      <div class="p-4 bg-gray-50 border-b border-gray-200">
        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Switch Active View Mode</div>
        <div class="grid grid-cols-2 gap-2">

          <button 
            @click="quickSwitchRole('MANAGER')"
            :class="[authStore.activeRole === 'MANAGER' ? 'bg-[#714B67] text-white font-bold shadow-xs' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300']"
            class="py-2 px-1 rounded-lg text-xs flex flex-col items-center gap-1 transition-all"
          >
            <i class="fas fa-user-tie"></i>
            <span>Manager</span>
          </button>

          <button 
            @click="quickSwitchRole('SALESPERSON')"
            :class="[authStore.activeRole === 'SALESPERSON' ? 'bg-[#714B67] text-white font-bold shadow-xs' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300']"
            class="py-2 px-1 rounded-lg text-xs flex flex-col items-center gap-1 transition-all"
          >
            <i class="fas fa-cash-register"></i>
            <span>Salesperson</span>
          </button>
        </div>
      </div>

      <!-- PIN Login Keypad -->
      <div class="p-6 flex flex-col items-center">
        <div class="text-xs font-semibold text-gray-600 mb-2">Or enter User PIN:</div>
        
        <!-- Display dots -->
        <div class="flex items-center gap-3 mb-4 h-10 px-4 bg-gray-100 rounded-lg w-full justify-center border border-gray-300">
          <template v-if="pinInput.length > 0">
            <div v-for="i in pinInput.length" :key="i" class="w-3 h-3 rounded-full bg-[#714B67]"></div>
          </template>
          <span v-else class="text-xs text-gray-400">Default PINs: Dev 1234 | Manager 5555 | Sales 0000</span>
        </div>

        <div v-if="errorMsg" class="text-xs text-red-600 font-semibold mb-3 text-center">
          {{ errorMsg }}
        </div>

        <!-- Numpad 0-9 -->
        <div class="grid grid-cols-3 gap-2.5 w-64 mb-4">
          <button v-for="n in 9" :key="n" @click="appendPin(n.toString())" class="h-12 rounded-lg bg-white border border-gray-300 text-lg font-bold text-gray-800 shadow-xs hover:bg-gray-50 active:bg-gray-200 flex items-center justify-center transition-colors">
            {{ n }}
          </button>
          <button @click="clearPin" class="h-12 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors">
            CLEAR
          </button>
          <button @click="appendPin('0')" class="h-12 rounded-lg bg-white border border-gray-300 text-lg font-bold text-gray-800 shadow-xs hover:bg-gray-50 active:bg-gray-200 flex items-center justify-center transition-colors">
            0
          </button>
          <button @click="handleLogin" class="h-12 rounded-lg bg-[#714B67] text-white text-xs font-bold shadow-xs hover:bg-[#5a3a52] flex items-center justify-center transition-colors">
            ENTER
          </button>
        </div>

        <!-- Registered Accounts Table Preview -->
        <div class="w-full mt-2 border-t border-gray-200 pt-3">
          <div class="text-[11px] font-bold text-gray-500 mb-1">Available User Accounts:</div>
          <div class="space-y-1 max-h-28 overflow-y-auto pr-1">
            <div v-for="u in authStore.users" :key="u.user_id" class="flex justify-between items-center text-xs p-1.5 bg-gray-50 rounded border border-gray-200">
              <span class="font-medium text-gray-800">{{ u.name }} ({{ u.role }})</span>
              <span class="text-gray-500 font-mono text-[11px]">PIN: {{ u.pin }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
