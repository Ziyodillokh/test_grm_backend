import { Product } from '../product.entity';

/**
 * Applies the canonical stock-depletion rule to a Product (BUG G).
 *
 * Business rules:
 * - Non-metric product: `count <= 0` → `is_deleted = true`
 * - Metric product: `y <= 0` → `is_deleted = true` **and** `count` must be
 *   clamped to 0 (a metric carpet with length 0 must also have count 0).
 *
 * No arbitrary thresholds (no `y < 0.2`, no `count < 1`). Callers are
 * responsible for invoking this after every stock change (order/transfer
 * create or return, reject, etc).
 *
 * Restoration is handled by the caller: when stock returns, set
 * `is_deleted = false` *before* calling further logic — this helper only
 * flips the flag to `true`.
 */
export function applyStockDepletion(product: Product, isMetric: boolean): void {
  if (isMetric) {
    if (+product.y <= 0) {
      product.y = 0;
      product.count = 0;
      product.is_deleted = true;
    }
  } else {
    if (+product.count <= 0) {
      product.count = 0;
      product.is_deleted = true;
    }
  }
}
