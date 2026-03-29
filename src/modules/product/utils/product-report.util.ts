const util = (filialId) => `
SELECT
  -- TOTAL VALUE
  SUM(pe.y * s.x * pe."count") AS total,

  -- INVENTORY VALUE
  SUM(
    CASE 
      WHEN qb."isMetric" = true THEN (pe.check_count / 100) * s.x
      ELSE (pe.y * s.x) * pe.check_count
    END
  ) AS inventory,

  -- SURPLUS VALUE (only when inventory > actual count)
  SUM(
    CASE 
      WHEN qb."isMetric" = false AND pe.check_count > pe."count" THEN 
        s.kv * (pe.check_count - pe."count")
      WHEN qb."isMetric" = true AND pe.check_count > (pe.y * 100) THEN 
        (pe.check_count::numeric / 100 - pe.y) * s.x
      ELSE 0
    END
  ) AS surplus,

  -- DEFICIT VALUE (only when inventory < actual count)
  SUM(
    CASE 
      WHEN qb."isMetric" = false AND pe.check_count < pe."count" THEN 
        pe.y * s.x * (pe."count" - pe.check_count)
      WHEN qb."isMetric" = true AND pe.check_count < (pe.y * 100) THEN 
        (pe.y - (pe.check_count::numeric / 100)) * s.x
      ELSE 0
    END
  ) AS deficit

FROM product pe
LEFT JOIN qrbase qb ON pe."barCodeId" = qb.id
LEFT JOIN size s ON qb."sizeId" = s.id
WHERE pe."filialId" = '${filialId}' AND pe.is_deleted = false;
`;

export default util;