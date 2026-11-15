ALTER TYPE "TransferStatus" RENAME VALUE 'ACCEPTED' TO 'CONFIRMED';

ALTER TABLE "Transfer" RENAME COLUMN "acceptedAt" TO "confirmedAt";

CREATE UNIQUE INDEX "Transfer_one_pending_per_batch"
ON "Transfer" ("batchId")
WHERE "status" = 'PENDING';
