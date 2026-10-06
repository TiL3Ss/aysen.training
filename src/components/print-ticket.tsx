"use client";

import { Printer } from "lucide-react";

export function PrintTicket() {
  return <button className="soft-button dark ticket-print-button" onClick={() => window.print()}><Printer size={15}/> Imprimir / guardar PDF</button>;
}
