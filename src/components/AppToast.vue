<script setup lang="ts">
import { useToast } from '../composables/useToast'
const { toasts } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style="max-width: 380px;">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium',
            'border border-white/10 backdrop-blur-sm',
            toast.type === 'success' ? 'bg-emerald-600' :
            toast.type === 'error'   ? 'bg-red-600' :
            toast.type === 'warning' ? 'bg-amber-500 text-gray-900' :
                                       'bg-[#3f2538]'
          ]"
        >
          <i :class="[
            'fas mt-0.5 shrink-0',
            toast.type === 'success' ? 'fa-check-circle' :
            toast.type === 'error'   ? 'fa-times-circle' :
            toast.type === 'warning' ? 'fa-exclamation-triangle' :
                                       'fa-info-circle'
          ]" />
          <span class="leading-snug">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active { transition: all 0.25s ease; }
.toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from   { opacity: 0; transform: translateX(40px); }
.toast-leave-to     { opacity: 0; transform: translateX(40px); }
.toast-move         { transition: transform 0.25s ease; }
</style>
