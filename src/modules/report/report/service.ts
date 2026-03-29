/**
 * Report service - re-exports the existing ReportService from the original module.
 * The existing report.service.ts contains extensive business logic for report
 * generation, aggregation, closing, and home page calculations.
 * This wrapper ensures backward compatibility while fitting the new module structure.
 */
export { ReportService } from '../../report/report.service';
