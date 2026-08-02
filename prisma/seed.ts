/**
 * Script de seed (optionnel).
 *
 * - SEED_ADMIN_EMAIL : crée/promeut un administrateur avec cet email.
 *   (Sinon, le premier utilisateur qui se connecte via Auth0 devient
 *   automatiquement administrateur.)
 * - SEED_DEMO=1 : ajoute des données de démonstration (employés, congés,
 *   absences, demandes de stock, coûts) pour découvrir l'application.
 *
 * Usage : npm run db:seed
 */
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
  if (adminEmail) {
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { roles: { push: Role.ADMIN } },
      create: {
        email: adminEmail,
        firstName: process.env.SEED_ADMIN_FIRSTNAME ?? "Admin",
        lastName: process.env.SEED_ADMIN_LASTNAME ?? "",
        roles: [Role.ADMIN, Role.MEDECIN],
      },
    });
    // Dédoublonne les rôles si l'upsert a fait un push sur un compte déjà admin.
    await prisma.user.update({
      where: { id: admin.id },
      data: { roles: [...new Set(admin.roles.concat(Role.ADMIN))] },
    });
    console.log(`✔ Administrateur : ${adminEmail}`);
  }

  if (process.env.SEED_DEMO !== "1") {
    console.log("Seed terminé (utilisez SEED_DEMO=1 pour des données de démonstration).");
    return;
  }

  const year = new Date().getUTCFullYear();

  const [medecin, assistante] = await Promise.all([
    prisma.user.upsert({
      where: { email: "medecin.demo@example.com" },
      update: {},
      create: {
        email: "medecin.demo@example.com",
        firstName: "Marie",
        lastName: "Durand",
        roles: [Role.MEDECIN],
        jobTitle: "Médecin généraliste",
        phone: "06 12 34 56 78",
      },
    }),
    prisma.user.upsert({
      where: { email: "assistante.demo@example.com" },
      update: {},
      create: {
        email: "assistante.demo@example.com",
        firstName: "Sophie",
        lastName: "Martin",
        roles: [Role.ASSISTANTE],
        jobTitle: "Assistante médicale",
        phone: "06 98 76 54 32",
      },
    }),
  ]);

  for (const user of [medecin, assistante]) {
    await prisma.leaveBalance.upsert({
      where: { userId_year: { userId: user.id, year } },
      update: {},
      create: { userId: user.id, year, allocatedDays: 25 },
    });
  }

  await prisma.leaveRequest.create({
    data: {
      requesterId: assistante.id,
      startDate: utcDate(`${year}-09-14`),
      endDate: utcDate(`${year}-09-18`),
      daysCount: 5,
      reason: "Vacances de septembre",
    },
  });

  await prisma.absence.create({
    data: {
      userId: medecin.id,
      startDate: utcDate(`${year}-08-17`),
      endDate: utcDate(`${year}-08-28`),
      type: "VACANCES",
      note: "Congés d'été",
    },
  });

  await prisma.stockRequest.createMany({
    data: [
      { requesterId: medecin.id, itemName: "Gants nitrile taille M", quantity: 10 },
      { requesterId: medecin.id, itemName: "Abaisse-langue", quantity: 5, urgent: true },
    ],
  });

  await prisma.recurringCost.createMany({
    data: [
      { label: "Ménage du cabinet", category: "NETTOYAGE", provider: "CleanPro", amountCents: 45000, frequency: "MENSUEL" },
      { label: "Service de paie externalisé", category: "PAIE", provider: "PayExpert", amountCents: 12000, frequency: "MENSUEL" },
      { label: "Expert-comptable", category: "COMPTABILITE", provider: "Cabinet Comptable & Associés", amountCents: 180000, frequency: "ANNUEL" },
      { label: "Maintenance informatique", category: "INFORMATIQUE", provider: "ITMed", amountCents: 30000, frequency: "TRIMESTRIEL" },
    ],
  });

  console.log("✔ Données de démonstration créées.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
