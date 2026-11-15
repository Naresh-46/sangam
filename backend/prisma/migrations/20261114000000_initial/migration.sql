CREATE TYPE "OrganizationKind" AS ENUM ('MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY');
CREATE TYPE "UserRole" AS ENUM ('REGULATOR', 'ORGANIZATION');
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "Organization" (
  "id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "kind" "OrganizationKind" NOT NULL,
  "licenseNumber" VARCHAR(100) NOT NULL,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "passwordHash" VARCHAR(256) NOT NULL,
  "role" "UserRole" NOT NULL,
  "organizationId" UUID,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Batch" (
  "id" UUID NOT NULL,
  "medicineName" VARCHAR(160) NOT NULL,
  "strength" VARCHAR(80) NOT NULL,
  "batchNumber" VARCHAR(100) NOT NULL,
  "expiryDate" DATE NOT NULL,
  "quantity" INTEGER NOT NULL,
  "manufacturerId" UUID NOT NULL,
  "currentHolderId" UUID NOT NULL,
  "documentSha256" CHAR(64),
  "recalled" BOOLEAN NOT NULL DEFAULT false,
  "recallReason" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transfer" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "fromOrganizationId" UUID NOT NULL,
  "toOrganizationId" UUID NOT NULL,
  "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
  "offeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMPTZ(3),
  CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "actorUserId" UUID,
  "eventType" VARCHAR(32) NOT NULL,
  "details" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_licenseNumber_key" ON "Organization"("licenseNumber");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Batch_currentHolderId_createdAt_idx" ON "Batch"("currentHolderId", "createdAt");
CREATE INDEX "Batch_batchNumber_idx" ON "Batch"("batchNumber");
CREATE INDEX "Transfer_batchId_status_idx" ON "Transfer"("batchId", "status");
CREATE INDEX "Transfer_toOrganizationId_status_idx" ON "Transfer"("toOrganizationId", "status");
CREATE INDEX "AuditEvent_batchId_createdAt_idx" ON "AuditEvent"("batchId", "createdAt");

ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_currentHolderId_fkey" FOREIGN KEY ("currentHolderId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromOrganizationId_fkey" FOREIGN KEY ("fromOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toOrganizationId_fkey" FOREIGN KEY ("toOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
