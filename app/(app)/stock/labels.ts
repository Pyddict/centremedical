import { StockOrderStatus, StockRequestStatus } from "@prisma/client";
import type { BadgeColor } from "@/components/ui";

/** Libellés français + couleurs de badge pour les statuts du module Stock. */

export const REQUEST_STATUS_META: Record<
  StockRequestStatus,
  { label: string; color: BadgeColor }
> = {
  A_COMMANDER: { label: "À commander", color: "gray" },
  COMMANDEE: { label: "Commandée", color: "blue" },
  RECUE: { label: "Reçue", color: "green" },
  ANNULEE: { label: "Annulée", color: "gray" },
};

export const ORDER_STATUS_META: Record<
  StockOrderStatus,
  { label: string; color: BadgeColor }
> = {
  COMMANDEE: { label: "Commandée", color: "blue" },
  RECUE_A_PAYER: { label: "Reçue — à payer", color: "amber" },
  PAYEE: { label: "Payée", color: "green" },
};
