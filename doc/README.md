# Odoo 18 Point of Sale (POS) - Exact Clone Prototype

A high-fidelity, responsive Point of Sale (POS) web application prototype that faithfully recreates the **Odoo 17 / Odoo 18 Point of Sale** interface, interactions, aesthetic, and workflow.

Built with **HTML5, Vanilla CSS3**, and **Modern JavaScript (ES6 Modules)** for zero-config deployment and lightning-fast performance.

## ✨ Features

- **Iconic Odoo Dual-Panel Layout**:
  - Left panel: Itemized order ticket, live summary footer, and multi-mode numeric keypad (`Qty`, `% Disc`, `Price`, `+/-`, `Backspace`).
  - Right panel: Searchable product catalog, horizontal category filter chips (`Food & Drinks`, `Desk & Office`, `Electronics`, `Apparel`, `Services`), and Barcode scan simulation.
- **Concurrent Held Orders**:
  - Open multiple order tabs simultaneously (`Order 1`, `Order 2`, etc.) and switch between them instantly.
- **Customer Management Modal**:
  - Search and attach VIP customers (`Anita Oliver`, `Deco Addict`, etc.) complete with loyalty points and address details.
- **Synthesized POS Sound Effects**:
  - Web Audio API synthesizer producing authentic barcode scanner beeps, keypad clicks, error warnings, and cash register completion chimes.
- **Full Payment & Receipt Workflow**:
  - Split tender options (`Cash`, `Bank / Card`, `Customer Account`).
  - Quick cash denomination buttons (`+$10`, `+$20`, `+$50`, `Exact`).
  - Live change returned calculation.
  - Thermal Receipt preview screen with printable layout and order barcode.
- **Session Cash Control & Light/Dark Theme**:
  - Toggle between Odoo Light Mode and Dark Mode.
  - Opening / Closing Cash Register Control modal with cash reconciliation calculation.

---

## 🚀 Quick Start (Local Run)

No build step required! Simply serve the directory with any static HTTP server:

```bash
# Using Python
python -m http.server 8080

# Or using Node serve / npx
npx serve .
```

Open `http://localhost:8080` in your browser.

---

## 🌐 Deploy to Vercel (Free Plan)

This project includes a `vercel.json` configuration for instant static deployment on Vercel:

1. Push this repository to GitHub.
2. Go to [Vercel Dashboard](https://vercel.com/new).
3. Click **Import** next to your `POS_System` GitHub repository.
4. Click **Deploy** (Framework Preset: *Other* / *Static*).
5. Your Odoo POS clone will be live instantly!

Alternatively, if you have Vercel CLI installed:
```bash
npx vercel --prod
```
