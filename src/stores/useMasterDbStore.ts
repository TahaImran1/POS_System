import { defineStore } from 'pinia'
import { db } from '../db/client'
import * as schema from '../db/schema'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'

export interface BranchNode {
  node_id: string
  parent_node_id?: string | null
  node_type: 'ROOT' | 'REGION' | 'CITY' | 'BRANCH' | 'POS'
  location_name: string
}

export const useMasterDbStore = defineStore('masterDb', {
  state: () => ({
    masterDbUrl: 'http://localhost:3000',
    wsSyncUrl: 'ws://localhost:3000/ws/sync',
    masterApiKey: 'pos_master_secret_2026',
    connectionStatus: 'disconnected' as 'connected' | 'disconnected' | 'checking',
    nodes: [] as BranchNode[],
    lastCheckTime: null as string | null
  }),
  actions: {
    async loadSettingsAndNodes() {
      try {
        const settings = await db.select().from(schema.app_settings)
        for (const s of settings) {
          if (s.key === 'master_db_url') this.masterDbUrl = s.value
          if (s.key === 'ws_sync_url') this.wsSyncUrl = s.value
          if (s.key === 'master_api_key') this.masterApiKey = s.value
        }

        const loadedNodes = await db.select().from(schema.nodes)
        this.nodes = loadedNodes as BranchNode[]
      } catch (e) {
        console.warn('Error loading master DB settings/nodes:', e)
      }
    },

    async saveSettings(url: string, wsUrl: string, apiKey: string) {
      this.masterDbUrl = url
      this.wsSyncUrl = wsUrl
      this.masterApiKey = apiKey

      const upsertSetting = async (key: string, val: string) => {
        const existing = await db.select().from(schema.app_settings).where(eq(schema.app_settings.key, key))
        if (existing.length > 0) {
          await db.update(schema.app_settings).set({ value: val, updated_at: Date.now() }).where(eq(schema.app_settings.key, key))
        } else {
          await db.insert(schema.app_settings).values({ setting_id: uuidv4(), key, value: val, updated_at: Date.now() })
        }
      }

      await upsertSetting('master_db_url', url)
      await upsertSetting('ws_sync_url', wsUrl)
      await upsertSetting('master_api_key', apiKey)

      await this.testConnection()
    },

    async testConnection(): Promise<boolean> {
      this.connectionStatus = 'checking'
      try {
        const res = await fetch(`${this.masterDbUrl}/health`, { signal: AbortSignal.timeout(3000) })
        if (res.ok) {
          this.connectionStatus = 'connected'
          this.lastCheckTime = new Date().toLocaleTimeString()
          return true
        } else {
          this.connectionStatus = 'disconnected'
          return false
        }
      } catch (e) {
        this.connectionStatus = 'disconnected'
        return false
      }
    },

    async addNode(node: Omit<BranchNode, 'node_id'>) {
      const newNode: BranchNode = {
        ...node,
        node_id: uuidv4()
      }
      try {
        await db.insert(schema.nodes).values(newNode as any)
        this.nodes.push(newNode)

        // Try pushing to Master DB if connected
        if (this.connectionStatus === 'connected') {
          await fetch(`${this.masterDbUrl}/api/nodes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newNode)
          }).catch(err => console.warn('Cloud sync error for node creation:', err))
        }
      } catch (e) {
        console.error('Failed to add node:', e)
        throw e
      }
    },

    async updateNode(node_id: string, updates: Partial<BranchNode>) {
      try {
        await db.update(schema.nodes).set(updates as any).where(eq(schema.nodes.node_id, node_id))
        const idx = this.nodes.findIndex(n => n.node_id === node_id)
        if (idx !== -1) {
          this.nodes[idx] = { ...this.nodes[idx], ...updates }
        }
      } catch (e) {
        console.error('Failed to update node:', e)
        throw e
      }
    },

    async deleteNode(node_id: string) {
      try {
        await db.delete(schema.nodes).where(eq(schema.nodes.node_id, node_id))
        this.nodes = this.nodes.filter(n => n.node_id !== node_id)
      } catch (e) {
        console.error('Failed to delete node:', e)
        throw e
      }
    }
  }
})
