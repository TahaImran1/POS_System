export type NodeRole = 'STANDALONE_POS' | 'LEAF_POS' | 'BRANCH_SERVER' | 'ENTERPRISE_HQ';

export interface UpstreamDbConnection {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  ssl?: boolean;
  timeout_ms?: number;
}

export interface NodeConfig {
  node_id: string;
  node_role: NodeRole;
  branch_id: string;
  pos_id: string;
  device_name: string;
  is_setup_completed: boolean;
  db_storage_path: string;
  upstream_primary: UpstreamDbConnection;
  upstream_fallback?: UpstreamDbConnection;
  auto_sync_enabled: boolean;
  sync_interval_seconds: number;
}
