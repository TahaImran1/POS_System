import { defineStore } from 'pinia'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'
import { hashPin, isHashedPin, comparePin } from '../utils/crypto'

export type UserRole = 'DEVELOPER' | 'MANAGER' | 'SALESPERSON'

export type SystemRightKey =
  | 'pos_register_screen'
  | 'purchase_order_inventory_screen'
  | 'sales_returns_screen'
  | 'reports_analytics_screen'
  | 'user_management_screen'
  | 'system_diagnostics_screen'
  | 'apply_discounts'
  | 'void_orders'
  | 'cash_drawer_drops'
  | 'manage_products'
  | 'manage_inventory'
  | 'manage_combos_bom'
  | 'manage_taxes'
  | 'vendor_payments'
  | 'price_readjustment'
  | 'manage_users'
  | 'assign_rights'

export interface SystemRightDefinition {
  key: SystemRightKey
  label: string
  description: string
  category: 'General' | 'Sales' | 'Management' | 'System'
}

export const SYSTEM_RIGHTS: SystemRightDefinition[] = [
  // Screens / Modules
  { key: 'pos_register_screen', label: 'POS Register Screen', description: 'Can access and operate point of sale register & process orders', category: 'General' },
  { key: 'purchase_order_inventory_screen', label: 'Purchase Orders & Inventory Screen', description: 'Can access Purchase Orders and Inventory inspection module', category: 'General' },
  { key: 'sales_returns_screen', label: 'Sales Returns & Exchanges Screen', description: 'Can process sales return and exchange orders', category: 'General' },
  { key: 'reports_analytics_screen', label: 'Reports & Analytics Screen', description: 'Can access financial reports, sales summaries & tax logs', category: 'General' },
  { key: 'user_management_screen', label: 'Staff & User Management Screen', description: 'Can access staff directory and user account settings', category: 'General' },
  { key: 'system_diagnostics_screen', label: 'System & Node Diagnostics Screen', description: 'Can access node setup, database backups & diagnostics', category: 'General' },

  // Feature Capabilities & Workflows
  { key: 'apply_discounts', label: 'Apply Line & Bill Discounts', description: 'Can apply custom discounts on items or whole cart', category: 'Sales' },
  { key: 'void_orders', label: 'Void / Cancel Orders', description: 'Can void active cart items or cancel completed sales', category: 'Sales' },
  { key: 'cash_drawer_drops', label: 'Cash Drawer & Cash Drops', description: 'Can perform Cash In, Cash Out, and Expense drops', category: 'Sales' },

  { key: 'manage_products', label: 'Manage Product Catalog', description: 'Create, edit, and delete products, categories & UOMs', category: 'Management' },
  { key: 'manage_inventory', label: 'Manage Stock & Restocks', description: 'Create Purchase Orders, manual stock adjustments & wastage', category: 'Management' },
  { key: 'manage_combos_bom', label: 'Manage Combos & Recipes', description: 'Create and configure combo recipes & raw material BOMs', category: 'Management' },
  { key: 'manage_taxes', label: 'Manage Tax Rules', description: 'Configure item-level and bill-level tax groups', category: 'Management' },
  { key: 'vendor_payments', label: 'Vendor Payments & Debit Notes', description: 'Process vendor payouts and claim damaged/expired debit notes', category: 'Management' },
  { key: 'price_readjustment', label: 'Price Readjustment & Fluctuation Audit', description: 'Readjust selling prices and inspect price fluctuation logs', category: 'Management' },

  { key: 'manage_users', label: 'Manage User Accounts', description: 'Create, update, and manage staff user accounts', category: 'System' },
  { key: 'assign_rights', label: 'Right to Assign Rights', description: 'Can assign, grant, and manage user feature rights & permissions', category: 'System' }
]

export interface UserAccount {
  user_id: string
  username: string
  name: string
  pin: string
  role?: UserRole
  designation?: string
  rights?: string[]
  reports_to_user_id?: string | null
  node_id?: string | null
  created_at?: Date | number | null
}

export function isRootSuperDeveloper(user: Partial<UserAccount> | null | undefined): boolean {
  if (!user) return false
  return (
    user.username?.toLowerCase() === 'dev' ||
    user.role === 'DEVELOPER' ||
    Boolean(user.rights?.includes('*'))
  )
}

export function getDefaultRightsForUser(user: Partial<UserAccount>): string[] {
  if (isRootSuperDeveloper(user)) {
    return ['*']
  }
  if (user.rights && Array.isArray(user.rights) && user.rights.length > 0) {
    return user.rights
  }
  // Default feature rights for standard cashier / staff member
  return [
    'pos_register_screen',
    'sales_returns_screen',
    'apply_discounts',
    'cash_drawer_drops'
  ]
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    currentUser: null as UserAccount | null,
    activeRole: 'SALESPERSON' as UserRole,
    users: [] as UserAccount[],
    isAuthenticated: false,
    showLoginModal: false
  }),
  getters: {
    hasRight: (state) => (rightKey: string): boolean => {
      if (!state.isAuthenticated || !state.currentUser) return false
      if (isRootSuperDeveloper(state.currentUser)) return true
      const userRights = state.currentUser.rights || []
      return userRights.includes('*') || userRights.includes(rightKey)
    },
    isDeveloper: (state): boolean => {
      if (!state.isAuthenticated || !state.currentUser) return false
      if (isRootSuperDeveloper(state.currentUser)) return true
      const userRights = state.currentUser.rights || []
      return userRights.includes('system_diagnostics_screen')
    },
    isManager: (state): boolean => {
      if (!state.isAuthenticated || !state.currentUser) return false
      if (isRootSuperDeveloper(state.currentUser)) return true
      const userRights = state.currentUser.rights || []
      return (
        userRights.includes('user_management_screen') ||
        userRights.includes('reports_analytics_screen') ||
        userRights.includes('manage_users') ||
        userRights.includes('assign_rights')
      )
    },
    isSalesperson: (state): boolean => {
      if (!state.isAuthenticated || !state.currentUser) return false
      if (isRootSuperDeveloper(state.currentUser)) return true
      const userRights = state.currentUser.rights || []
      return userRights.includes('pos_register_screen')
    },
    hasManagerPrivileges: (state): boolean => {
      if (!state.isAuthenticated || !state.currentUser) return false
      if (isRootSuperDeveloper(state.currentUser)) return true
      const userRights = state.currentUser.rights || []
      return (
        userRights.includes('user_management_screen') ||
        userRights.includes('reports_analytics_screen') ||
        userRights.includes('system_diagnostics_screen') ||
        userRights.includes('manage_users') ||
        userRights.includes('assign_rights')
      )
    },
    roleLabel: (state) => {
      if (!state.isAuthenticated || !state.currentUser) return 'Locked / Login Required'
      return state.currentUser.designation || state.currentUser.name
    }
  },
  actions: {
    async loadUsers() {
      try {
        const loadedUsers = await db.select().from(schema.users)

        // Dynamic Migration: automatically hash legacy plain-text PINs found in DB
        for (const u of loadedUsers as any[]) {
          if (u.pin && !isHashedPin(u.pin)) {
            try {
              const secureHash = await hashPin(u.pin)
              await db.update(schema.users).set({ pin: secureHash } as any).where(eq(schema.users.user_id, u.user_id))
              u.pin = secureHash
            } catch (err) {
              console.warn(`Could not migrate PIN for user ${u.username}:`, err)
            }
          }
        }

        this.users = (loadedUsers as any[]).map(u => ({
          ...u,
          designation: u.designation || (isRootSuperDeveloper(u) ? 'Developer / Super Admin' : 'Staff Member'),
          rights: getDefaultRightsForUser(u),
          reports_to_user_id: u.reports_to_user_id || null
        })) as UserAccount[]
      } catch (e) {
        console.warn('Failed to load users from DB:', e)
      }
    },
    
    async verifyPinAndLogin(pin: string, targetUserId?: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
      const cleanPin = pin.trim()
      if (!cleanPin) {
        return { success: false, error: 'Please enter a PIN.' }
      }

      let match: UserAccount | undefined
      if (targetUserId) {
        const target = this.users.find(u => u.user_id === targetUserId)
        if (target && (await comparePin(cleanPin, target.pin))) {
          match = target
        } else {
          return { success: false, error: 'Incorrect PIN for the selected user account.' }
        }
      } else {
        for (const u of this.users) {
          if (await comparePin(cleanPin, u.pin)) {
            match = u
            break
          }
        }
        if (!match) {
          return { success: false, error: 'Invalid PIN. No matching user account found.' }
        }
      }

      if (match) {
        const normalizedMatch: UserAccount = {
          ...match,
          designation: match.designation || 'Staff Member',
          rights: getDefaultRightsForUser(match)
        }
        this.currentUser = normalizedMatch
        this.activeRole = (normalizedMatch.role || 'SALESPERSON') as UserRole
        this.isAuthenticated = true
        this.showLoginModal = false
        return { success: true, user: normalizedMatch }
      }

      return { success: false, error: 'Authentication failed.' }
    },

    async verifyManagerPin(pin: string): Promise<boolean> {
      const cleanPin = pin.trim()
      if (!cleanPin) return false

      for (const u of this.users) {
        if (await comparePin(cleanPin, u.pin)) {
          if (isRootSuperDeveloper(u)) return true
          const rights = getDefaultRightsForUser(u)
          if (
            rights.includes('*') ||
            rights.includes('user_management_screen') ||
            rights.includes('reports_analytics_screen') ||
            rights.includes('manage_users') ||
            rights.includes('assign_rights')
          ) {
            return true
          }
        }
      }
      return false
    },

    async addUser(user: Omit<UserAccount, 'user_id' | 'created_at'>): Promise<UserAccount> {
      const cleanUsername = user.username.trim()
      
      if (this.users.length === 0) {
        await this.loadUsers()
      }

      const isRoot = cleanUsername.toLowerCase() === 'dev' || user.role === 'DEVELOPER'
      const designation = user.designation?.trim() || (isRoot ? 'Developer / Super Admin' : 'Staff Member')
      const rights = isRoot ? ['*'] : (user.rights && user.rights.length > 0 ? user.rights : getDefaultRightsForUser(user))
      
      // Ensure PIN is hashed before DB persistence
      const securePin = user.pin ? await hashPin(user.pin) : ''

      const existing = this.users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase())
      if (existing) {
        return await this.updateUser(existing.user_id, {
          name: user.name,
          pin: securePin || existing.pin,
          role: isRoot ? 'DEVELOPER' : (user.role || 'SALESPERSON'),
          designation,
          rights,
          reports_to_user_id: user.reports_to_user_id || null,
          node_id: user.node_id
        })
      }

      const newUser: UserAccount = {
        ...user,
        username: cleanUsername,
        pin: securePin,
        role: isRoot ? 'DEVELOPER' : (user.role || 'SALESPERSON'),
        designation,
        rights,
        reports_to_user_id: user.reports_to_user_id || null,
        user_id: uuidv4(),
        created_at: Date.now()
      }
      try {
        await db.insert(schema.users).values({
          user_id: newUser.user_id,
          username: newUser.username,
          name: newUser.name,
          pin: newUser.pin,
          role: newUser.role || 'SALESPERSON',
          designation: newUser.designation || 'Staff Member',
          rights: newUser.rights,
          reports_to_user_id: newUser.reports_to_user_id || null,
          node_id: newUser.node_id || null,
          created_at: newUser.created_at
        } as any)
        this.users.push(newUser)
        return newUser
      } catch (e) {
        console.error('Failed to insert user:', e)
        throw e
      }
    },

    async updateUser(user_id: string, updates: Partial<UserAccount>): Promise<UserAccount> {
      const existing = this.users.find(u => u.user_id === user_id)
      const isTargetRoot = isRootSuperDeveloper(existing)

      // Super Developer Root User Protection: Root user always retains ['*'] rights
      const finalUpdates = { ...updates }
      if (isTargetRoot) {
        finalUpdates.rights = ['*']
        finalUpdates.role = 'DEVELOPER'
      }

      // Hash new PIN if provided; otherwise omit to preserve existing hashed PIN
      if (finalUpdates.pin && finalUpdates.pin.trim().length > 0) {
        finalUpdates.pin = await hashPin(finalUpdates.pin)
      } else {
        delete finalUpdates.pin
      }

      try {
        const updatePayload: any = {
          name: finalUpdates.name,
          role: finalUpdates.role,
          designation: finalUpdates.designation,
          rights: finalUpdates.rights,
          reports_to_user_id: finalUpdates.reports_to_user_id,
          node_id: finalUpdates.node_id
        }
        if (finalUpdates.pin) {
          updatePayload.pin = finalUpdates.pin
        }

        await db.update(schema.users).set(updatePayload).where(eq(schema.users.user_id, user_id))

        const idx = this.users.findIndex(u => u.user_id === user_id)
        if (idx !== -1) {
          this.users[idx] = { ...this.users[idx], ...finalUpdates }
        }
        if (this.currentUser?.user_id === user_id) {
          this.currentUser = { ...this.currentUser, ...finalUpdates }
        }
        return this.users[idx] || existing!
      } catch (e) {
        console.error('Failed to update user:', e)
        throw e
      }
    },

    async deleteUser(user_id: string) {
      const target = this.users.find(u => u.user_id === user_id)
      if (isRootSuperDeveloper(target)) {
        throw new Error('Super Developer root user cannot be deleted.')
      }

      try {
        await db.delete(schema.users).where(eq(schema.users.user_id, user_id))
        this.users = this.users.filter(u => u.user_id !== user_id)
      } catch (e) {
        console.error('Failed to delete user:', e)
        throw e
      }
    }
  }
})
