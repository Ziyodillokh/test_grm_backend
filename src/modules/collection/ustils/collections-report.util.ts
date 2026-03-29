export const util = ({ filial, limit, offset }) => {
  return `
    SELECT c.id,
       c.title,
       COALESCE(SUM(p.count), 0)::INTEGER                                             AS "totalCount",
       COALESCE(SUM(p.count * p.y * sz.x), 0)::NUMERIC(20, 2)                         AS "totalKv",
       COALESCE(SUM(p.count * p.y * sz.x), 0)::NUMERIC(20, 2)
           * COALESCE((jsonb_agg(cp) -> 0 ->> 'priceMeter')::NUMERIC, 0)
                                                                                      AS "totalKvPrice",
       COALESCE(count(o), 0)::INTEGER                                                 as "totalSellCount",
       COALESCE(sum(o.kv), 0)::INTEGER                                                as "totalSellSize",
       COALESCE(sum(o.price), 0)::INTEGER + COALESCE(sum(o."plasticSum"), 0)::INTEGER as "totalSellPrice",
       COALESCE(sum(o."netProfitSum"), 0)::INTEGER                                    as "totalnetProfitSum",
       jsonb_agg(distinct cp)                                                                  as "collectionPrices"
    FROM collection c
         LEFT JOIN qrbase q ON q."collectionId" = c.id
         LEFT JOIN size sz ON sz.id = q."sizeId"
         LEFT JOIN product p ON p."barCodeId" = q.id
         LEFT JOIN "collection-price" cp ON c.id = cp."collectionId"
         LEFT JOIN "order" o ON p.id = o."productId"
    WHERE p.is_deleted = false
        AND p.y > 0.2
        AND p.count > 0
        AND p."filialId" ${filial ? `= '${filial}'` : 'IS NOT NULL'}
    GROUP BY c.id, c.title
    ORDER BY c.title
    limit ${limit}
    offset ${offset};
  `;
};