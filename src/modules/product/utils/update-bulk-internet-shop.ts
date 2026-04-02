const query = (collection: string, text: string) => {
  // Sanitize inputs to prevent SQL injection
  const sanitizedCollection = (collection || '').replace(/'/g, "''");
  const sanitizedText = (text || '').replace(/'/g, "''");

  return `
WITH model_cte AS (
    SELECT id
    FROM model
    WHERE "collectionId" = '${sanitizedCollection}'
)
UPDATE qrbase
SET "internetInfo" = '${sanitizedText}'
WHERE "modelId" IN (SELECT id FROM model_cte);
`;
};

export default query;
