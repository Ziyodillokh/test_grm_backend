import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { Between, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import partiyaFilterDto from '../../modules/partiya/dto/partiya-filter.dto';
import PartiyaStatusEnum from '../../infra/shared/enum/partiya-status.enum';

@Injectable()
class PartiyaQueryParserMiddleware implements NestMiddleware {
  use(req, res: Response, next: NextFunction) {
    let where: any = {};
    let {
      start_date,
      partiya_no,
      end_date,
      country,
      is_active,
      factory,
      warehouse
    }: partiyaFilterDto = req.query;

    if (start_date && end_date) {
      where = {
        date: Between(new Date(start_date), new Date(end_date)),
      };
    } else if (start_date) {
      where = {
        date: MoreThanOrEqual(new Date(start_date)),
      };
    } else if (end_date) {
      where = {
        date: LessThanOrEqual(new Date(end_date)),
      };
    }

    if (partiya_no) {
      where.partiya_no = { id: partiya_no };
    }

    if (country) {
      where.country = { id: country };
    }

    if (warehouse) {
      where.warehouse = { id: warehouse };
    }

    if (typeof is_active === 'boolean') {
      // is_active=true means partiya is closed/finished (was check=true); false means new/pending
      where.partiya_status = is_active
        ? In([PartiyaStatusEnum.CLOSED, PartiyaStatusEnum.FINISHED])
        : In([PartiyaStatusEnum.NEW, PartiyaStatusEnum.PENDING]);
    }

    if (factory) {
      where.factory = {
        id: factory,
      };
    }

    req.where = where;
    next();
  }
}

export default PartiyaQueryParserMiddleware;
