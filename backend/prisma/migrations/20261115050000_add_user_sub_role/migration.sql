ALTER TABLE "User"
ADD COLUMN "name" VARCHAR(160),
ADD COLUMN "subRole" TEXT NOT NULL DEFAULT 'OPERATOR';

WITH "rankedOrgUsers" AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "organizationId"
            ORDER BY "active" DESC, "createdAt" ASC, "id" ASC
        ) AS "position"
    FROM "User"
    WHERE "role" = 'ORGANIZATION' AND "organizationId" IS NOT NULL
)
UPDATE "User"
SET "subRole" = 'ORG_ADMIN'
FROM "rankedOrgUsers"
WHERE "User"."id" = "rankedOrgUsers"."id"
  AND "rankedOrgUsers"."position" = 1;
