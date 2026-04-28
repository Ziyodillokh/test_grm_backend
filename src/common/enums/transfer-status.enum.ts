/**
 * Unified transfer status enum — 4 ta real ishlatiladigan status.
 *
 * State machine:
 *   PROGRESS (default on create)
 *     ├→ acceptTransfer / acceptPackage  → ACCEPT
 *     │                                       └→ returnTransferFromPackage → RETURNED
 *     └→ rejectTransfer / cancelTransferFromPackage → REJECT
 */
export enum TransferStatus {
  PROGRESS = 'Processing',
  ACCEPT = 'Accepted',
  REJECT = 'Rejected',
  RETURNED = 'Returned',
}
