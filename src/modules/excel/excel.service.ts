import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { join } from 'path';
import * as fs from 'fs';
import * as encodeUrl from 'encodeurl';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/ru';
import { Excel } from './excel.entity';
import { ProductExcel } from './excel-product.entity';
import { deleteFile, excelDataParser } from 'src/infra/helpers';
import { FileService } from '../file/file.service';
import { DataSource, Equal, ILike, Repository } from 'typeorm';
import { PartiyaService } from '../partiya/partiya.service';
import { ProductService } from '../product/product.service';
import { FilialService } from '../filial/filial.service';
import { CreateProductExcelDto } from './dto';
import { QrBaseService } from '../qr-base/qr-base.service';
import { CreateQrBaseDto } from '../qr-base/dto';
import { ActionService } from '../action/action.service';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Search } from './utils';
import { PartiyaProductsEnum, ProductReportEnum } from '../../infra/shared/enum';
import { CollectionPriceService } from '../collection-price/collection-price.service';
import { Response } from 'express';
import { Cashflow } from '../cashflow/cashflow.entity';
import { CreateProductDto } from '../product/dto';
import { Product } from '@modules/product/product.entity';
import { Kassa } from '@modules/kassa/kassa.entity';
import { Report } from '@modules/report/report.entity';
import * as XLSX from 'xlsx';


dayjs.extend(utc);
dayjs.extend(timezone);


@Injectable()
export class ExcelService {
  constructor(
    @InjectRepository(Excel)
    private readonly actionService: ActionService,
    @InjectRepository(ProductExcel)
    private readonly productExcelRepository: Repository<ProductExcel>,
    @InjectRepository(Cashflow)
    private readonly cashflowRepository: Repository<Cashflow>,
    @InjectRepository(Kassa)
    private kassaRepository: Repository<Kassa>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    private readonly fileService: FileService,
    @Inject(forwardRef(() => PartiyaService))
    private readonly partiyaService: PartiyaService,
    private readonly productService: ProductService,
    private readonly filialService: FilialService,
    private readonly qrBaseService: QrBaseService,
    private readonly collectionPriceService: CollectionPriceService,
    private readonly dataSource: DataSource,
  ) {}

  private readonly systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tashkent';

  async getAll(
    options: IPaginationOptions,
    type: PartiyaProductsEnum,
    text?: string,
    partiyaId?: string,
    tip?: ProductReportEnum,
  ) {
    if (type === PartiyaProductsEnum.COLLECTION) {
      return await this.getPaginatedByCollection(options, tip, partiyaId, text);
    } else if (type === PartiyaProductsEnum.MODEL) {
      return await this.getPaginatedByModel(options, tip, partiyaId, text);
    } else if (type === PartiyaProductsEnum.DEFAULT) {
      return await this.getData({ page: options.page, limit: options.limit }, { search: text, partiyaId, tip });
    }
  }

  async getData({ page, limit }, { search, partiyaId, tip }) {
    if (!partiyaId) {
      throw new BadRequestException('Partiya id must be exist!');
    }

    console.log('tip==============================>1', tip);
    const query = this.productExcelRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.bar_code', 'bar_code')
      .leftJoinAndSelect('bar_code.collection', 'collection')
      .leftJoinAndSelect('bar_code.model', 'model')
      .leftJoinAndSelect('bar_code.size', 'size')
      .leftJoinAndSelect('bar_code.country', 'country')
      .leftJoinAndSelect('bar_code.shape', 'shape')
      .leftJoinAndSelect('bar_code.style', 'style')
      .leftJoinAndSelect('bar_code.color', 'color')
      .leftJoinAndSelect('product.partiya', 'partiya')
      .where('product.partiyaId = :partiyaId', { partiyaId });

    if (tip === ProductReportEnum.SURPLUS) {
      query.andWhere(
        `CASE WHEN bar_code.isMetric THEN (product.y * 100) < product.check_count ELSE product.count < product.check_count END`,
      );
    } else if (tip === ProductReportEnum.DEFICIT) {
      query.andWhere(
        'CASE WHEN bar_code.isMetric THEN (product.y * 100) > product.check_count ELSE product.count > product.check_count END',
      );
    } else if (tip === ProductReportEnum.INVENTORY) {
      query.andWhere('product.check_count > 0');
    } else {
      query.andWhere('product.count > 0');
      query.andWhere('product.y > 0');
    }

    if (search) {
      query.andWhere(
        `
  (SELECT COUNT(*)
   FROM (SELECT DISTINCT LOWER(word) AS word
         FROM (SELECT REGEXP_SPLIT_TO_TABLE(LOWER(:text), ' ') AS word) AS words) AS unique_words
   WHERE CONCAT_WS(' ', collection.title, model.title, size.title, bar_code.code, country.title, shape.title, style.title, color.title) ILIKE
         '%' || unique_words.word || '%') = (SELECT COUNT(*)
                                             FROM (SELECT LOWER(word) AS word
                                                   FROM (SELECT REGEXP_SPLIT_TO_TABLE(LOWER(:text), ' ') AS word) AS words) AS unique_words)
`,
        { text: search },
      );
    }
    query.orderBy('product.updated_at', 'DESC');

    const [items, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: {
        itemCount: total,
        currentPage: page,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOne(id: string) {
    return await this.productExcelRepository.findOne({
      where: { id },
      relations: {
        bar_code: {
          collection: true,
          model: true,
          size: true,
          color: true,
          shape: true,
          style: true,
          country: true,
          factory: true,
        },
        partiya: { factory: true, partiya_no: true },
      },
    });
  }

  async delete(id: string) {
    await this.productExcelRepository.delete(id);

    return 'Deleted successfully!';
  }

  readExcelFile(path: string) {
    const workbook = XLSX.readFile(path);
    const worksheet = workbook.Sheets['Sheet'];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);
    deleteFile(path);

    return data;
  }

  async addProductToPartiya(products: CreateProductExcelDto[], partiyaId: string) {
    const partiya = await this.partiyaService.getOne(partiyaId);
    if (!partiya) {
      throw new BadRequestException('Partiya not found!');
    }

    console.log('products[0] =================>', products[0]);

    const productPromises: CreateProductExcelDto[] = [];
    for (const e of products) {
      const barcode = await this.qrBaseService.getOneByCode(e?.code || e?.bar_code);
      if (!e.bar_code) {
        e.bar_code = barcode.id;
      }
      const price = await this.returnPrice(e.bar_code, partiyaId);
      const count = Number(e.count) < 1 ? 1 : Number(e?.count);
      if (barcode.isMetric) {
        for (let i = 0; i < count; i++) {
          const updatedProduct: CreateProductExcelDto = {
            ...e,
            ...price,
            partiya: partiya.id,
            count: 1,
            y: barcode.size.y,
          };

          productPromises.push(updatedProduct);
        }
      } else {
        const updatedProduct: CreateProductExcelDto = {
          ...e,
          ...price,
          partiya: partiya.id,
          count,
          y: barcode.size.y,
        };

        productPromises.push(updatedProduct);
      }
    }

    console.log('productPromises[0]  =========================>', productPromises[0]);

    return await this.productExcelRepository
      .createQueryBuilder()
      .insert()
      .into(ProductExcel)
      .values(productPromises as unknown as ProductExcel)
      .returning('id')
      .execute();
  }

  async addProductToPartiyaWithExcel(products: CreateProductExcelDto[], partiyaId: string) {
    const partiya = await this.partiyaService.getOne(partiyaId);
    if (!partiya) {
      throw new BadRequestException('Partiya not found!');
    }

    await this.addProductToPartiya(products, partiyaId);

    return { data: null, success: true, error: false };
  }

  async readProducts(partiyaId: string, search: string) {
    const partiya = await this.partiyaService.getOne(partiyaId);
    if (partiya) {
      // const data = await this.partiyaService.getOneProds(partiyaId, search);
      const res_data = await this.productExcelRepository.find({
        relations: {
          bar_code: {
            collection: true,
            model: true,
            size: true,
            color: true,
            shape: true,
            style: true,
          },
        },
        where: {
          partiya: { id: partiyaId },
          ...(search && { collection: { title: ILike(`%${search}%`) } }),
        },
        order: {
          bar_code: {
            collection: {
              title: 'asc',
            },
          },
        },
      });

      return excelDataParser(res_data || [], partiya.expense);
    }
    throw new BadRequestException('Partiya not found!');
  }

  async updateModelCost(newData: { id: string; cost: number; partiyaId: string }) {
    // const collection = await this.modelService.getOneExcel(newData.id);
    //
    // if (!collection) {
    //   throw new Error('Model not found');
    // }
    //
    // const productIds = [];
    //
    // for await (const product of collection.productsExcel) {
    //   if (!product?.isEdited && product?.partiya?.id == newData?.partiyaId) productIds.push(product.id);
    // }
    //
    // // Update collectionPrice for products in the collection using the product IDs
    // await this.productExcelRepository
    //   .createQueryBuilder()
    //   .update(ProductExcel)
    //   .set({ displayPrice: newData.cost, priceMeter: newData.cost }) // Set the updated value
    //   .whereInIds(productIds) // Update products with matching IDs
    //   .execute();
  }

  async updateCollectionCost(newData: { id: string; cost: number; partiyaId: string }) {
    await this.productExcelRepository
      .createQueryBuilder('pe')
      .update(ProductExcel)
      .set({ displayPrice: newData.cost })
      .where(
        `id IN (
    SELECT pe_sub.id
    FROM productexcel pe_sub
    LEFT JOIN qrbase bc ON bc.id = pe_sub."barCodeId"
    LEFT JOIN collection c ON c.id = bc."collectionId"
    WHERE c.id = :collectionId AND pe_sub."partiyaId" = :partiyaId
  )`,
      )
      .setParameters({
        collectionId: newData.id,
        partiyaId: newData.partiyaId,
      })
      .execute();
  }

  async updateProduct(value, id) {
    return await this.productExcelRepository.update({ id }, value);
  }

  async updateCount(id, tip: ProductReportEnum) {
    console.log(tip === ProductReportEnum.INVENTORY);
    if (tip === ProductReportEnum.INVENTORY) {
      await this.productExcelRepository.update({ id }, { check_count: 0 });
    } else if (!tip) {
      await this.productExcelRepository.update({ id }, { count: 0 });
    }
    let product = await this.productExcelRepository.findOne({ where: { id } });
    if (product.check_count === 0 && product.count === 0) {
      await this.productExcelRepository.delete(id);
    }

    return product;
  }

  async checkProductCode(newData: { code: string; id: string }) {
    const code = await this.qrBaseService.getOneByCode(newData.code);

    if (!code) {
      throw new BadRequestException('Code not exist!');
    }
    console.log(newData);
    const product = await this.productExcelRepository.findOne({
      relations: {
        partiya: true,
        bar_code: {
          collection: true,
          model: true,
          size: true,
          color: true,
          shape: true,
          style: true,
        },
      },
      where: { bar_code: { code: newData.code }, partiya: { id: newData.id } },
    });

    if (product && !product?.bar_code.isMetric) {
      product.count += 1;
      await this.productExcelRepository.save(product);
      return product;
    }

    const value: CreateProductExcelDto = {
      code: code.code,
      bar_code: code.id,
      collectionPrice: 0,
      comingPrice: 0,
      count: 1,
      displayPrice: 0,
      isEdited: false,
      isMetric: false,
      partiya: newData.id,
      priceMeter: 0,
    };

    const productId = await this.productExcelRepository
      .createQueryBuilder()
      .insert()
      .into(ProductExcel)
      .values(value as unknown as ProductExcel)
      .returning('id')
      .execute();

    return await this.productExcelRepository.findOne({
      where: { id: product ? product.id : productId.raw[0].id },
      relations: {
        bar_code: {
          collection: true,
          model: true,
          size: true,
          color: true,
          shape: true,
          style: true,
        },
      },
    });
  }

  async createWithCode(newData: CreateQrBaseDto, partiyaId) {
    if (!newData.code) throw new BadRequestException('Code Not Exist!');

    const value: CreateQrBaseDto = {
      code: newData.code,
      collection: newData.collection,
      color: newData.color,
      country: newData.country,
      model: newData.model,
      shape: newData.shape,
      size: newData.size,
      style: newData.style,
      factory: newData.factory,
    };
    const data = await this.qrBaseService.getOneCode(newData.code);

    if (!data) {
      await this.qrBaseService.create(value);
    }

    const code = await this.qrBaseService.getOneByCode(newData.code);
    const Product: CreateProductExcelDto = {
      code: code?.code,
      bar_code: code.id,
      collectionPrice: 0,
      comingPrice: 0,
      count: Number(newData?.count) || 1,
      displayPrice: 0,
      isEdited: false,
      isMetric: false,
      partiya: partiyaId,
      priceMeter: 0,
    };

    await this.addProductToPartiya([Product], partiyaId);
    return code;
  }

  // #utils
  async returnPrice(bar_code_id, partiya_id): Promise<{ comingPrice: number }> {
    const product = bar_code_id
      ? await this.productExcelRepository.findOne({
          where: {
            bar_code: { id: bar_code_id },
            partiya: { id: partiya_id },
          },
        })
      : null;

    return {
      comingPrice: product ? product.comingPrice : 0,
    };
  }

  async createExcelFile(datas, pathname) {
    const workbook = XLSX.utils.book_new();

    const worksheet = XLSX.utils.json_to_sheet(datas);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet');
    const filePath = join(process.cwd(), 'uploads', 'accounting', 'accounting.xlsx');

    await fs.promises.writeFile(filePath, XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }));

    return pathname;
  }

  async checkCreate(datas) {
    const data = this.productExcelRepository.create(datas);
    return this.productExcelRepository.save(data);
  }

  async skladCheck({ barcode, partiya_id, count = 1 }) {
    const item = await this.productExcelRepository.findOne({
      where: {
        partiya: { id: partiya_id },
        bar_code: { id: barcode },
      },
    });
    if (item) {
      await this.productExcelRepository.update({ check_count: item.check_count + count }, { id: item.id });
    }
  }

  async getPaginatedByModel(
    options: IPaginationOptions,
    type?: string,
    partiya_id?: string,
    search?: string,
  ): Promise<Pagination<any>> {
    const queryBuilder = this.productExcelRepository
      .createQueryBuilder('productexcel')
      .leftJoin('productexcel.barCodeId', 'qr')
      .leftJoin('qr.sizeId', 's')
      .leftJoin('qr.collectionId', 'c')
      .leftJoin('qr.colorId', 'cr')
      .leftJoin('qr.shapeId', 'sh')
      .leftJoin('qr.modelId', 'm')
      .leftJoin('qr.countryId', 'cr')
      .leftJoin('qr.styleId', 'st')
      .select([
        'm.id as id',
        'COALESCE(SUM(productexcel.count), 0) as count',
        'COALESCE(SUM(s.kv), 0) as kv',
        'm.title as title',
        `NULLIF(jsonb_build_object('id', s.id, 'title', s.title), '{"id": null, "title": null}') AS size`,
        `NULLIF(jsonb_build_object('id', cr.id, 'title', cr.title), '{"id": null, "title": null}') AS color`,
        `NULLIF(jsonb_build_object('id', sh.id, 'title', sh.title), '{"id": null, "title": null}') AS shape`,
        `NULLIF(jsonb_build_object('id', c.id, 'title', c.title), '{"id": null, "title": null}') AS model`,
      ]);

    if (!partiya_id) {
      throw new BadRequestException('Partiya id must be exist');
    }

    queryBuilder.where('partiyaId = :partiya_id', { partiya_id });
    if (type === ProductReportEnum.SURPLUS) {
      queryBuilder.andWhere('(count < check_count or productexcel.y < check_count)');
    } else if (type === ProductReportEnum.DEFICIT) {
      queryBuilder.andWhere('count > check_count');
      queryBuilder.andWhere('productexcel.y > check_count');
    } else if (type === ProductReportEnum.INVENTORY) {
      queryBuilder.andWhere('check_count > 0');
    } else {
      queryBuilder.andWhere('count > 0');
      queryBuilder.andWhere('productexcel.y > 0');
    }

    if (search) {
      queryBuilder.andWhere(
        `
  (SELECT COUNT(*)
   FROM (SELECT DISTINCT LOWER(word) AS word
         FROM (SELECT REGEXP_SPLIT_TO_TABLE(LOWER(:text), ' ') AS word) AS words) AS unique_words
   WHERE CONCAT_WS(' ', c.title, m.title, s.title, cr.title, sh.title, st.title, cr.title) ILIKE
         '%' || unique_words.word || '%') = (SELECT COUNT(*)
                                             FROM (SELECT LOWER(word) AS word
                                                   FROM (SELECT REGEXP_SPLIT_TO_TABLE(LOWER(:text), ' ') AS word) AS words) AS unique_words)
`,
        { text: search },
      );
    }
    queryBuilder.groupBy('s.id, s.title, c.id, c.title, cr.id, cr.title, sh.id, sh.title, m.id, m.title');

    return paginate<any>(queryBuilder, options);
  }

  async getPaginatedByCollection(
    options: IPaginationOptions,
    type?: ProductReportEnum,
    partiya_id?: string,
    search?: string,
  ): Promise<{
    meta: {
      totalItems: any;
      itemsPerPage: number | string;
      totalPages: number;
      currentPage: number | string;
      itemCount: any;
    };
    items: any;
  }>
  {
    if (!partiya_id) {
      throw new BadRequestException('Partiya id must be provided');
    }

    const partiya = await this.partiyaService.getOne(partiya_id);

    const offset = (Number(options.page) - 1) * Number(options.limit);
    const limit = options.limit;

    const params = [partiya_id];
    let whereConditions = `
    pe."partiyaId" = $1
  `;

    // Apply filters
    if (type === ProductReportEnum.SURPLUS) {
      whereConditions += ' AND CASE WHEN qr.isMetric THEN (pe.y * 100) < pe.check_count ELSE pe.count < pe.check_count)';
    } else if (type === ProductReportEnum.DEFICIT) {
      whereConditions += ' AND CASE WHEN qr.isMetric THEN (pe.y * 100) > pe.check_count ELSE pe.count > pe.check_count)';
    } else if (type === ProductReportEnum.INVENTORY) {
      whereConditions += ' AND pe.check_count > 0';
    } else {
      whereConditions += ' AND pe.count > 0 AND pe.y > 0';
    }

    const rawData = await this.productExcelRepository.query(
      `
        SELECT c.id    AS id,
               c.title AS title,
               SUM(pe.count) AS count,
    SUM(s.kv * pe.count) AS kv,
    (
        SELECT jsonb_agg(DISTINCT s2)
        FROM qrbase q2
        JOIN size s2 ON s2.id = q2."sizeId"
        WHERE q2."collectionId" = c.id
    ) AS size,
    (
        SELECT jsonb_agg(DISTINCT cl2)
        FROM qrbase q2
        JOIN color cl2 ON cl2.id = q2."colorId"
        WHERE q2."collectionId" = c.id
    ) AS color,
    (
        SELECT jsonb_agg(DISTINCT cr2)
        FROM qrbase q2
        JOIN country cr2 ON cr2.id = q2."countryId"
        WHERE q2."collectionId" = c.id
    ) AS country,
    (
        SELECT jsonb_agg(DISTINCT sh2)
        FROM qrbase q2
        JOIN shape sh2 ON sh2.id = q2."shapeId"
        WHERE q2."collectionId" = c.id
    ) AS shape,
    (
        SELECT jsonb_agg(DISTINCT m2)
        FROM qrbase q2
        JOIN model m2 ON m2.id = q2."modelId"
        WHERE q2."collectionId" = c.id
    ) AS model,
    (
        SELECT jsonb_agg(DISTINCT cp2)
        FROM "collection-price" cp2
        WHERE cp2."collectionId" = c.id
    ) AS "collectionPrice",
    pe."displayPrice"
        FROM productexcel pe
          JOIN qrbase qr
        ON qr.id = pe."barCodeId"
          JOIN size s ON s.id = qr."sizeId"
          JOIN collection c ON c.id = qr."collectionId"
          JOIN partiya p ON p.id = pe."partiyaId"
        WHERE ${whereConditions}
        GROUP BY c.id, c.title, pe."displayPrice"
        ORDER BY c.title
        OFFSET ${offset} LIMIT ${limit}
      `,
      params,
    );

    const totalItems = rawData[0]?.total_count || 0;

    const items = rawData.map((item) => ({
      id: item.id,
      title: item.title,
      count: Number(item.count),
      kv: Number(item.kv),
      size: item.size?.length ? item.size[0] : null,
      color: item.color?.length ? item.color[0] : null,
      country: item.country?.length ? item.country[0] : null,
      shape: item.shape?.length ? item.shape[0] : null,
      model: item.model?.length ? item.model[0] : null,
      displayPrice: item.displayPrice ? item.displayPrice : 0,
      collectionPrice: item.collectionPrice?.length ? item.collectionPrice[0] : null,
      expense: partiya.expensePerKv || (partiya.expense / partiya.volume).toFixed(2),
    }));

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: options.limit,
        totalPages: Math.ceil(totalItems / Number(options.limit)),
        currentPage: options.page,
      },
    };
  }

  async searchProd(options: IPaginationOptions, text: string, partiyaId: string) {
    const products =
      (await this.productExcelRepository.query(
        Search({
          text,
          offset: (+options.page - 1) * +options.limit,
          limit: options.limit,
          partiyaId,
          total: false,
        }),
      )) || [];

    const total =
      (await this.productExcelRepository.query(
        Search({
          text,
          offset: (+options.page - 1) * +options.limit,
          limit: options.limit,
          partiyaId,
          total: true,
        }),
      )) || [];

    return {
      items: products,
      meta: {
        totalItems: +total[0].total,
        itemCount: products.length,
        itemsPerPage: +options.limit,
        totalPages: Math.ceil(+total[0].total / +options.limit),
        currentPage: +options.page,
      },
    };
  }

  async createExcessProduct(data: { code: string; y; partiyaId: string; tip: ProductReportEnum }) {
    let is_inventory = false;

    if (typeof data.y !== 'number' || isNaN(data.y)) {
      throw new BadRequestException('Y must be a valid number!');
    }

    if (!data.partiyaId) throw new BadRequestException('partiyaId is required');

    if (!data.code) {
      throw new BadRequestException('code must be a valid number!');
    }

    if (data?.tip?.trim() === ProductReportEnum.INVENTORY) is_inventory = true;

    let bar_code = await this.qrBaseService.getOneByCode(data.code);
    if (!bar_code) throw new BadRequestException('Code must be a valid number!');

    const isMetric = bar_code.isMetric;

    let product = await this.productExcelRepository.findOne({
      where: {
        partiya: {
          id: data.partiyaId,
        },
        bar_code: {
          code: data.code,
        },
      },
    });

    if (product && isMetric && product.check_count > 0) {
      product =
        (await this.productExcelRepository.findOne({
          where: {
            partiya: {
              id: data.partiyaId,
            },
            bar_code: {
              code: data.code,
            },
            check_count: Equal(0),
          },
        })) || null;
    }

    let y = 0.0;
    let check_count = 0;
    let count = 0;

    if (is_inventory) {
      check_count = data.y;
      if (isMetric) {
        count = 1;
      }
    } else {
      if (isMetric) {
        y = +(data.y / 100).toFixed(2) || bar_code.size.y;
        count = 1;
      } else {
        count = data.y;
        y = bar_code.size.y;
      }
    }

    if ((isMetric || !product) && !is_inventory) {
      const res = await this.productExcelRepository
        .createQueryBuilder()
        .insert()
        .into(ProductExcel)
        .values({
          check_count,
          bar_code: bar_code.id,
          y,
          partiya: data.partiyaId,
          count,
        } as unknown as ProductExcel)
        .returning('*')
        .execute();

    } else {
      if (isMetric) {
        if ((product?.check_count || 0) + data.y > (product?.y || 0) * 100) {
          await this.productExcelRepository
            .createQueryBuilder()
            .insert()
            .into(ProductExcel)
            .values({
              check_count,
              bar_code: bar_code.id,
              y,
              partiya: data.partiyaId,
              count,
            } as unknown as ProductExcel)
            .returning('*')
            .execute();
        } else {
          await this.productExcelRepository
            .createQueryBuilder()
            .update()
            .set({
              [is_inventory ? 'check_count' : 'count']: () =>
                is_inventory ? `check_count + ${data.y}` : `count + ${data.y}`,
            })
            .where('id = :id', { id: product.id })
            .returning('*')
            .execute();
        }
      } else {
        const res = await this.productExcelRepository
          .createQueryBuilder()
          .update()
          .set({
            [is_inventory ? 'check_count' : 'count']: () => (is_inventory ? `check_count + ${data.y}` : `count + ${data.y}`),
          })
          .where('id = :id', { id: product.id })
          .returning('*')
          .execute();

        console.log('Product updated with new check_count.', res);
      }
    }

    return { data: null, success: true, error: false };
  }

  async exportCashFlowsByKassaAndFilial(
    res: Response,
    kassaId?: string,
    reportId?: string,
    kassaReportId?: string,
    filters?: { search?: string; sellerId?: string; cashflowTypeId?: string; fromDate?: string; toDate?: string },
  ) {
    try {
      const params = [kassaId, reportId, kassaReportId].filter(Boolean);
      if (params.length !== 1) {
        throw new Error(
          params.length > 1
            ? 'Bir vaqtning o‘zida faqat bitta parametr (kassaId, reportId yoki kassaReportId) bo‘lishi mumkin'
            : 'Kamida bitta parametr (kassaId, reportId yoki kassaReportId) kerak',
        );
      }

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Column order + header titles (important for json_to_sheet)
      const columns = [
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Price', key: 'price', width: 10 },
        { header: 'Plastic', key: 'plastic', width: 10 },
        { header: 'Type', key: 'type', width: 10 },
        { header: 'Tip', key: 'tip', width: 18 },
        { header: 'Collection', key: 'collection', width: 25 },
        { header: 'Model', key: 'model', width: 12 },
        { header: 'Size', key: 'size', width: 12 },
        { header: 'Color', key: 'color', width: 12 },
        { header: 'Count', key: 'count', width: 10 },
        { header: 'Discount', key: 'discount', width: 10 },
        { header: 'Profit', key: 'profit', width: 10 },
        { header: 'Factory', key: 'factory', width: 15 },
        { header: 'Country', key: 'country', width: 15 },
        { header: 'Comment', key: 'comment', width: 35 },
        { header: 'Seller', key: 'seller', width: 20 },
        { header: 'CreatedBy', key: 'createdBy', width: 20 },
        { header: 'Filial', key: 'filial', width: 14 },
        { header: 'ID', key: 'id', width: 0 }, // hidden
      ];

      const headerKeys = columns.map(c => c.key);

      // Numeric column keys for forcing number type in cells
      const numericKeys = new Set(['price', 'plastic', 'count', 'discount', 'profit']);

      // Helper: create and append sheet
      const appendSheet = (data: any[], name: string) => {
        if (!data?.length) return;

        // Make sheet with fixed header order
        const sheet = XLSX.utils.json_to_sheet(data, {
          header: headerKeys,
          skipHeader: false, // will create header row from keys
        });

        // Replace header row labels (because json_to_sheet uses keys as titles)
        // Header row is row 1 => cells A1, B1, ...
        columns.forEach((col, idx) => {
          const cellAddress = XLSX.utils.encode_cell({ r: 0, c: idx });
          sheet[cellAddress] = { t: 's', v: col.header };
        });

        // Force numeric cells to number type
        for (let row = 1; row <= data.length; row++) {
          columns.forEach((col, colIdx) => {
            if (numericKeys.has(col.key)) {
              const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIdx });
              if (sheet[cellAddress]) {
                sheet[cellAddress].t = 'n';
                sheet[cellAddress].v = Number(sheet[cellAddress].v) || 0;
              }
            }
          });
        }

        // Column widths + hidden column
        sheet['!cols'] = columns.map((c) => ({
          wch: c.width,
          hidden: c.key === 'id',
        }));

        XLSX.utils.book_append_sheet(workbook, sheet, name);
      };

      // === CASE 1: kassaReportId ===
      if (kassaReportId) {
        const [kassaReportCashFlows, relatedCashFlows] = await Promise.all([
          this.getKassaReportCashFlows(kassaReportId),
          this.getRelatedKassaCashFlows(kassaReportId),
        ]);

        const kassaReport = await this.kassaRepository.findOne({
          where: { id: kassaReportId },
          relations: { filial: true },
        });

        const formatRows = (rows: any[]) =>
          rows.map((r) => ({
            ...r,
            price: Number(r.price) ?? 0,
            date: r.date
              ? dayjs(r.date).tz(this.systemTz).format('YYYY-MM-DD HH:mm')
              : '',
          }));

        appendSheet(formatRows(kassaReportCashFlows), 'kassa_report_cashflows');
        appendSheet(formatRows(relatedCashFlows), 'related_kassa_cashflows');

        const fileName = encodeUrl(
          `${dayjs(`${kassaReport.year}-${kassaReport.month}-01`)
            .tz(this.systemTz)
            .format('MMMM-YYYY')}-${kassaReport.filial.title}.xlsx`,
        );

        const buffer = XLSX.write(workbook, {
          type: 'buffer',
          bookType: 'xlsx',
          compression: true,
        });

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        return res.send(buffer);
      }

      // === CASE 2: kassaId or reportId ===
      const qb = this.cashflowRepository
        .createQueryBuilder('cashflow')
        .select([
          'cashflow.id AS id',
          'cashflow.date as date',
          'cashflow.price::numeric AS price',
          'COALESCE(order.plasticSum, 0)::numeric AS plastic',
          'cashflow.type AS type',
          'cashflow_type.title AS tip',
          'collection.title AS collection',
          'model.title AS model',
          'size.title AS size',
          'color.title AS color',
          'COALESCE(order.x, 0)::numeric AS count',
          'COALESCE(order.discountSum, 0)::numeric AS discount',
          'COALESCE(order.additionalProfitSum, 0)::numeric AS profit',
          'factory.title AS factory',
          'country.title AS country',
          `COALESCE(order.comment, cashflow.comment) as comment`,
          `CASE
            WHEN seller.id IS NOT NULL THEN CONCAT(seller.firstName, ' ', seller.lastName)
            WHEN createdBy.id IS NOT NULL THEN CONCAT(createdBy.firstName, ' ', createdBy.lastName)
            ELSE ''
          END AS seller`,
          'CONCAT(createdBy.firstName, \' \', createdBy.lastName) AS "createdBy"',
          'filial.title AS filial',
        ])
        .leftJoin('cashflow.createdBy', 'createdBy')
        .leftJoin('cashflow.cashflow_type', 'cashflow_type')
        .leftJoin('cashflow.filial', 'filial')
        .leftJoin('cashflow.order', 'order')
        .leftJoin('order.bar_code', 'bar_code')
        .leftJoin('order.seller', 'seller')
        .leftJoin('bar_code.color', 'color')
        .leftJoin('bar_code.collection', 'collection')
        .leftJoin('bar_code.country', 'country')
        .leftJoin('bar_code.size', 'size')
        .leftJoin('bar_code.factory', 'factory')
        .leftJoin('bar_code.model', 'model')
        .orderBy('cashflow.date', 'DESC');

      if (kassaId) qb.andWhere('cashflow.kassaId = :kassaId', { kassaId });
      if (reportId) qb.andWhere('cashflow.reportId = :reportId', { reportId });

      // Always exclude pending and rejected orders (canceled = vozvrat, kerak)
      qb.andWhere(
        `(order.id IS NULL OR order.status NOT IN ('pending', 'rejected'))`,
      );

      // Apply filters
      if (filters?.search) {
        qb.andWhere(
          `(collection.title ILIKE :search OR model.title ILIKE :search OR size.title ILIKE :search OR color.title ILIKE :search OR bar_code.code ILIKE :search)`,
          { search: `%${filters.search}%` },
        );
      }
      if (filters?.sellerId) {
        qb.andWhere('seller.id = :sellerId', { sellerId: filters.sellerId });
      }
      if (filters?.cashflowTypeId) {
        qb.andWhere('cashflow_type.id = :cashflowTypeId', { cashflowTypeId: filters.cashflowTypeId });
      }
      if (filters?.fromDate) {
        qb.andWhere('cashflow.date >= :fromDate', { fromDate: filters.fromDate });
      }
      if (filters?.toDate) {
        qb.andWhere('cashflow.date <= :toDate', { toDate: filters.toDate });
      }

      const cashflows = await qb.getRawMany();

      const formattedCashflows = cashflows.map((item) => ({
        ...item,
        date: item.date
          ? dayjs(item.date).tz(this.systemTz).format('YYYY-MM-DD HH:mm')
          : '',
        price: Number(item.price) || 0,
        plastic: Number(item.plastic) || 0,
        count: Number(item.count) || 0,
        discount: Number(item.discount) || 0,
        profit: Number(item.profit) || 0,
      }));

      appendSheet(
        formattedCashflows,
        kassaId ? 'kassa_cashflows' : 'report_cashflows',
      );

      // === File name ===
      let fileName = '';
      if (kassaId) {
        const kassa = await this.kassaRepository.findOne({
          where: { id: kassaId },
          relations: { filial: true },
        });
        fileName += `${dayjs(kassa.startDate)
          .tz(this.systemTz)
          .format('MMMM-YYYY')}-${kassa?.filial?.title || 'filial'}`;
      } else if (reportId) {
        const report = await this.reportRepository.findOne({
          where: { id: reportId },
        });
        fileName += `Actions ${dayjs(`${report.year}-${report.month}-01`)
          .tz(this.systemTz)
          .format('MMMM-YYYY')}`;
      }
      fileName += '.xlsx';

      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
        compression: true,
      });

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeUrl(fileName)}"`,
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      return res.send(buffer);
    } catch (error: any) {
      console.error('Excel export xatosi:', error);
      throw new Error(`Excel fayl yaratishda xatolik: ${error.message}`);
    }
  }

// === Helper: Send Excel workbook to response ===
  private sendExcelResponse(res: Response, workbook: XLSX.WorkBook, fileName: string) {
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  }


  private async getKassaReportCashFlows(kassaReportId: string) {
    return await this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoinAndSelect('cashflow.createdBy', 'createdBy')
      .leftJoinAndSelect('cashflow.cashflow_type', 'cashflow_type')
      .leftJoinAndSelect('cashflow.filial', 'filial')
      .where('cashflow.kassaReport.id = :kassaReportId', { kassaReportId })
      .orderBy('cashflow.date', 'DESC')
      .getMany();
  }

  private async getRelatedKassaCashFlows(kassaReportId: string) {
    const kassaIds = await this.cashflowRepository.query(
      `
    SELECT id FROM kassa WHERE "kassaReportId" = $1
  `,
      [kassaReportId],
    );

    if (!kassaIds || kassaIds.length === 0) {
      return [];
    }

    const kassaIdList = kassaIds.map((k) => k.id);

    return await this.cashflowRepository
      .createQueryBuilder('cashflow')
      .leftJoinAndSelect('cashflow.createdBy', 'createdBy')
      .leftJoinAndSelect('cashflow.cashflow_type', 'cashflow_type')
      .leftJoinAndSelect('cashflow.filial', 'filial')
      .leftJoinAndSelect('cashflow.order', 'order')
      .leftJoinAndSelect('cashflow.kassa', 'kassa')
      .leftJoinAndSelect('order.seller', 'seller')
      .leftJoinAndSelect('order.bar_code', 'bar_code')
      .leftJoinAndSelect('bar_code.collection', 'collection')
      .leftJoinAndSelect('bar_code.factory', 'factory')
      .leftJoinAndSelect('bar_code.size', 'size')
      .leftJoinAndSelect('bar_code.model', 'model')
      .leftJoinAndSelect('bar_code.country', 'country')
      .leftJoinAndSelect('bar_code.color', 'color')
      .where('cashflow.kassaId IN (:...kassaIds)', { kassaIds: kassaIdList })
      .orderBy('cashflow.date', 'DESC')
      .getMany();
  }

  async exportProductsByFilial(res: Response, filialId?: string) {
    try {
      const queryBuilder = this.productRepository
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.bar_code', 'bar_code')
        .leftJoinAndSelect('bar_code.collection', 'collection')
        .leftJoinAndSelect('bar_code.model', 'model')
        .leftJoinAndSelect('bar_code.size', 'size')
        .leftJoinAndSelect('bar_code.shape', 'shape')
        .leftJoinAndSelect('bar_code.style', 'style')
        .leftJoinAndSelect('bar_code.color', 'color')
        .leftJoinAndSelect('bar_code.country', 'country')
        .leftJoinAndSelect('bar_code.factory', 'factory')
        .leftJoinAndSelect('product.filial', 'filial');

      if (filialId) {
        queryBuilder.andWhere('product.filialId = :filialId', { filialId });
      }

      queryBuilder.orderBy('product.date', 'DESC');

      const products = await queryBuilder.getMany();

      // Excel ma'lumotlarini tayyorlash
      const excelData = products.map((product, index) => ({
        Barcode: product.bar_code?.code || '',
        Kolleksiya: product.bar_code?.collection?.title || '',
        Model: product.bar_code?.model?.title || '',
        "O'lchami": product.bar_code?.size?.title || '',
        'Hajm (m²)': product.y && product.bar_code?.size?.x ? (product.y * product.bar_code.size.x).toFixed(2) : '',
        Forma: product.bar_code?.shape?.title || '',
        Stil: product.bar_code?.style?.title || '',
        Rang: product.bar_code?.color?.title || '',
        Davlat: product.bar_code?.country?.title || '',
        Zavod: product.bar_code?.factory?.title || '',
        Soni: product.count || 0,
        Filial: product.filial?.title || '',
      }));

      // Excel fayl yaratish
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Ustun kengliklarini belgilash
      const columnWidths = [
        { wch: 15 }, // Barcode
        { wch: 20 }, // Kolleksiya
        { wch: 15 }, // Model
        { wch: 12 }, // O'lchami
        { wch: 12 }, // Hajm (m²)
        { wch: 12 }, // Forma
        { wch: 12 }, // Stil
        { wch: 12 }, // Rang
        { wch: 12 }, // Davlat
        { wch: 15 }, // Zavod
        { wch: 8 }, // Soni
        { wch: 20 }, // Filial
      ];

      worksheet['!cols'] = columnWidths;

      // Sheet nomini belgilash
      const sheetName = filialId ? 'Filial Mahsulotlari' : 'Barcha Mahsulotlar';
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Excel buffer yaratish
      const excelBuffer = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'buffer',
      });

      // Fayl nomini yaratish
      let fileName = 'mahsulotlar_';
      if (filialId) {
        fileName += `filial_${filialId}_`;
      } else {
        fileName += 'barcha_filiallar_';
      }
      fileName += `${new Date().toISOString().split('T')[0]}.xlsx`;

      // Response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', excelBuffer.length);

      return res.send(excelBuffer);
    } catch (error) {
      console.error('Mahsulotlar Excel export xatosi:', error);
      throw new Error('Excel fayl yaratishda xatolik yuz berdi: ' + error.message);
    }
  }

  async createProducts(partiya_id) {
    const partiya = await this.partiyaService.getOne(partiya_id);

    if (partiya.partiya_status !== 'closed' && partiya.partiya_status !== 'finished') throw new BadRequestException('Need accept M-Manager');

    const excelProds = await this.productExcelRepository.find({
      where: { partiya: { id: partiya_id } },
      relations: {
        bar_code: {
          size: true,
        },
      },
    });

    const products: CreateProductDto[] = [];
    for (const product of excelProds) {
      const data: CreateProductDto = {
        partiya: partiya_id,
        y: product.bar_code.isMetric ? +(product.check_count / 100).toFixed(2) : product.bar_code.size.y,
        count: product.count,
        bar_code: product.bar_code.id,
        comingPrice: product?.displayPrice || 0,
        filial: partiya.warehouse.id,
      };
      products.push(data);
    }

    if (excelProds.length > 0) await this.productService.create(products);
    else throw new BadRequestException('Вы не можете закончить партию, прежде чем вставить продукт!');

    await this.partiyaService.finish(partiya.id);

    return 'ok';
  }

  async getReport(partiyaId: string, type?: ProductReportEnum) {
    const params = [partiyaId];

    let query = '';

    switch (type) {
      case ProductReportEnum.SURPLUS:
        query = `
          SELECT
              SUM("displayPrice" * pe.y * s.x * CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" - "count" END) AS total,
              SUM(p."expensePerKv" * pe.y * s.x * CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" - "count" END) AS expence,
              SUM(pe.y * s.x * CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" - "count" END) AS volume,
              SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" - "count" END) AS count
          FROM productexcel pe
          LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
          LEFT JOIN size s ON qb."sizeId" = s.id
          LEFT JOIN partiya p ON pe."partiyaId" = p.id
          WHERE pe."partiyaId" = $1 AND (
              ("isMetric" = true AND "check_count" > pe."y") OR
              ("isMetric" = false AND "check_count" > pe."count")
          )
        `;
        break;

      case ProductReportEnum.DEFICIT:
        query = `
          SELECT
              SUM("displayPrice" * pe.y * s.x * CASE WHEN "isMetric" = true THEN 1 ELSE "count" - "check_count" END) AS total,
              SUM(p."expensePerKv" * pe.y * s.x * CASE WHEN "isMetric" = true THEN 1 ELSE "count" - "check_count" END) AS expence,
              SUM(pe.y * s.x * CASE WHEN "isMetric" = true THEN 1 ELSE "count" - "check_count" END) AS volume,
              SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "count" - "check_count" END) AS count
          FROM productexcel pe
          LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
          LEFT JOIN size s ON qb."sizeId" = s.id
          LEFT JOIN partiya p ON pe."partiyaId" = p.id
          WHERE pe."partiyaId" = $1 AND (
              ("isMetric" = true AND "check_count" < pe."y") OR
              ("isMetric" = false AND "check_count" < pe."count")
          )
        `;
        break;

      case ProductReportEnum.INVENTORY:
        query = `          
          SELECT 
              SUM(
                CASE 
                 when "isMetric" = true THEN "displayPrice" * check_count::numeric / 100 * s.x
                 else "displayPrice" * s.y * s.x * "check_count"
                END
                  )            AS total,
              SUM(
                 CASE 
                  when "isMetric" = true THEN p."expensePerKv" * check_count::numeric / 100 * s.x
                  else p."expensePerKv" * s.y * s.x * "check_count"
                 END
                  )            AS expence,
              ROUND(SUM(
               CASE
                   when "isMetric" = true THEN (check_count::numeric / 100) * s.x
                   ELSE pe.y * s.x * check_count END), 3)                 AS volume,
              SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "check_count" END)    AS count
          FROM productexcel pe
                   LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
                   LEFT JOIN size s ON qb."sizeId" = s.id
                   LEFT JOIN partiya p ON pe."partiyaId" = p.id
          WHERE pe."partiyaId" = $1 and check_count > 0
        `;
        break;

      default:
        query = `
          SELECT
              SUM("displayPrice" * pe.y * s.x * "count") AS total,
              SUM(p."expensePerKv" * pe.y * s.x * "count") AS expence,
              SUM(
              CASE
              when "isMetric" = true THEN pe.y * s.x ELSE pe.y * s.x * count END)             AS volume,
              SUM(CASE WHEN "isMetric" = true THEN 1 ELSE "count" END) AS count
          FROM productexcel pe
          LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
          LEFT JOIN size s ON qb."sizeId" = s.id
          LEFT JOIN partiya p ON pe."partiyaId" = p.id
          WHERE pe."partiyaId" = $1 AND "count" > 0 AND pe.y > 0
        `;
    }

    const result = await this.dataSource.query(query, params);
    return result[0];
  }

  async getPartiyaExcel(filialId: string, outputStream: Response) {
    const filial = await this.filialService.getOne(filialId);
    if (!filial) {
      throw new BadRequestException('Filial not found!');
    }

    const query = `
      select p.id,
             q.code                                                                                       as code,
             cl.title                                                                                     as collection,
             m.title                                                                                      as model,
             case when q."isMetric" = true then 'метражний' else 'штучний' end                            as tip,
             case
                 when q."isMetric" = false then (check_count::numeric * p.y * s.x)::numeric(20, 2)
                 else ((check_count::numeric / 100) * s.x)::numeric(20, 2) end                            as kv,
             case when q."isMetric" = true then p.count else check_count end                              as count,
             case when q."isMetric" = true then (check_count::numeric / 100)::numeric(20, 2) else p.y end as y,
             p.y                                                                                          as p_y,
             p.check_count                                                                                as check_count,
             s.title                                                                                      as size,
             st.title                                                                                     as style,
             c.title                                                                                      as color,
             p."dateOne"                                                                                  as date
      from product p
               left join qrbase q on p."barCodeId" = q.id
               left join size s on q."sizeId" = s.id
               left join color c on q."colorId" = c.id
               left join collection cl on q."collectionId" = cl.id
               left join shape sh on q."shapeId" = sh.id
               left join model m on q."modelId" = m."id"
               left join style st on q."styleId" = st.id
      where p.check_count > 0
        and p.is_deleted = false
        and "filialId" = $1
      order by date desc;
    `;

    const result = await this.dataSource.query(query, [filialId]);

    const data = result.map((item) => ({
      ...item,
      kv: Number(item.kv),
      y: Number(item.y),
      p_y: Number(item.p_y),
      count: Number(item.count),
      check_count: Number(item.check_count),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    const date = dayjs().tz(this.systemTz).format('DD-MM-YY HH-mm');
    const fileName = `${filial.title} ${date}.xlsx`;

    outputStream.setHeader('Content-Disposition', `attachment; filename=${encodeURI(fileName)}`);
    outputStream.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    return outputStream.send(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }
}
