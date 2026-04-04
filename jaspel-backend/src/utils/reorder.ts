import { sql, and, gte, lt, lte, gt, ne } from "drizzle-orm";
import { DbClient } from "../db";

/**
 * Utility to handle shifting indices for smart re-ordering
 * @param db The database client
 * @param table The drizzle table object
 * @param idColumn The primary key column of the table
 * @param itemId The ID of the item being moved/inserted
 * @param oldIndex The current index (null for NEW items)
 * @param newIndex The target index requested by the user
 */
export async function handleReordering(
  db: any,
  table: any,
  idColumn: any,
  itemId: string,
  oldIndex: number | null | undefined,
  newIndex: number
) {
  const currentOld = oldIndex ?? null;
  
  if (currentOld === null) {
     // INSERT Case: Shift all existing items from target index onwards BY +1
     await db.update(table)
      .set({ urutan: sql`${table.urutan} + 1` })
      .where(gte(table.urutan, newIndex));
  } else if (newIndex < currentOld) {
    // MOVE UP Case (e.g. pos 10 moved to 5): 
    // Shift items originally in pos 5..9 to become 6..10 (BY +1)
    await db.update(table)
      .set({ urutan: sql`${table.urutan} + 1` })
      .where(and(
        gte(table.urutan, newIndex),
        lt(table.urutan, currentOld),
        ne(idColumn, itemId)
      ));
  } else if (newIndex > currentOld) {
    // MOVE DOWN Case (e.g. pos 5 moved to 10):
    // Shift items originally in pos 6..10 to become 5..9 (BY -1)
    await db.update(table)
      .set({ urutan: sql`${table.urutan} - 1` })
      .where(and(
        gt(table.urutan, currentOld),
        lte(table.urutan, newIndex),
        ne(idColumn, itemId)
      ));
  }
}
