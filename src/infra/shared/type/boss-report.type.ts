type BossReport = {
  period: { from: string | Date; to: string | Date; filial?: string };
  totals: {
    total: number;
    income: number;           // type = Приход
    consumption: number;      // type = Расход
  };
  byTip: {
    cashflow: { income: number; consumption: number; total: number };
    order: { income: number; consumption: number; total: number };
    debt: { income: number; consumption: number; total: number };
    orderDebtOnly: {          // ONLY items with tip='order' AND debt linked
      income: number;
      consumption: number;
      total: number;
    };
  };
  incomeBySlug: {             // only type = Приход
    manager: number;
    accountant: number;
  };
};