"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { DownloadIcon, RotateCcwIcon, SaveIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveAffinities } from "@/server/actions/sectors";

type Sector = { id: string; name: string };

function keyOf(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function cellColor(value: number): string {
  // 0 = soft red, 50 = neutral, 100 = soft green.
  const hue = value < 50 ? 8 : 145;
  const strength = Math.abs(value - 50) / 50;
  return `hsl(${hue} 70% ${96 - strength * 26}%)`;
}

export function AffinityMatrix({
  sectors,
  initialValues,
}: {
  sectors: Sector[];
  initialValues: Record<string, number>;
}) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const filled: Record<string, number> = {};
    for (const a of sectors)
      for (const b of sectors)
        filled[keyOf(a.id, b.id)] = initialValues[keyOf(a.id, b.id)] ?? (a.id === b.id ? 10 : 50);
    return filled;
  });
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const byName = useMemo(
    () => new Map(sectors.map((s) => [s.name.trim().toLowerCase(), s.id])),
    [sectors],
  );

  function setCell(a: string, b: string, raw: string) {
    const value = Math.max(0, Math.min(100, Math.round(Number(raw) || 0)));
    setValues((current) => ({ ...current, [keyOf(a, b)]: value }));
    setDirty(true);
  }

  function resetAll() {
    setValues((current) => {
      const next = { ...current };
      for (const a of sectors)
        for (const b of sectors) next[keyOf(a.id, b.id)] = a.id === b.id ? 10 : 50;
      return next;
    });
    setDirty(true);
  }

  function save() {
    const entries: { fromSectorId: string; toSectorId: string; score: number }[] = [];
    for (let i = 0; i < sectors.length; i += 1) {
      for (let j = i; j < sectors.length; j += 1) {
        entries.push({
          fromSectorId: sectors[i].id,
          toSectorId: sectors[j].id,
          score: values[keyOf(sectors[i].id, sectors[j].id)] ?? 50,
        });
      }
    }
    startTransition(async () => {
      const result = await saveAffinities(entries);
      if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
      else {
        toast.success(result?.message ?? "Enregistré.");
        setDirty(false);
      }
    });
  }

  function exportCsv() {
    const header = ["Secteur", ...sectors.map((s) => s.name)].join(";");
    const lines = sectors.map((a) =>
      [a.name, ...sectors.map((b) => values[keyOf(a.id, b.id)] ?? 50)].join(";"),
    );
    const blob = new Blob(["﻿" + [header, ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "matrice-affinite.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    const text = (await file.text()).replace(/^﻿/, "");
    const rows = text
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => line.split(/[;,\t]/).map((cell) => cell.trim().replace(/^"|"$/g, "")));
    if (rows.length < 2) return toast.error("Fichier vide ou illisible.");
    const header = rows[0].slice(1).map((name) => byName.get(name.toLowerCase()));
    if (header.some((id) => !id))
      return toast.error("Les noms de secteurs de l'en-tête ne correspondent pas à vos secteurs.");
    const next = { ...values };
    let applied = 0;
    for (const row of rows.slice(1)) {
      const rowId = byName.get(row[0]?.toLowerCase() ?? "");
      if (!rowId) continue;
      row.slice(1).forEach((cell, index) => {
        const colId = header[index];
        const value = Number(cell);
        if (!colId || Number.isNaN(value)) return;
        next[keyOf(rowId, colId)] = Math.max(0, Math.min(100, Math.round(value)));
        applied += 1;
      });
    }
    setValues(next);
    setDirty(true);
    toast.success(`${applied} valeurs importées. Pensez à enregistrer.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Matrice d'affinité entre secteurs</h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            De 0 (aucun intérêt) à 100 (très complémentaires). La grille est symétrique : modifier
            une case met à jour son miroir. Les cases de la diagonale (même secteur) valent 10 par
            défaut.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={resetAll} disabled={pending}>
            <RotateCcwIcon aria-hidden="true" />
            Tout mettre à 50
          </Button>
          <Button type="button" variant="outline" onClick={exportCsv}>
            <DownloadIcon aria-hidden="true" />
            Exporter CSV
          </Button>
          <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
            <UploadIcon aria-hidden="true" />
            Importer CSV
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
          />
          <Button type="button" onClick={save} disabled={pending || !dirty}>
            <SaveIcon aria-hidden="true" />
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card p-2 text-left font-medium">Secteur</th>
              {sectors.map((s) => (
                <th key={s.id} className="h-36 w-12 p-1 align-bottom font-medium">
                  <div className="flex h-full items-end justify-center">
                    <span className="block max-h-32 origin-bottom-left translate-x-3 -rotate-60 transform whitespace-nowrap">
                      {s.name}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sectors.map((a) => (
              <tr key={a.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[200px] truncate bg-card p-2 text-left font-medium"
                >
                  {a.name}
                </th>
                {sectors.map((b) => {
                  const value = values[keyOf(a.id, b.id)] ?? 50;
                  return (
                    <td key={b.id} className="p-0.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={value}
                        onChange={(e) => setCell(a.id, b.id, e.target.value)}
                        aria-label={`${a.name} et ${b.name}`}
                        className="h-9 w-12 rounded border-0 text-center text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ backgroundColor: cellColor(value) }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
