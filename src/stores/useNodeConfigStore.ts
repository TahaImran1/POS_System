import { defineStore } from 'pinia';
import type { NodeConfig, NodeRole, UpstreamDbConnection } from '../types/nodeConfig';

const STORAGE_KEY = 'pos_universal_node_config';

const defaultConfig: NodeConfig = {
  node_id: '',
  node_role: 'STANDALONE_POS',
  branch_id: '',
  pos_id: '',
  device_name: 'POS Terminal',
  is_setup_completed: false,
  db_storage_path: 'F:\\POS_Data',
  upstream_primary: {
    host: '192.168.1.50',
    port: 5432,
    database: 'pos_master_db',
    username: 'pos_sync_user',
    password: '',
    ssl: false,
    timeout_ms: 5000
  },
  upstream_fallback: {
    host: 'hq.clientdomain.com',
    port: 5432,
    database: 'pos_enterprise_hq',
    username: 'pos_sync_user',
    password: '',
    ssl: true,
    timeout_ms: 10000
  },
  auto_sync_enabled: true,
  sync_interval_seconds: 30
};

export const useNodeConfigStore = defineStore('nodeConfig', {
  state: (): { config: NodeConfig } => ({
    config: JSON.parse(localStorage.getItem(STORAGE_KEY) || JSON.stringify(defaultConfig))
  }),
  getters: {
    isStandalone: (state) => state.config.node_role === 'STANDALONE_POS',
    isServer: (state) => state.config.node_role === 'BRANCH_SERVER' || state.config.node_role === 'ENTERPRISE_HQ',
    isSetupCompleted: (state) => !!state.config.is_setup_completed,
    activeRole: (state) => state.config.node_role
  },
  actions: {
    updateConfig(newConfig: Partial<NodeConfig>) {
      this.config = { ...this.config, ...newConfig };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    },
    completeSetup(role: NodeRole, details: Partial<NodeConfig>) {
      this.config.node_role = role;
      this.config.is_setup_completed = true;
      this.config = { ...this.config, ...details };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    },
    resetSetup() {
      this.config.is_setup_completed = false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    },
    updateUpstreamPrimary(conn: Partial<UpstreamDbConnection>) {
      this.config.upstream_primary = { ...this.config.upstream_primary, ...conn };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    },
    updateUpstreamFallback(conn: Partial<UpstreamDbConnection>) {
      if (!this.config.upstream_fallback) {
        this.config.upstream_fallback = {
          host: '', port: 5432, database: '', username: ''
        };
      }
      this.config.upstream_fallback = { ...this.config.upstream_fallback, ...conn };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    },
    setRole(role: NodeRole) {
      this.config.node_role = role;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    }
  }
});
