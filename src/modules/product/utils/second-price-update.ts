const query = (collection: string, size: string, text: number) => {
  // Sanitize inputs to prevent SQL injection
  const sanitizedCollection = (collection || '').replace(/'/g, "''");
  const sanitizedSize = (size || '').replace(/'/g, "''");
  const sanitizedPrice = Number(text) || 0;

  return `
UPDATE product
SET "secondPrice" = ${sanitizedPrice}
WHERE "barCodeId" IN (
    SELECT q.id
    FROM qrbase AS q
    LEFT JOIN model AS m ON q."modelId" = m.id
    LEFT JOIN size AS s ON q."sizeId" = s.id
    WHERE m."collectionId" = '${sanitizedCollection}'
      AND s.title ILIKE '${sanitizedSize}'
);
`;
};

export default query;
