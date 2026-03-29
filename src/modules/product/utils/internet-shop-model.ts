const query = (collection: string, size: string, style: string, color: string)=> `
select distinct array_agg("imgUrl") as images, m.title, min("secondPrice") as price
from product as p
    join qrbase q on p."barCodeId" = q.id
         left join model as m on q."modelId" = m.id
         left join collection as c on q."collectionId" = c.id
         left join color as co on q."colorId" = co.id
where
    "isInternetShop" = true
and
    count > 0
and
    c.title  IN(${collection.replace('[', '').replace(']', '')})
    ${size ? `and p.size IN(${size.replace('[', '').replace(']', '')})` : ''}
    ${style ? `and p.style IN(${style.replace('[', '').replace(']', '')})` : ''}
    ${color ? `and co.title IN(${color.replace('[', '').replace(']', '')})` : ''}
group by m.title;
`

export default query