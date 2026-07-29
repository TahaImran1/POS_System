import { drizzle } from 'drizzle-orm/sqlite-proxy'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import * as schema from './schema'
import { schemaSql } from './schema.sql'

export let db: any
export let opfsDb: any
export let sqlite3: any

export async function initDb() {
  if (db) return db

  try {
    sqlite3 = await sqlite3InitModule() as any
    console.log('SQLite WASM initialized.')
    
    if (sqlite3.opfs) {
      console.log('OPFS is available, using persistent storage.')
      opfsDb = new sqlite3.oo1.OpfsDb('/pos.sqlite')
    } else {
      console.warn('OPFS is NOT available. Falling back to in-memory transient DB.')
      opfsDb = new sqlite3.oo1.DB('/pos.sqlite', 'c')
    }

    // Initialize Schema
    opfsDb.exec(schemaSql)
    console.log('Database tables verified.')

    db = drizzle(async (sql, params, method) => {
      try {
        const rows: any[] = []
        opfsDb.exec({
          sql: sql,
          bind: params,
          rowMode: 'array', // Drizzle sqlite-proxy expects any[][]
          callback: (row: any) => {
            rows.push(row)
          }
        })

        if (method === 'run') {
          return { rows: [] } // For run, we just return empty
        }
        return { rows }
      } catch (e: any) {
        console.error('Error executing query:', e, sql, params)
        return { rows: [] }
      }
    }, { schema })
    
    console.log('Drizzle ORM mounted over SQLite WASM.')
    return db
  } catch (error) {
    console.error('Failed to initialize database:', error)
    throw error
  }
}

export async function exportDatabase() {
  if (!opfsDb) {
    alert("Database not initialized.")
    return
  }
  
  try {
    const byteArray = sqlite3.capi.sqlite3_js_db_export(opfsDb.pointer)
    const blob = new Blob([byteArray], { type: "application/x-sqlite3" })
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
    alert("Could not export database. OPFS might not be supported or file is locked.")
  }
}
