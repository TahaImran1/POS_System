import { drizzle } from 'drizzle-orm/sqlite-proxy'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import * as schema from './schema'
import { schemaSql } from './schema.sql'
import { useToast } from '../composables/useToast'

export let db: any
export let opfsDb: any
export let sqlite3: any

// IndexedDB Helper for browser-only backups
async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('pos_offline_db', 1)
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('backup')) {
          db.createObjectStore('backup')
        }
      }
      request.onsuccess = (e: any) => {
        const db = e.target.result
        const transaction = db.transaction('backup', 'readonly')
        const store = transaction.objectStore('backup')
        const getReq = store.get('sqlite_file')
        getReq.onsuccess = () => {
          resolve(getReq.result || null)
        }
        getReq.onerror = () => resolve(null)
      }
      request.onerror = () => resolve(null)
    } catch (err) {
      resolve(null)
    }
  })
}

async function saveToIndexedDB(bytes: Uint8Array): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('pos_offline_db', 1)
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('backup')) {
          db.createObjectStore('backup')
        }
      }
      request.onsuccess = (e: any) => {
        const db = e.target.result
        const transaction = db.transaction('backup', 'readwrite')
        const store = transaction.objectStore('backup')
        store.put(bytes, 'sqlite_file')
        transaction.oncomplete = () => resolve()
      }
      request.onerror = () => resolve()
    } catch (err) {
      resolve()
    }
  })
}

// Helper to read custom configured DB storage folder
export function getCustomDbFolder(): string | null {
  try {
    const raw = localStorage.getItem('pos_universal_node_config')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.db_storage_path && typeof parsed.db_storage_path === 'string') {
        return parsed.db_storage_path.trim()
      }
    }
  } catch (e) {}
  return null
}

// Validate if a byte buffer contains a genuine SQLite 3 database header
export function isValidSqliteBuffer(bytes: Uint8Array | null | undefined): boolean {
  if (!bytes || bytes.length < 100) return false
  // Standard SQLite 3 Magic Header: "SQLite format 3\0"
  const magic = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00]
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) return false
  }
  return true
}

// Auto-save function triggered after every write query
export async function autoSave() {
  if (!opfsDb || !sqlite3) return
  try {
    const byteArray = sqlite3.capi.sqlite3_js_db_export(opfsDb.pointer)
    if (isValidSqliteBuffer(byteArray)) {
      const customFolder = getCustomDbFolder()
      // 1. If in Electron, save to host disk (both AppData & custom configured folder)
      if ((window as any).electronAPI && (window as any).electronAPI.saveLocalDb) {
        await (window as any).electronAPI.saveLocalDb(byteArray, customFolder)
      }
      // 2. Always save to browser IndexedDB as backup
      await saveToIndexedDB(byteArray)
    }
  } catch (err) {
    console.warn('SQLite auto-save warning:', err)
  }
}

export async function saveDbToCustomFolder(targetFolder?: string) {
  const toast = useToast()
  if (!opfsDb || !sqlite3) {
    toast.error('Database not initialized.')
    return false
  }
  try {
    const byteArray = sqlite3.capi.sqlite3_js_db_export(opfsDb.pointer)
    if (!isValidSqliteBuffer(byteArray)) {
      toast.error('Failed to export database bytes: invalid SQLite data.')
      return false
    }
    const folder = targetFolder || getCustomDbFolder()
    if ((window as any).electronAPI && (window as any).electronAPI.saveLocalDb) {
      const res = await (window as any).electronAPI.saveLocalDb(byteArray, folder)
      if (res && res.success) {
        toast.success(`Database saved directly to disk folder: ${folder || 'Default AppData'}`)
        return true
      } else {
        toast.error('Failed to save database to disk: ' + (res?.error || 'Unknown error'))
        return false
      }
    } else {
      await exportDatabase()
      return true
    }
  } catch (err: any) {
    toast.error('Error saving database to folder: ' + err.message)
    return false
  }
}

export async function initDb() {
  if (db) return db

  try {
    const customFolder = getCustomDbFolder()
    // 1. Load database bytes from Electron disk or browser IndexedDB
    let loadedBytes: Uint8Array | null = null
    if ((window as any).electronAPI && (window as any).electronAPI.loadLocalDb) {
      loadedBytes = await (window as any).electronAPI.loadLocalDb(customFolder)
      console.log('[DB] Electron loadLocalDb result:', loadedBytes ? `${loadedBytes.length} bytes` : 'null')
    }
    if (!loadedBytes) {
      loadedBytes = await loadFromIndexedDB()
      console.log('[DB] IndexedDB loadFromIndexedDB result:', loadedBytes ? `${loadedBytes.length} bytes` : 'null')
    }

    // Discard any corrupted non-SQLite payload
    if (loadedBytes && !isValidSqliteBuffer(loadedBytes)) {
      console.warn('[DB] Loaded bytes is not a valid SQLite database header (< 100 bytes or corrupt). Discarding.')
      loadedBytes = null
    }

    sqlite3 = await sqlite3InitModule() as any
    console.log('[DB] SQLite WASM initialized. OPFS available:', !!sqlite3.opfs)

    // 2. Open the database
    if (sqlite3.opfs) {
      // ---------------------------------------------------------------
      // OPFS PATH: persistent storage that survives Ctrl+R automatically
      // (requires COOP+COEP headers — injected by Electron main.cjs)
      // ---------------------------------------------------------------
      console.log('[DB] Using OPFS persistent storage.')
      
      try {
        opfsDb = new sqlite3.oo1.OpfsDb('/pos.sqlite')
      } catch (opfsErr: any) {
        console.warn('[DB] Failed to open existing OPFS DB file (corrupt or 0-byte). Purging and re-creating clean DB...', opfsErr)
        try {
          if (sqlite3.opfs && typeof sqlite3.opfs.unlink === 'function') {
            sqlite3.opfs.unlink('/pos.sqlite')
          } else if (navigator.storage && navigator.storage.getDirectory) {
            const root = await navigator.storage.getDirectory()
            await root.removeEntry('pos.sqlite', { recursive: true }).catch(() => {})
          }
        } catch (unlinkErr) {
          console.warn('[DB] Could not unlink OPFS file:', unlinkErr)
        }

        try {
          opfsDb = new sqlite3.oo1.OpfsDb('/pos.sqlite')
          console.log('[DB] ✅ Fresh OPFS DB initialized.')
        } catch (fallbackErr) {
          console.warn('[DB] OPFS initialization failed after purge. Falling back to in-memory DB:', fallbackErr)
          opfsDb = new sqlite3.oo1.DB(':memory:', 'c')
        }
      }

      // Check if OPFS already has data (i.e., not a cold start)
      let tableCount = 0
      try {
        tableCount = opfsDb.selectValue("SELECT COUNT(*) FROM sqlite_master WHERE type='table'") as number
        console.log(`[DB] OPFS DB has ${tableCount} tables.`)
      } catch (err) {
        console.warn('[DB] Could not read sqlite_master from OPFS DB:', err)
      }

      if (tableCount === 0 && loadedBytes && isValidSqliteBuffer(loadedBytes)) {
        // Cold start: OPFS is empty — import the saved bytes to restore data
        console.log('[DB] OPFS is empty — importing saved bytes to restore data...')
        const ok = await tryImportBytes(loadedBytes)
        if (ok) {
          console.log('[DB] ✅ OPFS cold-start restore succeeded.')
        } else {
          console.error('[DB] ❌ OPFS cold-start restore FAILED — starting fresh.')
        }
      } else if (tableCount > 0) {
        let productCount = 0
        try {
          productCount = opfsDb.selectValue("SELECT COUNT(*) FROM products") as number
        } catch (_) {}
        console.log(`[DB] ✅ OPFS has existing data (${tableCount} tables, ${productCount} products) — no import needed.`)
      }

    } else {
      // ---------------------------------------------------------------
      // IN-MEMORY FALLBACK: No OPFS — must restore from saved bytes on
      // every startup/reload. Requires working sqlite3_js_db_import.
      // ---------------------------------------------------------------
      console.warn('[DB] OPFS is NOT available. Using in-memory DB (data must be restored from saved bytes every reload).')
      opfsDb = new sqlite3.oo1.DB(':memory:', 'c')

      if (loadedBytes && isValidSqliteBuffer(loadedBytes)) {
        console.log(`[DB] Restoring in-memory DB from ${loadedBytes.length} saved bytes...`)
        const ok = await tryImportBytes(loadedBytes)
        if (ok) {
          let productCount = 0
          try { productCount = opfsDb.selectValue("SELECT COUNT(*) FROM products") as number } catch (_) {}
          console.log(`[DB] ✅ In-memory restore succeeded (${productCount} products found).`)
        } else {
          console.error('[DB] ❌ In-memory restore FAILED — all data will appear empty after reload.')
        }
      } else {
        console.log('[DB] No valid saved bytes available — starting with a fresh database.')
      }
    }

    // 3. Apply schema (CREATE TABLE IF NOT EXISTS — always safe)
    opfsDb.exec(schemaSql)
    try {
      opfsDb.exec("ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'misc';")
      console.log('[DB] Migration: category column added to products.')
    } catch (e) {}
    
    // Run safe migrations for tax versioning
    try { opfsDb.exec("ALTER TABLE tax_groups ADD COLUMN tax_type TEXT NOT NULL DEFAULT 'ITEM';") } catch (e) {}
    try { opfsDb.exec("ALTER TABLE tax_groups ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;") } catch (e) {}
    try { opfsDb.exec("ALTER TABLE tax_groups ADD COLUMN parent_tax_id TEXT;") } catch (e) {}

    // Safe dynamic migrations for recently added columns in `sales` table
    const safeAlter = (sql: string) => { try { opfsDb.exec(sql) } catch (_) {} }
    safeAlter("ALTER TABLE sales ADD COLUMN origin_branch_id TEXT;")
    safeAlter("ALTER TABLE sales ADD COLUMN origin_pos_id TEXT;")
    safeAlter("ALTER TABLE sales ADD COLUMN origin_user_id TEXT;")
    safeAlter("ALTER TABLE sales ADD COLUMN synced INTEGER NOT NULL DEFAULT 0;")
    safeAlter("ALTER TABLE sales ADD COLUMN order_type TEXT NOT NULL DEFAULT 'TAKEAWAY';")
    safeAlter("ALTER TABLE sales ADD COLUMN extra_attributes TEXT;")
    safeAlter("ALTER TABLE sales ADD COLUMN created_at INTEGER;")
    safeAlter("ALTER TABLE sales ADD COLUMN updated_at INTEGER;")
    safeAlter("ALTER TABLE sales_audit_logs ADD COLUMN synced INTEGER NOT NULL DEFAULT 0;")
    safeAlter("ALTER TABLE cash_sessions ADD COLUMN expected_closing_balance REAL DEFAULT 0;")
    safeAlter("ALTER TABLE cash_sessions ADD COLUMN closing_cash_counted REAL;")
    safeAlter("ALTER TABLE cash_sessions ADD COLUMN cash_variance REAL;")
    safeAlter("ALTER TABLE cash_sessions ADD COLUMN closing_notes_breakdown TEXT;")
    safeAlter("ALTER TABLE cash_sessions ADD COLUMN closing_note TEXT;")
    safeAlter("ALTER TABLE cash_sessions ADD COLUMN closed_at INTEGER;")
    
    // Migrations for users table designation, rights permissions & reports_to hierarchy
    safeAlter("ALTER TABLE users ADD COLUMN designation TEXT DEFAULT 'Staff Member';")
    safeAlter("ALTER TABLE users ADD COLUMN rights TEXT;")
    safeAlter("ALTER TABLE users ADD COLUMN reports_to_user_id TEXT;")
    safeAlter("ALTER TABLE products ADD COLUMN base_uom TEXT DEFAULT 'PCS';")
    safeAlter("ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'FINISHED_GOOD';")
    safeAlter("ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0;")
    safeAlter(`
      CREATE TABLE IF NOT EXISTS vendor_product_prices (
        id text PRIMARY KEY NOT NULL,
        vendor_id text NOT NULL,
        product_id text NOT NULL,
        uom_name text DEFAULT 'PCS' NOT NULL,
        last_buying_price real DEFAULT 0 NOT NULL,
        updated_at integer
      );
    `)
    safeAlter(`
      CREATE TABLE IF NOT EXISTS vendor_purchases (
        purchase_id text PRIMARY KEY NOT NULL,
        vendor_id text NOT NULL,
        po_id text NOT NULL,
        product_id text NOT NULL,
        product_name text NOT NULL,
        product_barcode text,
        quantity real NOT NULL,
        uom_name text DEFAULT 'PCS' NOT NULL,
        uom_multiplier real DEFAULT 1 NOT NULL,
        unit_cost real DEFAULT 0 NOT NULL,
        total_cost real DEFAULT 0 NOT NULL,
        reference_note text,
        user_name text,
        created_at integer NOT NULL
      );
    `)

    console.log('[DB] Schema verified.')

    db = drizzle(async (sql, params, method) => {
      try {
        const rows: any[] = []
        opfsDb.exec({
          sql: sql,
          bind: params,
          rowMode: 'array',
          callback: (row: any) => {
            rows.push(row)
          }
        })

        // Auto-save to Electron disk + IndexedDB on every mutation
        const upperSql = sql.trim().toUpperCase()
        if (
          upperSql.startsWith('INSERT') || 
          upperSql.startsWith('UPDATE') || 
          upperSql.startsWith('DELETE') || 
          upperSql.startsWith('REPLACE') ||
          upperSql.startsWith('CREATE') || 
          upperSql.startsWith('DROP')
        ) {
          setTimeout(autoSave, 50)
        }

        if (method === 'run') return { rows: [] }
        if (method === 'get') return { rows: rows[0] }
        return { rows }
      } catch (e: any) {
        console.error('[DB] Query execution error:', e, 'SQL:', sql, 'Params:', params)
        throw e
      }
    }, { schema })

    console.log('[DB] Drizzle ORM ready.')
    return db
  } catch (error) {
    console.error('[DB] FATAL: Failed to initialize database:', error)
    throw error
  }
}

/**
 * Attempts to import a raw SQLite byte array into the open opfsDb handle.
 * Tries sqlite3_js_db_import first (WASM helper), then sqlite3_deserialize
 * (C-level API) as a fallback. Returns true if any method succeeded.
 */
async function tryImportBytes(bytes: Uint8Array): Promise<boolean> {
  if (!isValidSqliteBuffer(bytes)) {
    console.warn('[DB] tryImportBytes: payload is not a valid SQLite database header. Aborting import.')
    return false
  }

  // Method 1: sqlite3_js_db_import (high-level WASM helper)
  try {
    if (typeof sqlite3.capi.sqlite3_js_db_import === 'function') {
      sqlite3.capi.sqlite3_js_db_import(opfsDb.pointer, bytes)
      console.log('[DB] sqlite3_js_db_import succeeded.')
      return true
    } else {
      console.warn('[DB] sqlite3_js_db_import not available, trying sqlite3_deserialize...')
    }
  } catch (err) {
    console.warn('[DB] sqlite3_js_db_import threw:', err)
  }

  // Method 2: sqlite3_deserialize (C-level WASM API)
  try {
    if (typeof sqlite3.capi.sqlite3_deserialize === 'function' &&
        typeof sqlite3.wasm.allocFromTypedArray === 'function') {
      const pData = sqlite3.wasm.allocFromTypedArray(bytes)
      const SQLITE_DESERIALIZE_FREEONCLOSE = 0x0001
      const SQLITE_DESERIALIZE_RESIZABLE = 0x0002
      const rc = sqlite3.capi.sqlite3_deserialize(
        opfsDb.pointer,
        'main',
        pData,
        bytes.length,
        bytes.length,
        SQLITE_DESERIALIZE_FREEONCLOSE | SQLITE_DESERIALIZE_RESIZABLE
      )
      if (rc === 0) {
        console.log('[DB] sqlite3_deserialize succeeded.')
        return true
      } else {
        console.error('[DB] sqlite3_deserialize returned error code:', rc)
      }
    } else {
      console.warn('[DB] sqlite3_deserialize or wasm.allocFromTypedArray not available.')
    }
  } catch (err) {
    console.error('[DB] sqlite3_deserialize threw:', err)
  }

  return false
}

export async function exportDatabase() {
  const toast = useToast()
  if (!opfsDb) {
    toast.error('Database not initialized.')
    return
  }
  
  try {
    const byteArray = sqlite3.capi.sqlite3_js_db_export(opfsDb.pointer)
    const blob = new Blob([byteArray], { type: 'application/x-sqlite3' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `pos_export_${new Date().toISOString().slice(0,10)}.sqlite`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to export DB:', error)
    toast.error('Could not export database. OPFS might not be supported or file is locked.')
  }
}
