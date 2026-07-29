# Master System Architecture & Repository Division

## 1. `POS_System.git` (Frontend Terminal Project)
- **Path**: `f:\Projects\possystem`
- **Responsibility**:
  - Offline-first UI rendering (`Tables`, `Register`, `Orders`, `Dashboard`).
  - SQLite Edge Database (`pos_local.sqlite` via OPFS WASM).
  - Pinia Stores (`useCartStore`, `useProductStore`, `useSessionStore`, `useMasterDbStore`, `useTableStore`).
  - Master DB connection settings & offline sync queue.

## 2. `pos-backend.git` (Master Server Project)
- **Repository URL**: `https://github.com/TahaImran1/pos-backend.git`
- **Responsibility**:
  - Central PostgreSQL 15 database engine on Ubuntu server (port `5433`).
  - Fastify REST APIs (`/api/auth`, `/api/products`, `/api/sessions`, `/api/sales`).
  - Real-time WebSocket event ingestion gateway (`/ws/sync`).
  - Docker Compose orchestration (`odoo_pos_backend_app`, `odoo_pos_postgres_db`, `odoo_pos_nginx_proxy`).
  - Nginx reverse proxy on port `8089` (HTTP) and `8443` (HTTPS).
