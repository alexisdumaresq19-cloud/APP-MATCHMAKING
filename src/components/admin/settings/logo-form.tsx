"use client";

/* eslint-disable @next/next/no-img-element */
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { deleteOrganizationLogo, uploadOrganizationLogo } from "@/server/actions/organization";

/** Logo upload with a local preview; the server sniffs the real type and caps at 2 MB (S4-01). */
export function LogoForm({ logoUrl, readOnly }: { logoUrl: string | null; readOnly: boolean }) {
  const [state, formAction] = useActionState(uploadOrganizationLogo, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Logo enregistré.");
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [state]);

  const shown = preview ?? logoUrl;
  return (
    <form action={formAction} className="space-y-4">
      <FormAlert message={state && !state.ok ? state.formError : null} />
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
          {shown ? (
            <img
              src={shown}
              alt="Logo de l'organisation"
              className="max-h-full max-w-full object-contain p-2"
            />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Field
            label="Fichier du logo"
            htmlFor="logo"
            error={errors.logo}
            hint="PNG, JPEG ou WebP, 2 Mo maximum. Idéalement sur fond transparent ou blanc."
          >
            <input
              ref={inputRef}
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={readOnly}
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-muted"
              {...fieldAria("logo", errors.logo, "hint")}
            />
          </Field>
          {!readOnly ? (
            <div className="flex flex-wrap gap-2">
              <SubmitButton pendingLabel="Téléversement…" disabled={!preview}>
                <UploadIcon aria-hidden="true" />
                Enregistrer le logo
              </SubmitButton>
              {logoUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteOrganizationLogo();
                      if (result && !result.ok)
                        toast.error(result.formError ?? "Une erreur est survenue.");
                      else toast.success(result?.message ?? "Logo retiré.");
                    })
                  }
                >
                  <Trash2Icon aria-hidden="true" />
                  Retirer le logo
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}
