"use client";

import { useMemo, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { deleteScheme } from "@/app/schemes/actions";

type SchemeRow = {
  id: string;
  name: string | null;
  is_locked?: boolean | null;
  area_m2?: number | null;
  total_kgco2e?: number | null;
  kgco2e_per_tonne?: number | null;
  materialSummaries?: { label: string; tonnage: number }[];
};

type SchemesTableProps = {
  schemes: SchemeRow[] | null;
};

export function SchemesTable({ schemes }: SchemesTableProps) {
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const router = useRouter();

  const confirmDelete = (event: React.FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    if (!window.confirm("Delete this scheme? This cannot be undone.")) {
      event.preventDefault();
    }
  };

  const formatNumber = (value: number | null | undefined, digits = 2) => {
    if (value == null || Number.isNaN(value)) return "-";
    return new Intl.NumberFormat("en-GB", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  };

  const filtered = useMemo(() => {
    const list = schemes ?? [];
    const q = query.trim().toLowerCase();
    const matches = q
      ? list.filter((scheme) => (scheme.name ?? "").toLowerCase().includes(q))
      : list;

    return [...matches].sort((a, b) => {
      const left = (a.name ?? "").toLowerCase();
      const right = (b.name ?? "").toLowerCase();
      if (left < right) return sortDir === "asc" ? -1 : 1;
      if (left > right) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [schemes, query, sortDir]);

  return (
    <table className="schemes-table">
      <colgroup>
        <col style={{ width: "46%" }} />
        <col style={{ width: "14%" }} />
        <col style={{ width: "16%" }} />
        <col style={{ width: "16%" }} />
        <col style={{ width: "8%" }} />
      </colgroup>
      <thead>
        <tr>
          <th align="left">
            <div className="scheme-header">
              <span>Scheme</span>
              <button
                type="button"
                className="sort-button"
                onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
                aria-label={`Sort schemes ${sortDir === "asc" ? "descending" : "ascending"}`}
              >
                {sortDir === "asc" ? "^" : "v"}
              </button>
              <input
                className="scheme-filter"
                type="search"
                placeholder="Filter schemes"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </th>
          <th align="right">Area (m2)</th>
          <th align="right">Total kgCO2e</th>
          <th align="right">kgCO2e / t</th>
          <th aria-label="Actions"></th>
        </tr>
      </thead>

      <tbody>
        {filtered.length ? (
          filtered.map((scheme) => {
            const handleRowClick = (
              event: React.MouseEvent<HTMLTableRowElement>
            ) => {
              const target = event.target as HTMLElement;
              if (target.closest("a,button,input,select,textarea,label")) {
                return;
              }
              router.push(`/schemes/${scheme.id}`);
            };
            const handleRowKey = (
              event: React.KeyboardEvent<HTMLTableRowElement>
            ) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(`/schemes/${scheme.id}`);
              }
            };

            return (
              <tr
                key={scheme.id}
                className="scheme-row"
                role="link"
                tabIndex={0}
                onClick={handleRowClick}
                onKeyDown={handleRowKey}
              >
                <td>
                  <div className="scheme-name">
                    <span
                      className={`scheme-lock-badge ${
                        scheme.is_locked ? "is-locked" : "is-open"
                      }`}
                    >
                      {scheme.is_locked ? "Locked" : "Open"}
                    </span>
                    <span>{scheme.name ?? "-"}</span>
                  </div>
                  {scheme.materialSummaries?.length ? (
                    <div className="scheme-material-badges">
                      {scheme.materialSummaries.slice(0, 3).map((item) => (
                        <span key={`${scheme.id}-${item.label}`} className="scheme-badge">
                          {item.label} - {item.tonnage.toLocaleString()} t
                        </span>
                      ))}
                      {scheme.materialSummaries.length > 3 ? (
                        <span className="scheme-badge scheme-badge-muted">
                          +{scheme.materialSummaries.length - 3} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </td>
                <td align="right">{formatNumber(scheme.area_m2 ?? null, 0)}</td>
                <td align="right">{formatNumber(scheme.total_kgco2e ?? null, 2)}</td>
                <td align="right">{formatNumber(scheme.kgco2e_per_tonne ?? null, 2)}</td>
                <td>
                  <form
                    className="scheme-actions"
                    action={deleteScheme.bind(null, scheme.id)}
                    onSubmit={confirmDelete}
                  >
                    <button
                      type="submit"
                      className="delete-button"
                      aria-label="Delete scheme"
                      title="Delete scheme"
                      onClick={(event) => event.stopPropagation()}
                    >
                      ×
                    </button>
                  </form>
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={5} className="scheme-empty">
              No schemes match your filter.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
