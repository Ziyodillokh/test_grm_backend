const query = () => `
select distinct array_agg(med.path) as images, c.title, min(q."i_price") as price
from product as p
         join qrbase as q on p."barCodeId" = q.id
         left join model as m on q."modelId" = m.id
         left join collection as c on m."collectionId" = c.id
         left join media as med on q."imgUrlId" = med.id
where
    "isInternetShop" = true
and
    p.count > 0
group by c.title;
`;

export default query;
