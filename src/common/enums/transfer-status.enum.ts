/**
 * Unified transfer status enum.
 *
 * The actual DB values match the old progresEnum to avoid migration issues.
 */
export enum TransferStatus {
  BOOK = 'Booked',
  PROGRESS = 'Processing',
  REJECT = 'Rejected',
  ACCEPT = 'Accepted',
  ACCEPT_F = 'Accepted_F',
  OTHER = 'other',
  RETURNED = 'Returned',
}
