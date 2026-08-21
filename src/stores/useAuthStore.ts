import { defineStore } from 'pinia'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'

export type UserRole = 'DEVELOPER' | 'MANAGER' | 'SALESPERSON'

export interface UserAccount {
  user_id: string
  username: string
  name: string
  pin: string
  role: UserRole
  node_id?: string | null
  created_at?: Date | number | null
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
    isDeveloper: (state) => state.isAuthenticated && state.activeRole === 'DEVELOPER',
    isManager: (state) => state.isAuthenticated && state.activeRole === 'MANAGER',
    isSalesperson: (state) => state.isAuthenticated && state.activeRole === 'SALESPERSON',
    hasManagerPrivileges: (state) => state.isAuthenticated && (state.activeRole === 'MANAGER' || state.activeRole === 'DEVELOPER'),
    roleLabel: (state) => {
      if (!state.isAuthenticated) return 'Locked / Login Required'
      switch (state.activeRole) {
        case 'DEVELOPER': return 'Developer / Super Admin'
        case 'MANAGER': return 'Store Manager / Owner'
        case 'SALESPERSON': return 'Salesperson / Cashier'
        default: return 'User'
      }
    }
  },
  actions: {
    async loadUsers() {
      try {
        const loadedUsers = await db.select().from(schema.users)
        this.users = loadedUsers as UserAccount[]
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
        match = this.users.find(u => u.user_id === targetUserId && u.pin === cleanPin)
        if (!match) {
          return { success: false, error: 'Incorrect PIN for the selected user account.' }
        }
      } else {
        match = this.users.find(u => u.pin === cleanPin)
        if (!match) {
          return { success: false, error: 'Invalid PIN. No matching user account found.' }
        }
      }

      if (match) {
        this.currentUser = match
        this.activeRole = match.role
        this.isAuthenticated = true
        this.showLoginModal = false
        return { success: true, user: match }
      }

      return { success: false, error: 'Authentication failed.' }
    },

    verifyManagerPin(pin: string): boolean {
      const match = this.users.find(u => (u.role === 'MANAGER' || u.role === 'DEVELOPER') && u.pin === pin.trim())
      return !!match
    },

    async addUser(user: Omit<UserAccount, 'user_id' | 'created_at'>): Promise<UserAccount> {
      const cleanUsername = user.username.trim()
      
      // Ensure local user cache is populated
      if (this.users.length === 0) {
        await this.loadUsers()
      }

      // Check if username already exists in local cache or DB
      const existing = this.users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase())
      if (existing) {
        await this.updateUser(existing.user_id, {
          name: user.name,
          pin: user.pin,
          role: user.role,
          node_id: user.node_id
        })
        return {
          ...existing,
          name: user.name,
          pin: user.pin,
          role: user.role,
          node_id: user.node_id
        }
      }

      const newUser: UserAccount = {
        ...user,
        username: cleanUsername,
        user_id: uuidv4(),
        created_at: Date.now()
      }
      try {
        await db.insert(schema.users).values(newUser as any)
        this.users.push(newUser)
        return newUser
      } catch (e) {
        console.error('Failed to insert user:', e)
        throw e
      }
    },

    async updateUser(user_id: string, updates: Partial<UserAccount>) {
      try {
        await db.update(schema.users).set(updates as any).where(eq(schema.users.user_id, user_id))
        const idx = this.users.findIndex(u => u.user_id === user_id)
        if (idx !== -1) {
          this.users[idx] = { ...this.users[idx], ...updates }
        }
        if (this.currentUser?.user_id === user_id) {
          this.currentUser = { ...this.currentUser, ...updates }
        }
      } catch (e) {
        console.error('Failed to update user:', e)
        throw e
      }
    },

    async deleteUser(user_id: string) {
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
