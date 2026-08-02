-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEDECIN', 'ASSISTANTE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONTRAT_EMBAUCHE', 'CARTE_IDENTITE', 'DIPLOME', 'RIB', 'AUTRE');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('EN_ATTENTE', 'VALIDEE', 'REFUSEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "AbsenceType" AS ENUM ('VACANCES', 'FORMATION', 'CONGRES', 'MALADIE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StockRequestStatus" AS ENUM ('A_COMMANDER', 'COMMANDEE', 'RECUE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StockOrderStatus" AS ENUM ('COMMANDEE', 'RECUE_A_PAYER', 'PAYEE');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('NETTOYAGE', 'PAIE', 'COMPTABILITE', 'INFORMATIQUE', 'LOYER', 'ASSURANCE', 'FOURNITURES', 'AUTRE');

-- CreateEnum
CREATE TYPE "CostFrequency" AS ENUM ('MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "auth0Sub" TEXT,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "roles" "Role"[] DEFAULT ARRAY[]::"Role"[],
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "address" TEXT,
    "phone" TEXT,
    "socialSecurityNumber" TEXT,
    "jobTitle" TEXT,
    "contractType" TEXT,
    "hireDate" TIMESTAMP(3),
    "iban" TEXT,
    "emergencyContact" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL DEFAULT 'AUTRE',
    "label" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "daysCount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "allocatedDays" DOUBLE PRECISION NOT NULL DEFAULT 25,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "type" "AbsenceType" NOT NULL DEFAULT 'VACANCES',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "details" TEXT,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "status" "StockRequestStatus" NOT NULL DEFAULT 'A_COMMANDER',
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT,
    "supplier" TEXT,
    "status" "StockOrderStatus" NOT NULL DEFAULT 'COMMANDEE',
    "orderedById" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "amountCents" INTEGER,
    "devisFileName" TEXT,
    "devisPath" TEXT,
    "notes" TEXT,

    CONSTRAINT "StockOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringCost" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL DEFAULT 'AUTRE',
    "provider" TEXT,
    "amountCents" INTEGER NOT NULL,
    "frequency" "CostFrequency" NOT NULL DEFAULT 'MENSUEL',
    "startDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_auth0Sub_key" ON "User"("auth0Sub");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "LeaveRequest_requesterId_idx" ON "LeaveRequest"("requesterId");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_startDate_endDate_idx" ON "LeaveRequest"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_userId_year_key" ON "LeaveBalance"("userId", "year");

-- CreateIndex
CREATE INDEX "Absence_userId_idx" ON "Absence"("userId");

-- CreateIndex
CREATE INDEX "Absence_startDate_endDate_idx" ON "Absence"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "StockRequest_status_idx" ON "StockRequest"("status");

-- CreateIndex
CREATE INDEX "StockRequest_requesterId_idx" ON "StockRequest"("requesterId");

-- CreateIndex
CREATE INDEX "StockOrder_status_idx" ON "StockOrder"("status");

-- CreateIndex
CREATE INDEX "RecurringCost_active_idx" ON "RecurringCost"("active");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "StockOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOrder" ADD CONSTRAINT "StockOrder_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

