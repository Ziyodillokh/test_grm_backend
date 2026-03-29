import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { Between, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { OrderQueryDto } from '../shared/dto';

@Injectable()
class OrderQueryParserMiddleware implements NestMiddleware {
  use(req, res: Response, next: NextFunction) {
    let where: any = {};
    let relations: any = {};
    const {
      startDate,
      endDate,
      startPrice,
      endPrice,
      filialId,
      status,
      color,
      shape,
      model,
      collection,
      style,
      size,
      kassa,
      sellerId,
      year,
      month,
    }: OrderQueryDto = req.query;

    /**
     * ==============================
     * DATE FILTER (YEAR/MONTH FIRST)
     * ==============================
     */
    if (year) {
      const y = Number(year);

      if (month) {
        const m = Number(month) - 1; // JS month is 0-based
        const start = new Date(y, m, 1, 0, 0, 0);
        const end = new Date(y, m + 1, 0, 23, 59, 59, 999);

        where.date = Between(start, end);
      } else {
        const start = new Date(y, 0, 1, 0, 0, 0);
        const end = new Date(y, 11, 31, 23, 59, 59, 999);

        where.date = Between(start, end);
      }
    } else {
      // fallback to startDate / endDate
      if (startDate && endDate) {
        where.date = Between(new Date(startDate), new Date(endDate));
      } else if (startDate) {
        where.date = MoreThanOrEqual(new Date(startDate));
      } else if (endDate) {
        where.date = LessThanOrEqual(new Date(endDate));
      }
    }

    /**
     * ==============================
     * PRICE FILTER
     * ==============================
     */
    if (startPrice && endPrice) {
      where.price = Between(startPrice, endPrice);
    } else if (startPrice) {
      where.price = MoreThanOrEqual(startPrice);
    } else if (endPrice) {
      where.price = LessThanOrEqual(endPrice);
    }

    /**
     * ==============================
     * RELATIONAL FILTERS
     * ==============================
     */
    if (filialId) {
      where.product = {
        filial: { id: filialId },
      };
    }

    if (status) {
      where.status = status;
    }

    if (style) {
      const ids = JSON.parse(style);
      ids.length &&
      (where.product = {
        ...(where.product || {}),
        style: { id: In(ids) },
      });
    }

    if (size) {
      const ids = JSON.parse(size);
      ids.length &&
      (where.product = {
        ...(where.product || {}),
        size: { id: In(ids) },
      });
    }

    if (shape) {
      const ids = JSON.parse(shape);
      ids.length &&
      (where.product = {
        ...(where.product || {}),
        shape: { id: In(ids) },
      });
    }

    if (color) {
      const ids = JSON.parse(color);
      ids.length &&
      (where.product = {
        ...(where.product || {}),
        color: { id: In(ids) },
      });
    }

    if (collection) {
      const ids = JSON.parse(collection);
      ids.length &&
      (where.product = {
        ...(where.product || {}),
        model: {
          collection: { id: In(ids) },
        },
      });
    }

    if (model) {
      const ids = JSON.parse(model);
      ids.length &&
      (where.product = {
        ...(where.product || {}),
        model: {
          ...(where.product?.model || {}),
          id: In(ids),
        },
      });
    }

    if (kassa) {
      where.kassa = { id: kassa };
    }

    if (sellerId) {
      where.seller = { id: sellerId };
    }

    req.where = where;
    req.relations = relations;
    next();
  }
}

export default OrderQueryParserMiddleware;
