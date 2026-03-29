const search = ({ text, partiyaId, limit, offset, total }) => `
SELECT 
${
  total ? 'COUNT(*) AS total' :
    `p.id,
       p.code,
       p.size,
       p.x,
       p.y,
       st.style,
       p.country,
       sh.shape,
       q."imgUrl",
       p."isInternetShop",
       p."secondPrice",
       p.count,
       p.price,
       p."priceMeter",
       p."comingPrice",
       to_json(c) AS color,
       json_build_object('id', m.id, 'title', m.title, 'collection', to_json(col)) AS model,
       to_json(pr) AS partiya`
}
FROM productexcel AS p
JOIN qrbase AS q ON p."barCodeId" = q.id
LEFT JOIN model AS m ON q."modelId" = m.id
LEFT JOIN public.collection col ON col.id = q."collectionId"
LEFT JOIN color AS c ON q."colorId" = c.id
LEFT JOIN size AS s ON q."sizeId" = s.id
LEFT JOIN style AS st ON q."styleId" = st.id
LEFT JOIN shape AS sh ON q."shapeId" = sh.id
LEFT JOIN country ON q."countryId" = country.id
LEFT JOIN public.partiya AS pr ON pr.id = p."partiyaId"
WHERE (SELECT COUNT(*)
       FROM (SELECT DISTINCT LOWER(word) AS word
             FROM (SELECT REGEXP_SPLIT_TO_TABLE(LOWER('%${text}%'), ' ') AS word) AS words) AS unique_words
       WHERE CONCAT_WS(' ', c.title, m.title, s.title, sh.title, st.title, q.code, col.title) ILIKE
             '%' || unique_words.word || '%') = (SELECT COUNT(*)
                                                 FROM (SELECT LOWER(word) AS word
                                                       FROM (SELECT REGEXP_SPLIT_TO_TABLE(LOWER('%${text}%'), ' ') AS word) AS words) AS unique_words)
  AND p.count > 0
  AND p.y > 0
  AND f."isActive" = true
  ${partiyaId ? `AND f.id = '${partiyaId}'` : ''}
${total ? '' : `ORDER BY p.id DESC OFFSET ${offset} LIMIT ${limit}`}
`;

export default search;