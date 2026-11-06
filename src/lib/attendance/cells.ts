// Client-safe helpers for the attendance grids (month.ts itself uses the database)
import type { DayCell } from "./month";

/** Days an admin can switch between present and absent (leave is changed through its request) */
export const isEditableDay = (cell: DayCell, today: string) =>
  cell.day <= today && !["leave", "unpaid", "leave-pending"].includes(cell.status);
