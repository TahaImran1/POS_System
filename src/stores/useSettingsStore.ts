import { defineStore } from 'pinia'

export type POSMode = 'retail' | 'restaurant'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    posMode: 'restaurant' as POSMode,
    storeName: 'pyora'
  }),
  actions: {
    setMode(mode: POSMode) {
      this.posMode = mode
    },
    setStoreName(name: string) {
      this.storeName = name
    }
  }
})
