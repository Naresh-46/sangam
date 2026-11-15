CREATE TYPE "RecallAcknowledgmentStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED');
CREATE TYPE "RecallSeverity" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

ALTER TABLE "Batch"
ADD COLUMN "recallSeverity" "RecallSeverity";

CREATE TABLE "RecallAcknowledgment" (
    "id" UUID NOT NULL,
    "recallId" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "status" "RecallAcknowledgmentStatus" NOT NULL DEFAULT 'PENDING',
    "acknowledgedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecallAcknowledgment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecallAcknowledgment_recallId_orgId_key"
ON "RecallAcknowledgment"("recallId", "orgId");
CREATE INDEX "RecallAcknowledgment_orgId_status_idx"
ON "RecallAcknowledgment"("orgId", "status");

ALTER TABLE "RecallAcknowledgment"
ADD CONSTRAINT "RecallAcknowledgment_recallId_fkey"
FOREIGN KEY ("recallId") REFERENCES "Batch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecallAcknowledgment"
ADD CONSTRAINT "RecallAcknowledgment_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "RecallAcknowledgment" ("id", "recallId", "orgId")
SELECT gen_random_uuid(), custody."recallId", custody."orgId"
FROM (
    SELECT batch."id" AS "recallId", batch."manufacturerId" AS "orgId"
    FROM "Batch" batch
    WHERE batch."recalled" = true
    UNION
    SELECT batch."id", batch."currentHolderId"
    FROM "Batch" batch
    WHERE batch."recalled" = true
    UNION
    SELECT transfer."batchId", transfer."fromOrganizationId"
    FROM "Transfer" transfer
    JOIN "Batch" batch ON batch."id" = transfer."batchId"
    WHERE batch."recalled" = true AND transfer."status" = 'CONFIRMED'
    UNION
    SELECT transfer."batchId", transfer."toOrganizationId"
    FROM "Transfer" transfer
    JOIN "Batch" batch ON batch."id" = transfer."batchId"
    WHERE batch."recalled" = true AND transfer."status" = 'CONFIRMED'
) custody;
