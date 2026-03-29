/**
 * Rounds a number to the specified number of decimal places.
 */
export function roundTo(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Safely parses a numeric string, returning a default value on failure.
 */
export function safeParseFloat(value: any, defaultValue = 0): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safely parses an integer string, returning a default value on failure.
 */
export function safeParseInt(value: any, defaultValue = 0): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Formats a number as currency string with thousands separators.
 */
export function formatCurrency(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Calculates percentage of a value.
 */
export function calculatePercentage(value: number, percentage: number): number {
  return roundTo((value * percentage) / 100);
}

/**
 * Calculates the sum of a numeric property across an array of objects.
 */
export function sumBy<T>(items: T[], key: keyof T): number {
  return items.reduce((sum, item) => {
    const val = safeParseFloat(item[key]);
    return roundTo(sum + val);
  }, 0);
}
