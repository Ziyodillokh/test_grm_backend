const query = (url: string, model: string, color: string, shape: string) => {
  // Sanitize inputs to prevent SQL injection
  const sanitize = (val: string) => (val || '').replace(/'/g, "''");

  return `
WITH qrbase_ids AS (
    SELECT q.id
    FROM qrbase AS q
    LEFT JOIN model AS m ON q."modelId" = m.id
    LEFT JOIN color AS c ON q."colorId" = c.id
    LEFT JOIN shape AS sh ON q."shapeId" = sh.id
    WHERE m.title ILIKE '${sanitize(model)}'
      ${color ? `AND c.title ILIKE '${sanitize(color)}'` : ''}
      ${shape ? `AND sh.title ILIKE '${sanitize(shape)}'` : ''}
)
UPDATE qrbase
SET "imgUrlId" = (SELECT id FROM media WHERE path = '${sanitize(url)}' LIMIT 1)
FROM qrbase_ids
WHERE qrbase.id = qrbase_ids.id;
`;
};

export default query;
