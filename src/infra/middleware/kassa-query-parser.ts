import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { Between, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import kassaProgresEnum from '@infra/shared/enum/kassa-progres-enum';

@Injectable()
class KassaQueryParserMiddleware implements NestMiddleware {
  use(req, res: Response, next: NextFunction) {
    let where: any = {};
    let { startDate, endDate, filial, total, isActive, status, report } = req.query;

    if (startDate) {
      startDate = new Date(startDate);
      startDate.setHours(0, 0, 0, 0);
      where.endDate = MoreThanOrEqual(startDate);
    }

    if (endDate) {
      endDate = new Date(endDate);
      endDate.setHours(23, 59, 59, 999);
      where.endDate = LessThanOrEqual(endDate);
    }

    if (endDate && startDate) {
      where.endDate = Between(startDate, endDate);
    }

    if (status) {
      if (status === 'closed_by_c') {
        where.status = In([kassaProgresEnum.CLOSED_BY_C, kassaProgresEnum.WARNING]);
      } else {
        where.status = status;
      }
    }

    if (filial)
      where.filial = {
        id: filial,
      };

    if (report)
      where.kassaReport = {
        id: report,
      };

    if (total) where.total = true;

    if (isActive === 'true' || isActive === 'false') where.isActive = JSON.parse(isActive);

    req.where = where;
    next();
  }
}

export default KassaQueryParserMiddleware;