import { sqlite } from '../db/client.js';

export class BOMService {
  // Get Recipe Ingredients for a Product
  static getBOMForProduct(productId: string): any[] {
    const stmt = sqlite.prepare('SELECT * FROM product_bom WHERE parent_product_id = ?');
    return stmt.all(productId) as any[];
  }

  // Deduct Raw Material Ingredients upon Checkout & Record Sync Event
  static deductRecipeIngredients(nodeId: string, parentProductId: string, soldQty: number) {
    const bomEntries = this.getBOMForProduct(parentProductId);
    const deductions: Array<{ ingredientId: string; qtyDeducted: number; uom: string }> = [];

    const updateInv = sqlite.prepare('UPDATE inventory SET quantity = quantity - ?, last_updated = ? WHERE node_id = ? AND product_id = ?');
    const insertEvt = sqlite.prepare('INSERT INTO sync_events (event_id, origin_node_id, table_name, action, payload_json, is_synced, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)');

    for (const entry of bomEntries) {
      const totalIngredientDeduction = entry.quantity_required * soldQty;
      const now = new Date().toISOString();

      // Update Inventory
      updateInv.run(totalIngredientDeduction, now, nodeId, entry.ingredient_product_id);

      deductions.push({
        ingredientId: entry.ingredient_product_id,
        qtyDeducted: totalIngredientDeduction,
        uom: entry.uom
      });

      // Insert Event-Sourcing Delta Record
      insertEvt.run(
        `EVT_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        nodeId,
        'inventory',
        'UPDATE',
        JSON.stringify({
          productId: entry.ingredient_product_id,
          quantityDelta: -totalIngredientDeduction,
          reason: 'BOM_AUTO_DEDUCTION',
          parentProductId: parentProductId
        }),
        now
      );
    }

    return deductions;
  }
}
