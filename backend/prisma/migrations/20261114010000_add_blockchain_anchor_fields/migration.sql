ALTER TABLE "AuditEvent"
ADD COLUMN "eventHash" VARCHAR(66),
ADD COLUMN "txHash" VARCHAR(66);

CREATE UNIQUE INDEX "AuditEvent_eventHash_key" ON "AuditEvent"("eventHash");
CREATE UNIQUE INDEX "AuditEvent_txHash_key" ON "AuditEvent"("txHash");
