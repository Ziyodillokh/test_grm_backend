/**
 * Shared aggregate fields used across Kassa, KassaReport, Report, and BossReport entities.
 * When changing calculation logic, ensure all 4 entities stay in sync.
 *
 * Note: Kassa uses shorter field names (sale, plasticSum, internetShopSum, etc.)
 * while KassaReport, Report, and BossReport use prefixed names (totalSale, totalPlasticSum, etc.).
 * Optional fields (?) are ones that don't exist in ALL 4 entities with that exact name.
 */
export interface IReportAggregates {
  totalSellCount: number;
  additionalProfitTotalSum: number;
  netProfitTotalSum: number;
  totalSize: number;
  totalPlasticSum?: number;
  totalInternetShopSum?: number;
  totalSale?: number;
  totalSaleReturn?: number;
  totalCashCollection?: number;
  totalDiscount?: number;
  totalIncome?: number;
  totalExpense?: number;
}
