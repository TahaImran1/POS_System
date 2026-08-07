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
    activeRole: 'DEVELOPER' as UserRole, // default active view role
    users: [] as UserAccount[],
    isAuthenticated: true,
    showLoginModal: false
  }),
  getters: {
    isDeveloper: (state) => state.activeRole === 'DEVELOPER',
    isManager: (state) => state.activeRole === 'MANAGER',
    isSalesperson: (state) => state.activeRole === 'SALESPERSON',
    hasManagerPrivileges: (state) => state.activeRole === 'MANAGER' || state.activeRole === 'DEVELOPER',
    roleLabel: (state) => {
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
        
        // Default to developer if no currentUser set yet
        if (!this.currentUser && this.users.length > 0) {
          const dev = this.users.find(u => u.role === 'DEVELOPER') || this.users[0]
          this.currentUser = dev
          this.activeRole = dev.role
        }
      } catch (e) {
        console.warn('Failed to load users from DB:', e)
      }
    },
    
    async verifyPinAndLogin(pin: string): Promise<boolean> {
      const match = this.users.find(u => u.pin === pin)
      if (match) {
        this.currentUser = match
        this.activeRole = match.role
        this.isAuthenticated = true
        this.showLoginModal = false
        return true
      }
      return false
    },

    verifyManagerPin(pin: string): boolean {
      const match = this.users.find(u => (u.role === 'MANAGER' || u.role === 'DEVELOPER') && u.pin === pin)
      return !!match
    },

    switchRole(role: UserRole) {
      this.activeRole = role
    },

    async addUser(user: Omit<UserAccount, 'user_id' | 'created_at'>) {
      const newUser: UserAccount = {
        ...user,
        user_id: uuidv4(),
        created_at: Date.now()
      }
      try {
        await db.insert(schema.users).values(newUser as any)
        this.users.push(newUser)
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
