const search = ({ text, filialId, base, limit, offset, total, shop, collection, calculateTotals = false, isDealer = false, type = 'filial' }) => `
SELECT 
${
  calculateTotals
    ? `
     SUM(p.count) as count,
     SUM(COALESCE(p.y, 0) * COALESCE(s.x, 0) * COALESCE(p.count, 0)) as kv,
     ${
       isDealer
         ? '0 as summa'
         : `SUM(COALESCE(p.y, 0) * COALESCE(s.x, 0) * COALESCE(p.count, 0) * COALESCE(
           (SELECT cp."priceMeter"
            FROM "collection-price" cp
            WHERE cp."collectionId" = col.id 
              AND cp.type = '${type}'
            ORDER BY cp.date ASC
            LIMIT 1), 0))`
     } as summa
    `
    : total
    ? 'COUNT(*) AS total'
    : `p.id,
       p.code,
       p.x,
       p.y,
       p."isInternetShop",
       p."secondPrice",
       p.count,
       p.price,
       p."priceMeter",
       p."comingPrice",
       json_build_object('id', m.id, 'title', m.title, 'collection', to_json(col)) AS model,
       json_build_object('id', q.id, 'color', to_json(c), 'collection', json_build_object('id', col.id,'title', col.title,'collection_prices', (select json_agg(distinct cp) from "collection-price" cp where cp."collectionId" = col.id)), 'model', to_json(m), 'size', to_json(s), 'country', to_json(country), 'shape', to_json(sh), 'style', to_json(st), 'isMetric', q."isMetric", 'imgUrl', to_json(med)) AS bar_code,
       to_json(col) as collection,
       to_json(f) AS filial`
}
FROM product AS p
JOIN qrbase AS q ON p."barCodeId" = q.id
LEFT JOIN model AS m ON q."modelId" = m.id
LEFT JOIN public.collection col ON col.id = q."collectionId"
LEFT JOIN color AS c ON q."colorId" = c.id
LEFT JOIN media AS med on q."imgUrlId" = med.id
LEFT JOIN size AS s ON q."sizeId" = s.id
LEFT JOIN style AS st ON q."styleId" = st.id
LEFT JOIN shape AS sh ON q."shapeId" = sh.id
LEFT JOIN country ON q."countryId" = country.id
LEFT JOIN public.filial AS f ON f.id = p."filialId"
WHERE (SELECT COUNT(*)
       FROM (SELECT DISTINCT LOWER(word) AS word
             FROM (SELECT REGEXP_SPLIT_TO_TABLE(LOWER('%${text}%'), ' ') AS word) AS words) AS unique_words
       WHERE CONCAT_WS(' ', c.title, m.title, s.title, sh.title, st.title, q.code, col.title) ILIKE
             '%' || unique_words.word || '%') = (SELECT COUNT(*)
                                                 FROM (SELECT LOWER(word) AS word
                                                       FROM (SELECT REGEXP_SPLIT_TO_TABLE(LOWER('%${text}%'), ' ') AS word) AS words) AS unique_words)
  AND p.count > 0
  AND p.y > 0
  AND p.is_deleted = false
  AND f."isActive" = true
  ${filialId ? `AND f.id = '${filialId}'` : ''}
  ${collection ? `AND col.id = '${collection}'` : ''} 
  ${base ? '' : `AND f.title != 'baza'`}
  ${shop === 'true' || shop === 'false' ? `AND p."isInternetShop" = ${shop}` : ''}
${total || calculateTotals ? '' : `ORDER BY p.id DESC OFFSET ${offset} LIMIT ${limit}`}
`;

export default search;