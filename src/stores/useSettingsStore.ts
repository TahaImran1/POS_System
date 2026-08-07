import { defineStore } from 'pinia'

export type POSMode = 'retail' | 'restaurant'

export interface POSTerminal {
  id: string
  name: string
  mode: POSMode
  status: 'active' | 'closed'
  lastClosedDate?: string
  lastClosedBalance?: number
}

const STORAGE_KEY_POS_LIST = 'pos_terminals_list'

export const useSettingsStore = defineStore('settings', {
  state: () => {
    const savedTerminals = localStorage.getItem(STORAGE_KEY_POS_LIST)
    const savedMode = localStorage.getItem('pos_active_mode') as POSMode
    const savedStoreName = localStorage.getItem('pos_active_store_name')

    let initialTerminals: POSTerminal[] = []
    if (savedTerminals) {
      try {
        const parsed = JSON.parse(savedTerminals)
        if (Array.isArray(parsed)) {
          initialTerminals = parsed
        }
      } catch (e) {}
    }

    return {
      posMode: savedMode || ('restaurant' as POSMode),
      storeName: savedStoreName || '',
      terminals: initialTerminals
    }
  },
  actions: {
    setMode(mode: POSMode) {
      this.posMode = mode
      localStorage.setItem('pos_active_mode', mode)
    },
    setStoreName(name: string) {
      this.storeName = name
      localStorage.setItem('pos_active_store_name', name)
    },
    addTerminal(name: string, mode: POSMode) {
      // Check if terminal with same name already exists
      const existing = this.terminals.find(t => t.name.toLowerCase() === name.toLowerCase())
      if (!existing) {
        const newTerminal: POSTerminal = {
          id: `pos-${Date.now()}`,
          name,
          mode,
          status: 'closed',
          lastClosedDate: new Date().toLocaleDateString(),
          lastClosedBalance: 0
        }
        this.terminals.unshift(newTerminal)
        this.saveTerminals()
      }
    },
    setSingleTerminal(name: string, mode: POSMode) {
      const single: POSTerminal = {
        id: `pos-${Date.now()}`,
        name,
        mode,
        status: 'closed',
        lastClosedDate: new Date().toLocaleDateString(),
        lastClosedBalance: 0
      }
      this.terminals = [single]
      this.saveTerminals()
    },
    deleteTerminal(id: string) {
      this.terminals = this.terminals.filter(t => t.id !== id)
      this.saveTerminals()
    },
    saveTerminals() {
      localStorage.setItem(STORAGE_KEY_POS_LIST, JSON.stringify(this.terminals))
    }
  }
})
