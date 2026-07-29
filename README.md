# Enterprise Odoo Point of Sale System (`POS_System`)

An offline-first, high-performance Odoo POS clone built with Vue 3, Vite, TailwindCSS, Pinia, and SQLite OPFS WASM.

---

## 🏗️ Repository Architecture & Separation

This system is structured into two dedicated repositories:

### 1. POS Terminal Web App (`POS_System`)
- **Repository**: `https://github.com/TahaImran1/POS_System.git`
- **Role**: Offline-first POS Terminal Client, Floor Plan Canvas, Cart & Course Management, Orders History, and Local SQLite Edge Engine.
- **Tech Stack**: Vue 3, Vite, TailwindCSS, Pinia, Drizzle ORM + SQLite OPFS WASM.

### 2. POS Master Backend Server (`pos-backend`)
- **Repository**: `https://github.com/TahaImran1/pos-backend.git`
- **Role**: Central Master Server deployed on Ubuntu Server handling Master Product Catalog, Cashier Auth, Cash Control Audits, and Real-Time Event Sync via WebSockets.
- **Tech Stack**: Node.js / Fastify (TypeScript), PostgreSQL 15, Docker Compose, Nginx.

---

## 🔌 Connection & Port Allocation (Ubuntu Server)

| Service | Port / Protocol | Project | Conflict Status |
| :--- | :--- | :--- | :--- |
| **PharmaApp Nginx** | `80` / `443` (HTTP/S) | PharmaApp | Primary Server Proxy |
| **PharmaApp FastAPI** | `8000` (HTTP) | PharmaApp | Primary Backend |
| **PharmaApp Postgres** | `5432` (TCP) | PharmaApp | Primary Database |
| **POS Master Backend API** | `3000` (HTTP/WS) | `pos-backend` | Dedicated API |
| **POS Master PostgreSQL** | `5433` (TCP) | `pos-backend` | Dedicated Master DB |
| **POS Nginx Reverse Proxy** | `8089` / `8443` (HTTP/S) | `pos-backend` | Dedicated POS Nginx |

---

## 🚀 Running POS Terminal Locally

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Open browser
http://localhost:5173/
```
