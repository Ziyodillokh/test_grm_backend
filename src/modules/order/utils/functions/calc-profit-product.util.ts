import { OrderBasket } from '../../../order-basket/order-basket.entity';


type ProportionalProfit = {
  product: string;
  seller: string;
  price: number;
  x: number;
  isMetric: boolean;
  kv: number;
  plasticSum: number;
  discountSum: number;
  discountPercentage: number;
};

/**
 * Extracts integer and decimal part from a number.
 * @param value - A price value.
 * @returns An object with integer and decimal parts (2 decimal precision).
 */
const priceSpliter = (
  value: number
): { integerPart: number; decimalPart: number } => {
  const integerPart = Math.floor(value);
  const decimalPart = +(value - integerPart).toFixed(2);
  return { integerPart, decimalPart };
};

/**
 * Gets the price per meter from the product.
 * @param basket - The order basket item.
 * @returns price per meter.
 */
const getPriceMeter = (basket: OrderBasket): number =>
  basket.product.bar_code.collection?.collection_prices?.[0]?.priceMeter || 0;

/**
 * Calculates the total price of an order item.
 * @param basket - The order basket item.
 * @returns price.
 */
const calculatePrice = (basket: OrderBasket): number => {
  const priceMeter = getPriceMeter(basket);
  return basket.isMetric
    ? (basket.x / 100) * basket.product.bar_code.size.x * priceMeter
    : basket.product.bar_code.size.kv * basket.x * priceMeter;
};

/**
 * Distributes revenue and discounts proportionally across order items.
 * Applies plastic sum deduction as well.
 */
const util = (
  orderBasket: OrderBasket[],
  totalRevenue: number,
  plasticSum: number
): ProportionalProfit[] => {
  let additionalDecimalSum = 0;
  let discountPercentage = 0;

  const totalCost = +orderBasket.reduce(
    (sum, basket) => sum + calculatePrice(basket),
    0
  ).toFixed(2);

  const profit = +(totalRevenue - totalCost).toFixed(2);

  // case 1: revenue < cost → discount
  // Only apply if discount percentage >= 0.1% (real discounts are at least 1%)
  // Anything below 0.1% is floating-point arithmetic noise
  if (totalCost > totalRevenue && profit < 0) {
    const discountAmount = +(totalCost - totalRevenue).toFixed(2);
    const rawPercentage = (discountAmount * 100) / totalCost;
    if (rawPercentage >= 0.1) {
      discountPercentage = rawPercentage;
    }
    // else: discount is < 0.1% — treat as no discount (floating-point artifact)
  }

  let totalDiscountApplied = 0;

  let proportionalProfits: ProportionalProfit[] = orderBasket.map((basket) => {
    const price = calculatePrice(basket);
    const proportion = price / totalCost;

    let finalPrice = price;
    let discountSum = 0;

    if (profit > 0) {
      // revenue > cost → distribute profit
      const profitShare = proportion * profit;
      const { integerPart, decimalPart } = priceSpliter(finalPrice + profitShare);
      additionalDecimalSum += decimalPart;
      finalPrice = integerPart;
    } else if (profit < 0 && discountPercentage > 0) {
      // revenue < cost → apply discount (only if real discount exists)
      const rawDiscount = (discountPercentage * price) / 100;
      discountSum = +rawDiscount.toFixed(2);
      finalPrice = +(price - discountSum).toFixed(2);
      totalDiscountApplied += discountSum;
    }

    return {
      product: basket.product.id,
      seller: basket.seller.id,
      price: finalPrice,
      x: basket.x,
      isMetric: basket.isMetric,
      kv: 0,
      plasticSum: 0,
      discountSum,
      discountPercentage,
    };
  });

  // Handle rounding correction for profit distribution
  if (profit > 0) {
    proportionalProfits.sort((a, b) => a.price - b.price);
    proportionalProfits[0].price += additionalDecimalSum;
  }

  // 🔥 NEW: reconciliation for discounts
  if (profit < 0 && discountPercentage > 0) {
    const discountAmount = +(totalCost - totalRevenue).toFixed(2);
    let discountDiff = +(discountAmount - totalDiscountApplied).toFixed(2);

    if (Math.abs(discountDiff) >= 0.01) {
      // Apply correction to largest discount item
      proportionalProfits.sort((a, b) => b.discountSum - a.discountSum);
      proportionalProfits[0].discountSum = +(proportionalProfits[0].discountSum + discountDiff).toFixed(2);
      proportionalProfits[0].price = +(proportionalProfits[0].price - discountDiff).toFixed(2);
    }
  }

  // 🔥 NEW: reconciliation for final prices
  let currentSum = proportionalProfits.reduce((sum, p) => sum + p.price, 0);
  let diff = +(totalRevenue - currentSum).toFixed(2);

  if (Math.abs(diff) >= 0.01) {
    proportionalProfits.sort((a, b) => b.price - a.price);
    proportionalProfits[0].price = +(proportionalProfits[0].price + diff).toFixed(2);
  }

  // Handle plastic deduction
  if (plasticSum > 0) {
    proportionalProfits
      .sort((a, b) => b.price - a.price)
      .forEach((item) => {
        if (plasticSum === 0) return;
        const deduction = Math.min(plasticSum, item.price);
        item.plasticSum = deduction;
        item.price -= deduction;
        plasticSum -= deduction;
      });
  }

  return proportionalProfits;
};



export default util;