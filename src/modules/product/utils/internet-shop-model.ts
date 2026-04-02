const query = (collection: string, size: string, style: string, color: string) => {
  // Sanitize inputs to prevent SQL injection
  const sanitize = (val: string) => (val || '').replace(/'/g, "''");

  return `
select distinct array_agg(med.path) as images, m.title, min(q."i_price") as price
from product as p
    join qrbase q on p."barCodeId" = q.id
         left join model as m on q."modelId" = m.id
         left join collection as c on q."collectionId" = c.id
         left join color as co on q."colorId" = co.id
         left join media as med on q."imgUrlId" = med.id
where
    "isInternetShop" = true
and
    p.count > 0
and
    c.title IN(${sanitize(collection).replace('[', '').replace(']', '')})
    ${size ? `and s.title IN(${sanitize(size).replace('[', '').replace(']', '')})` : ''}
    ${style ? `and st.title IN(${sanitize(style).replace('[', '').replace(']', '')})` : ''}
    ${color ? `and co.title IN(${sanitize(color).replace('[', '').replace(']', '')})` : ''}
group by m.title;
`;
};

export default query;
