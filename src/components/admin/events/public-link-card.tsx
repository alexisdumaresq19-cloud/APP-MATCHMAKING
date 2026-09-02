"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PublicLinkCard({
  url,
  qrUrl,
  disabled,
}: {
  url: string;
  qrUrl: string;
  disabled: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiez ce lien :", url);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lien public d'inscription</CardTitle>
        <CardDescription>
          {disabled
            ? "Ouvrez les inscriptions pour rendre la page accessible."
            : "Partagez ce lien ou affichez le code QR."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">{url}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={copy}>
            {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
            {copied ? "Copié" : "Copier le lien"}
          </Button>
          <a href={qrUrl} download className={buttonVariants({ variant: "outline", size: "lg" })}>
            <DownloadIcon aria-hidden="true" />
            Code QR (PNG)
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
