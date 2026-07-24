// ============================================================================
// ODOO 18 INVENTORY & RECIPE BOM RENDERER
// ============================================================================

export function renderInventoryTable(ingredients, products, onAdjustStock, onInspectBom) {
  const container = document.getElementById('inventory-table-body');
  if (!container) return;

  container.innerHTML = '';

  // Render Raw Material Ingredients Stock
  Object.values(ingredients).forEach(ing => {
    const isLowStock = ing.stock <= ing.minAlert;

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border-color)';
    tr.innerHTML = `
      <td style="padding:12px; font-weight:600;">
        <i class="fas fa-seedling" style="color:var(--odoo-teal); margin-right:8px;"></i>
        ${ing.name}
      </td>
      <td style="padding:12px;"><span style="background:rgba(1,126,132,0.1); color:var(--odoo-teal); padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700;">RAW MATERIAL</span></td>
      <td style="padding:12px; font-family:var(--font-mono); font-weight:700; color:${isLowStock ? '#ef4444' : 'var(--text-main)'};">
        ${ing.stock} ${ing.uom}
        ${isLowStock ? `<span style="background:#ef4444; color:#fff; padding:1px 6px; border-radius:4px; font-size:10px; margin-left:6px;">LOW STOCK</span>` : ''}
      </td>
      <td style="padding:12px; color:var(--text-muted);">$${ing.cost.toFixed(2)} / ${ing.uom}</td>
      <td style="padding:12px; text-align:right;">
        <button class="btn-stock-add" style="padding:4px 10px; background:var(--odoo-teal); color:#fff; border:none; border-radius:4px; font-weight:600; cursor:pointer; margin-right:6px;">+ Add 10</button>
        <button class="btn-stock-sub" style="padding:4px 10px; background:var(--bg-app); border:1px solid var(--border-color); color:var(--text-main); border-radius:4px; font-weight:600; cursor:pointer;">- Sub 5</button>
      </td>
    `;

    const addBtn = tr.querySelector('.btn-stock-add');
    const subBtn = tr.querySelector('.btn-stock-sub');

    if (addBtn) addBtn.addEventListener('click', () => onAdjustStock(ing.id, 10));
    if (subBtn) subBtn.addEventListener('click', () => onAdjustStock(ing.id, -5));

    container.appendChild(tr);
  });

  // Render Finished Goods BOM Composite Products
  products.filter(p => p.bom && p.bom.length > 0).forEach(prod => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border-color)';
    tr.innerHTML = `
      <td style="padding:12px; font-weight:600;">
        <i class="fas fa-hamburger" style="color:var(--odoo-purple); margin-right:8px;"></i>
        ${prod.name}
      </td>
      <td style="padding:12px;"><span style="background:rgba(16,185,129,0.15); color:#10b981; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700;">FINISHED GOOD (BOM)</span></td>
      <td style="padding:12px; font-family:var(--font-mono); font-weight:700;">Composite Recipe</td>
      <td style="padding:12px; color:var(--text-muted);">$${prod.price.toFixed(2)}</td>
      <td style="padding:12px; text-align:right;">
        <button class="btn-inspect-bom" style="padding:4px 12px; background:var(--odoo-purple); color:#fff; border:none; border-radius:4px; font-weight:600; cursor:pointer;">
          <i class="fas fa-cubes"></i> View Recipe BOM
        </button>
      </td>
    `;

    const inspectBtn = tr.querySelector('.btn-inspect-bom');
    if (inspectBtn) inspectBtn.addEventListener('click', () => onInspectBom(prod.id));

    container.appendChild(tr);
  });
}

export function renderBomModal(product, ingredients) {
  const modal = document.getElementById('product-info-modal-overlay');
  const content = document.getElementById('product-info-modal-content');
  if (!modal || !content) return;

  content.innerHTML = `
    <div style="font-weight:700; font-size:18px; color:var(--text-main); margin-bottom:4px;">${product.name}</div>
    <div style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">Recipe Bill of Materials (BOM) Auto-Deduction Ratios</div>

    <div style="background:var(--bg-app); padding:12px; border-radius:8px; border:1px solid var(--border-color); margin-bottom:16px;">
      ${product.bom.map(b => {
        const ing = ingredients[b.ingredientId] || { name: b.ingredientId, uom: b.uom };
        return `
          <div style="display:flex; justify-space-between; align-items:center; padding:6px 0; border-bottom:1px dashed var(--border-color);">
            <span style="font-weight:600;"><i class="fas fa-seedling" style="color:var(--odoo-teal); margin-right:6px;"></i> ${ing.name}</span>
            <span style="font-family:var(--font-mono); font-weight:700; color:var(--odoo-teal);">${b.qty} ${b.uom} per unit</span>
          </div>
        `;
      }).join('')}
    </div>

    <div style="display:flex; justify-content:flex-end;">
      <button class="action-btn btn-modal-close" style="padding:8px 18px;" onclick="document.getElementById('product-info-modal-overlay').style.display='none';">Close</button>
    </div>
  `;

  modal.style.display = 'flex';
}
