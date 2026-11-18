"use client";

import { createContext, useContext } from "react";

/** Company names by id, only in the Super Admin's All companies view (null otherwise) */
const CompanyNames = createContext<Record<string, string> | null>(null);

export function CompanyNamesProvider({ names, children }: { names: Record<string, string> | null; children: React.ReactNode }) {
  return <CompanyNames.Provider value={names}>{children}</CompanyNames.Provider>;
}

/** The "Company" header cell: shown only in the All companies view */
export function CompanyTh({ className = "px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 whitespace-nowrap" }: { className?: string }) {
  return useContext(CompanyNames) ? <th className={className}>Company</th> : null;
}

/** The row's company name: shown only in the All companies view */
export function CompanyTd({ row, className = "px-5 py-3 whitespace-nowrap text-[12.5px] font-semibold text-indigo-700" }: { row: object; className?: string }) {
  const names = useContext(CompanyNames);
  if (!names) return null;
  const id = (row as { companyId?: string }).companyId;
  return <td className={className}>{(id && names[id]) || "—"}</td>;
}
