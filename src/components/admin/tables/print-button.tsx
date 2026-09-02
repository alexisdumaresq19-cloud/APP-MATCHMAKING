"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" size="lg" onClick={() => window.print()} className="print:hidden">
      <PrinterIcon aria-hidden="true" />
      Imprimer
    </Button>
  );
}
