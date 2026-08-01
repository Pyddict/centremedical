import { Role, DocumentType, AbsenceType, CostCategory, CostFrequency } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  MEDECIN: "Médecin",
  ASSISTANTE: "Assistante",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CONTRAT_EMBAUCHE: "Contrat d'embauche",
  CARTE_IDENTITE: "Carte d'identité",
  DIPLOME: "Diplôme",
  RIB: "RIB",
  AUTRE: "Autre",
};

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  VACANCES: "Vacances",
  FORMATION: "Formation",
  CONGRES: "Congrès",
  MALADIE: "Maladie",
  AUTRE: "Autre",
};

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  NETTOYAGE: "Nettoyage",
  PAIE: "Service de paie",
  COMPTABILITE: "Comptabilité",
  INFORMATIQUE: "Informatique",
  LOYER: "Loyer",
  ASSURANCE: "Assurance",
  FOURNITURES: "Fournitures",
  AUTRE: "Autre",
};

export const COST_FREQUENCY_LABELS: Record<CostFrequency, string> = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  SEMESTRIEL: "Semestriel",
  ANNUEL: "Annuel",
};

/** Nombre d'occurrences par an d'une fréquence (pour les totaux). */
export const COST_FREQUENCY_PER_YEAR: Record<CostFrequency, number> = {
  MENSUEL: 12,
  TRIMESTRIEL: 4,
  SEMESTRIEL: 2,
  ANNUEL: 1,
};

/** Jours de congés alloués par défaut quand aucun solde n'est configuré pour l'année. */
export const DEFAULT_LEAVE_DAYS = 25;
