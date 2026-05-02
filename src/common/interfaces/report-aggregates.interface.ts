/**
 * Bu interface 3 qatlamli aggregation pattern'ni tasvirlaydi:
 *  - order  (atomic)        — additionalProfit, netProfit, discount, plastic
 *  - kassa  (per-month)     — additionalProfitSum, netProfitSum, discountSum, plasticSum, saleSize, saleCount
 *  - report (cross-filial)  — totalAdditionalProfitSum, totalNetProfitSum, totalDiscountSum, totalPlasticSum, totalSaleSize, totalSaleCount
 *
 * Hozir bu interface bo'sh — kelgusi naming refactor tugagandan keyin har qatlam uchun
 * alohida interface yaratish mumkin (IOrderAggregates, IKassaAggregates, IReportAggregates).
 */
export interface IReportAggregates {}
