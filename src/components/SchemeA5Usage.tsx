"use client";

import { useActionState, useEffect, useMemo } from "react";
import {
  addSchemeA5Usage,
  deleteSchemeA5Usage,
  updateSchemeA5Usage,
} from "@/app/schemes/[schemeId]/actions";

type A5Item = {
  id: string;
  plant_name: string | null;
  category: string | null;
  quantity: number | null;
  one_way: boolean | null;
  fuel_type_id: string | null;
};

type A5UsageEntry = {
  id: string;
  period_start: string;
  period_end: string | null;
  litres_used: number | null;
  distance_km_each_way: number | null;
  one_way?: boolean | null;
  scheme_installation_items: A5Item | null;
};

type ActionState = {
  ok?: boolean;
  error?: string;
};

type SchemeA5UsageProps = {
  schemeId: string;
  entries: A5UsageEntry[];
  items: A5Item[];
  fuelNameEntries: Array<[string, string]>;
  fuelMode: string;
  distanceUnit: string;
  hasA5Postcodes: boolean;
};

type UsageGroup = {
  key: string;
  period_start: string;
  period_end: string | null;
  entries: A5UsageEntry[];
  totals: {
    litres: number;
    distance: number;
    plantCount: number;
    transportCount: number;
    fuels: Map<string, number>;
  };
};

const formatNumber = (value: number | null, digits = 2) => {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

export function SchemeA5Usage({
  schemeId,
  entries,
  items,
  fuelNameEntries,
  fuelMode,
  distanceUnit,
  hasA5Postcodes,
}: SchemeA5UsageProps) {
  const fuelNameById = new Map(fuelNameEntries);
  const [state, action] = useActionState<ActionState, FormData>(
    async (_prev, formData) => addSchemeA5Usage(schemeId, formData),
    {}
  );
  const [updateState, updateAction] = useActionState<ActionState, FormData>(
    async (_prev, formData) => updateSchemeA5Usage(schemeId, formData),
    {}
  );
  useEffect(() => {
    if (state?.ok) {
      const form = document.getElementById("a5-usage-form") as HTMLFormElement | null;
      form?.reset();
    }
  }, [state?.ok]);

  const groupedEntries = useMemo(() => {
    const map = new Map<string, UsageGroup>();
    entries.forEach((entry) => {
      const key = `${entry.period_start}|${entry.period_end ?? ""}`;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          period_start: entry.period_start,
          period_end: entry.period_end,
          entries: [],
          totals: {
            litres: 0,
            distance: 0,
            plantCount: 0,
            transportCount: 0,
            fuels: new Map(),
          },
        };
        map.set(key, group);
      }
      group.entries.push(entry);

      const item = entry.scheme_installation_items;
      const category = (item?.category ?? "").trim().toLowerCase();
      if (category === "plant") {
        group.totals.plantCount += 1;
      }
      if (category === "transport") {
        group.totals.transportCount += 1;
      }
      if (entry.litres_used) {
        group.totals.litres += entry.litres_used;
        const fuelId = item?.fuel_type_id;
        if (fuelId) {
          const current = group.totals.fuels.get(fuelId) ?? 0;
          group.totals.fuels.set(fuelId, current + entry.litres_used);
        }
      }
      if (entry.distance_km_each_way) {
        group.totals.distance += entry.distance_km_each_way;
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      b.period_start.localeCompare(a.period_start)
    );
  }, [entries]);

  const isAuto = fuelMode === "auto";
  const hideAutoDistanceInput = isAuto && hasA5Postcodes;
  const manualItems = isAuto
    ? items.filter((row) => (row.category ?? "").toLowerCase().trim() === "transport")
    : items;
  const distanceLabel = distanceUnit === "mi" ? "mi" : "km";
  const distanceDivisor = distanceUnit === "mi" ? 1.60934 : 1;
  const formatDistance = (value: number | null, digits = 1) =>
    formatNumber(value === null ? null : value / distanceDivisor, digits);

  return (
    <div className="scheme-collapse-body">
      <div className="scheme-card-header a5-usage-header">
        <div>
          <h3>Usage entries</h3>
          {isAuto ? (
            <p className="scheme-card-subtitle">
              Auto mode assigns default transport distance and plant fuel usage.
            </p>
          ) : null}
        </div>
      </div>
      {updateState?.error ? (
        <p className="create-scheme-message error">{updateState.error}</p>
      ) : null}
      {updateState?.ok ? (
        <p className="create-scheme-message success">Usage entry updated.</p>
      ) : null}

      <div className="a5-usage-groups">
        {groupedEntries.length ? (
          groupedEntries.map((group) => {
            const periodLabel = group.period_end
              ? `${group.period_start} -> ${group.period_end}`
              : group.period_start;
            const fuelSummary = Array.from(group.totals.fuels.entries()).map(
              ([fuelId, litres]) =>
                `${fuelNameById.get(fuelId) ?? "Fuel"}: ${formatNumber(litres, 2)} L`
            );

            return (
              <details key={group.key} className="a5-usage-group">
                <summary className="a5-usage-summary">
                  <div className="a5-usage-summary-main">
                    <strong>{periodLabel}</strong>
                    <span className="a5-usage-fuel">
                      Fuel: {fuelSummary.length ? fuelSummary.join(", ") : "-"}
                    </span>
                  </div>
                  <div className="a5-usage-meta">
                    <span>
                      Travel: {formatDistance(group.totals.distance, 1)} {distanceLabel}
                    </span>
                    <span>Plant entries: {group.totals.plantCount}</span>
                    <span>Transport entries: {group.totals.transportCount}</span>
                  </div>
                </summary>
                <div className="a5-usage-detail">
                  <div className="a5-usage-detail-head">
                    <span>Item</span>
                    <span>Category</span>
                    <span>Fuel</span>
                    <span className="a5-right">Litres</span>
                    <span className="a5-right">Distance ({distanceLabel})</span>
                    <span className="a5-right">One way</span>
                    <span className="a5-right">Action</span>
                  </div>
                  {group.entries.map((entry) => {
                    const item = entry.scheme_installation_items;
                    const fuelLabel =
                      item?.fuel_type_id ? fuelNameById.get(item.fuel_type_id) ?? "Fuel" : "-";
                    const isPlant = (item?.category ?? "").trim().toLowerCase() === "plant";
                    const isTransport = (item?.category ?? "").trim().toLowerCase() === "transport";
                    return (
                      <form key={entry.id} className="a5-usage-detail-row" action={updateAction}>
                        <input type="hidden" name="id" value={entry.id} />
                        <div>
                          <div>{item?.plant_name ?? "Item"}</div>
                          <div className="scheme-muted">Qty {item?.quantity ?? 1}</div>
                        </div>
                        <div>{item?.category ?? "Uncategorized"}</div>
                        <div>{fuelLabel}</div>
                        <div className="a5-right">
                          <input
                            name="litres_used"
                            type="number"
                            step="0.01"
                            defaultValue={entry.litres_used ?? ""}
                            placeholder="-"
                            disabled={isAuto && isPlant}
                          />
                        </div>
                        <div className="a5-right">
                          {hideAutoDistanceInput && isTransport ? (
                            <span className="scheme-muted">
                              {formatDistance(entry.distance_km_each_way, 1)}
                            </span>
                          ) : (
                            <input
                              name="distance_km_each_way"
                              type="number"
                              step="0.1"
                              defaultValue={
                                entry.distance_km_each_way !== null &&
                                entry.distance_km_each_way !== undefined
                                  ? (entry.distance_km_each_way / distanceDivisor).toFixed(1)
                                  : ""
                              }
                              placeholder="-"
                              disabled={isAuto && isTransport}
                            />
                          )}
                        </div>
                        <div className="a5-right">
                          {isTransport ? (
                            <label className="a5-usage-oneway">
                              <input type="hidden" name="one_way_present" value="1" />
                              <input
                                type="checkbox"
                                name="one_way"
                                defaultChecked={entry.one_way ?? false}
                              />
                              One way
                            </label>
                          ) : (
                            <span className="scheme-muted">-</span>
                          )}
                        </div>
                        <div className="a5-right a5-usage-actions">
                          <button className="btn-secondary" type="submit" disabled={isAuto}>
                            Update
                          </button>
                          <button
                            className="delete-button"
                            type="submit"
                            formAction={deleteSchemeA5Usage.bind(null, schemeId)}
                            title="Delete entry"
                          >
                            X
                          </button>
                        </div>
                      </form>
                    );
                  })}
                </div>
              </details>
            );
          })
        ) : (
          <div className="scheme-empty">No usage entries logged yet</div>
        )}
      </div>

      {isAuto ? (
        <div className="scheme-empty">
          {hasA5Postcodes
            ? "Auto mode is enabled. Distances are calculated from the base and site postcodes."
            : "Auto mode is enabled. Use the distance input above to update transport usage."}
        </div>
      ) : (
        <form id="a5-usage-form" action={action} className="a5-usage-form">
          <div className="a5-usage-period">
            <label>
              Period start
              <input type="date" name="period_start" required />
            </label>
            <label>
              Period end
              <input type="date" name="period_end" />
            </label>
          </div>
          <div className="a5-usage-list">
            {manualItems.length ? (
              manualItems.map((row) => {
                const category = (row.category ?? "").trim().toLowerCase();
                const isPlant = category === "plant";
                const isTransport = category === "transport";
                return (
                  <label key={row.id} className="a5-usage-row">
                    <input type="hidden" name="usage_item_ids" value={row.id} />
                    <div>
                      <div className="a5-usage-title">{row.plant_name}</div>
                      <div className="scheme-muted">
                        {row.category ?? "Uncategorized"} - Qty {row.quantity ?? 1}
                        {row.fuel_type_id
                          ? ` - Fuel: ${fuelNameById.get(row.fuel_type_id) ?? "Fuel"}`
                          : ""}
                      </div>
                    </div>
                    {isPlant ? (
                      <input
                        type="number"
                        name={`litres_used_${row.id}`}
                        step="0.01"
                        placeholder="Litres used (total)"
                      />
                    ) : null}
                    {isTransport ? (
                      <div className="a5-usage-transport">
                        <label className="a5-usage-oneway">
                          <input type="checkbox" name={`one_way_${row.id}`} />
                          One way
                        </label>
                        <input
                          type="number"
                          name={`distance_km_${row.id}`}
                          step="0.1"
                          placeholder={`Distance ${distanceLabel} (each way)`}
                        />
                      </div>
                    ) : null}
                  </label>
                );
              })
            ) : (
              <div className="scheme-empty">No plant or transport items added yet.</div>
            )}
          </div>
          <button className="btn-primary" type="submit" disabled={manualItems.length === 0}>
            Add usage entries
          </button>
          {state?.error ? (
            <p className="create-scheme-message error">{state.error}</p>
          ) : null}
          {state?.ok ? (
            <p className="create-scheme-message success">Usage entries added.</p>
          ) : null}
        </form>
      )}
    </div>
  );
}
