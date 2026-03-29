const query = (code: string) => `
select c.id as collection, qr.code, product.id
from product
         left join qrbase qr on product."barCodeId" = qr.id
         left join collection as c on qr."collectionId" = c.id
where qr.code = '${code}'
  and product.count > 0
  and product.y > 0
order by date;
`

export default query;