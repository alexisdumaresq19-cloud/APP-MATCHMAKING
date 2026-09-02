"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileUpIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/shared/form-field";
import { analyzeImport, confirmImport, type ImportReport } from "@/server/actions/import";

export function ImportWizard({ eventId }: { eventId: string }) {
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(file: File) {
    if (file.size > 2 * 1024 * 1024) return toast.error("Fichier trop volumineux (2 Mo maximum).");
    const text = await file.text();
    setCsvText(text);
    setFileName(file.name);
    setReport(null);
    startTransition(async () => setReport(await analyzeImport(eventId, text)));
  }

  const analysis = report?.ok ? report.analysis : undefined;

  return (
    <div className="space-y-6">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center hover:bg-muted/40">
        <FileUpIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        <span className="text-base font-medium">{fileName || "Choisir un fichier CSV"}</span>
        <span className="text-sm text-muted-foreground">
          UTF-8, séparateur « ; » ou « , », 1 000 lignes maximum
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </label>

      {pending && !analysis ? (
        <p className="text-base text-muted-foreground">Analyse en cours…</p>
      ) : null}
      {report && !report.ok ? <FormAlert message={report.formError} /> : null}

      {analysis ? (
        <div className="space-y-4">
          {analysis.missingColumns.length ? (
            <FormAlert
              message={`Colonnes obligatoires manquantes : ${analysis.missingColumns.join(", ")}. Téléchargez le modèle pour voir le format attendu.`}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Lignes lues</p>
                <p className="text-2xl font-semibold tabular-nums">{analysis.totalLines}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Prêtes à importer</p>
                <p className="text-2xl font-semibold text-green-700 tabular-nums">
                  {analysis.valid}
                </p>
                {analysis.existingEmails ? (
                  <p className="text-xs text-muted-foreground">
                    dont {analysis.existingEmails} profil(s) déjà connu(s), réutilisé(s)
                  </p>
                ) : null}
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Lignes en erreur</p>
                <p className="text-2xl font-semibold text-destructive tabular-nums">
                  {analysis.totalLines - analysis.valid}
                </p>
              </div>
            </div>
          )}
          {analysis.errors.length ? (
            <div className="max-h-80 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2">Ligne</th>
                    <th className="p-2">Champ</th>
                    <th className="p-2">Problème</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.errors.slice(0, 200).map((error, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2 tabular-nums">{error.line}</td>
                      <td className="p-2">{error.field}</td>
                      <td className="p-2">{error.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {analysis.valid > 0 && csvText ? (
            <Button
              type="button"
              size="lg"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await confirmImport(eventId, csvText);
                  if (result && !result.ok)
                    toast.error(result.formError ?? "L'importation a échoué.");
                })
              }
            >
              <UploadIcon aria-hidden="true" />
              {pending
                ? "Importation…"
                : `Importer les ${analysis.valid} ligne${analysis.valid > 1 ? "s" : ""} valide${analysis.valid > 1 ? "s" : ""}`}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
