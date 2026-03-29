enum ActionTypeEnum {
  user_create = 'user create',
  user_delete = 'user delete',
  user_update = 'user updete',
  partiya_create = 'create partiya',
  partiya_update = 'update partiya',
  update_partiya = 'update partiya',
  partiya_send = 'end partiya',
  transfer_create = 'transfer',
  transfer_accept = 'transfer',
  transfer_reject = 'transfer',
  excel = 'excel',
  close_kassa = 'close kassa',
  add_income_cashflow = 'cashflow',
  add_expense_cashflow = 'cashflow',
  accept_order = 'order',
  return_order = 'order return',
  reject_order = 'order reject',
}

export default ActionTypeEnum;
