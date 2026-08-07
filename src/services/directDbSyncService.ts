import type { NodeConfig, UpstreamDbConnection } from '../types/nodeConfig';

export interface SyncResult {
  success: boolean;
  pulled_count: number;
  pushed_count: number;
  error?: string;
  target_host: string;
  timestamp: string;
}

export class DirectDbSyncService {
  /**
   * Executes a direct database PULL & PUSH sync cycle
   */
  static async executeSyncCycle(config: NodeConfig): Promise<SyncResult> {
    if (config.node_role === 'STANDALONE_POS') {
      return {
        success: true,
        pulled_count: 0,
        pushed_count: 0,
        target_host: 'LOCAL_ONLY',
        timestamp: new Date().toISOString()
      };
    }

    const primaryTarget = config.upstream_primary;
    const fallbackTarget = config.upstream_fallback;

    try {
      // Attempt sync with Primary target DB
      return await this.syncWithTarget(primaryTarget, config);
    } catch (err: any) {
      console.warn(`Primary DB connection failed (${primaryTarget.host}): ${err.message}. Attempting failover fallback...`);
      
      if (fallbackTarget && fallbackTarget.host) {
        try {
          return await this.syncWithTarget(fallbackTarget, config);
        } catch (fallbackErr: any) {
          return {
            success: false,
            pulled_count: 0,
            pushed_count: 0,
            error: `Primary (${err.message}) and Fallback (${fallbackErr.message}) both failed.`,
            target_host: fallbackTarget.host,
            timestamp: new Date().toISOString()
          };
        }
      }

      return {
        success: false,
        pulled_count: 0,
        pushed_count: 0,
        error: `Primary DB sync failed: ${err.message}`,
        target_host: primaryTarget.host,
        timestamp: new Date().toISOString()
      };
    }
  }

  private static async syncWithTarget(target: UpstreamDbConnection, config: NodeConfig): Promise<SyncResult> {
    // In Electron environment, IPC communicates with Node.js 'pg' driver in main process.
    // In browser dev mode, simulates network sync handshake cleanly.
    if ((window as any).electronAPI && (window as any).electronAPI.directDbSync) {
      const response = await (window as any).electronAPI.directDbSync({
        connection: target,
        node_id: config.node_id,
        branch_id: config.branch_id,
        pos_id: config.pos_id
      });
      return response;
    }

    // Simulated local fallback for dev mode
    console.log(`[Sync Engine] Connecting directly to ${target.host}:${target.port}/${target.database}...`);
    return {
      success: true,
      pulled_count: 0,
      pushed_count: 0,
      target_host: `${target.host}:${target.port}`,
      timestamp: new Date().toISOString()
    };
  }
}
