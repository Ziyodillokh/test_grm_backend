const query = ( collection: string, model: string, shape: string, color: string, size: string ) => `
SELECT
    json_agg(DISTINCT model) AS model,
    json_agg(DISTINCT collection) AS collection,
    json_agg(DISTINCT country) AS country,
    json_agg(DISTINCT style) AS style,
    json_agg(DISTINCT shape) AS shape,
    json_agg(distinct jsonb_build_object('title', color, 'code', code)) AS color,
    json_agg(DISTINCT size) AS size
FROM
    (
        SELECT
            m.title AS model,
            c.title AS collection,
            co.title AS country,
            s.title AS style,
            sh.title AS shape,
            cl.title AS color,
            cl.code AS code,
            si.title AS size
        FROM
            product p
            join qrbase q on p."barCodeId" = q.id
            LEFT JOIN model m ON q."modelId" = m.id
            LEFT JOIN collection c ON q."collectionId" = c.id
            LEFT JOIN country co ON q."countryId" = co.title
            LEFT JOIN style s ON q."styleId" = s.title
            LEFT JOIN shape sh ON q."shapeId" = sh.title
            LEFT JOIN color cl ON q."colorId" = cl.id
            LEFT JOIN size si ON q."sizeId" = si.title
        WHERE
            p."isInternetShop" = true
            and p.count > 0
            and p.y > 0
            ${ collection ? `and c.title in(${collection.replace('[', '').replace(']', '')})` : '' } 
            ${ model ? `and m.title = '${model}'` : '' } 
            ${ shape ? `and p.shape in(${shape.replace('[', '').replace(']', '')})` : '' } 
            ${ color ? `and cl.title in(${color.replace('[', '').replace(']', '')})` : '' }
            ${ size ? `and p.size in(${size.replace('[', '').replace(']', '')})` : '' }
        GROUP BY
            m.title, c.title, co.title, s.title, sh.title, cl.title, si.title, cl.code
        ) AS subquery;
`
export default query;