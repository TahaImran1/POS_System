import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

const toasts = ref<Toast[]>([])
let _nextId = 1

export function useToast() {
  function show(message: string, type: ToastType = 'info', duration = 3500) {
    const id = _nextId++
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, duration)
  }

  return {
    toasts,
    show,
    success: (msg: string, duration?: number) => show(msg, 'success', duration),
    error:   (msg: string, duration?: number) => show(msg, 'error', duration ?? 5000),
    warning: (msg: string, duration?: number) => show(msg, 'warning', duration),
    info:    (msg: string, duration?: number) => show(msg, 'info', duration),
  }
}
