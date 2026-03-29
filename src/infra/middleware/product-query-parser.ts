import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { Between, ILike, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

@Injectable()
class ProductQueryParserMiddleware implements NestMiddleware {
  use(req, res: Response, next: NextFunction) {
    let where: any = {};
    let {
      startDate,
      endDate,
      startPrice,
      endPrice,
      style,
      size,
      shape,
      color,
      collectionId,
      modelId,
      filialId,
      partiyaId,
      isMetric,
      search,
      isInternetShop,
      country,
      status,
    } = req.query;

    if (startDate && endDate) {
      where = {
        date: Between(new Date(startDate), new Date(endDate)),
      };
    } else if (startDate) {
      where = {
        date: MoreThanOrEqual(new Date(startDate)),
      };
    } else if (endDate) {
      where = {
        date: LessThanOrEqual(new Date(endDate)),
      };
    }
    if (startPrice && endPrice) {
      where = {
        price: Between(startPrice, endPrice),
      };
    } else if (startPrice) {
      where = {
        price: MoreThanOrEqual(startPrice),
      };
    } else if (endPrice) {
      where = {
        price: LessThanOrEqual(endPrice),
      };
    }

    where.bar_code = {};

    if (style?.length) {
      const ddd = JSON.parse(style);
      where.bar_code.style = { title: In(ddd) };
      if (ddd.length == 0) {
        delete where.bar_code.style;
      }
    }

    if (size?.length) {
      let ddd = JSON.parse(size);
      where.bar_code.size = { title: In(ddd) };
      if (ddd.length == 0) {
        delete where.bar_code.size;
      }
    }

    if (shape?.length) {
      let ddd = JSON.parse(shape);
      where.bar_code.shape = { title: In(ddd) };
      if (ddd.length == 0) {
        delete where.bar_code.shape;
      }
    }

    if (color?.length) {
      const ddd = JSON.parse(color);
      where.bar_code.color = { title: In(ddd) };
      if (ddd.length == 0) {
        delete where.bar_code.color;
      }
    }

    if (collectionId) {
      where.bar_code.collection = { id: collectionId };
    }

    if (country) {
      where.bar_code.country = { id: country };
    }

    if (modelId) {
      where.bar_code.model = { id: modelId };
    }

    if (filialId) {
      where.filial = {
        id: filialId,
      };
    }

    if (partiyaId) {
      where.partiya = {
        id: partiyaId,
      };
    }

    if (isInternetShop == 'true' || isInternetShop == 'false') {
      where.isInternetShop = isInternetShop;
    }

    if (isMetric) {
      where.bar_code.isMetric = true;
    }
    where.is_deleted = false;

    if (status) {
      where.status = ILike(status);
    }

    if (search) {
      search = search.split('+').join(' ');
      where = {
        filial: filialId,
        search,
        fields: true,
        isInternetShop: isInternetShop || null,
        model: { collection: { id: collectionId } },
      };

      where.fields = true;
      where.search = search;
      where.isInternetShop = !!isInternetShop;
      where.filial = filialId;
    }

    req.where = where;
    next();
  }
}

export default ProductQueryParserMiddleware;
