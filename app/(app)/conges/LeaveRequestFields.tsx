"use client";

import { useState } from "react";
import { countBusinessDays, parseDateOnly } from "@/lib/dates";
import { Field, Input } from "@/components/ui";

/**
 * Champs début / fin / nombre de jours de la nouvelle demande.
 * Le nombre de jours est pré-rempli avec les jours ouvrés (lundi → vendredi)
 * dès que les deux dates sont choisies, mais reste modifiable à la main.
 */
export function LeaveRequestFields() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [days, setDays] = useState("");

  function applyDates(nextStart: string, nextEnd: string) {
    setStartDate(nextStart);
    setEndDate(nextEnd);
    const start = parseDateOnly(nextStart);
    const end = parseDateOnly(nextEnd);
    if (start && end && start.getTime() <= end.getTime()) {
      setDays(String(countBusinessDays(start, end)));
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Date de début">
        <Input
          type="date"
          name="startDate"
          required
          value={startDate}
          onChange={(e) => applyDates(e.target.value, endDate)}
        />
      </Field>
      <Field label="Date de fin">
        <Input
          type="date"
          name="endDate"
          required
          min={startDate || undefined}
          value={endDate}
          onChange={(e) => applyDates(startDate, e.target.value)}
        />
      </Field>
      <Field
        label="Nombre de jours"
        hint="Pré-rempli avec les jours ouvrés (lundi à vendredi), modifiable."
      >
        <Input
          type="number"
          name="daysCount"
          required
          step={0.5}
          min={0.5}
          max={366}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="Ex. : 2.5"
        />
      </Field>
    </div>
  );
}
