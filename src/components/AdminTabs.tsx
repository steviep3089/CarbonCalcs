"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition, type ReactNode, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

type Plant = {
  id: string;
  name: string;
  location: string | null;
  description?: string | null;
  is_default?: boolean | null;
};

type MixType = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
};

type TransportMode = {
  id: string;
  name: string;
  kgco2e_per_km: number | null;
  kgco2e_unit?: string | null;
  is_default?: boolean | null;
};

type PlantMixFactor = {
  id: string;
  plant_id: string;
  mix_type_id: string;
  product_id: string | null;
  kgco2e_per_tonne: number | null;
  is_default?: boolean | null;
  valid_from: string | null;
  valid_to: string | null;
  source: string | null;
  plants?: { name: string | null } | { name: string | null }[] | null;
  products?: { name: string | null } | { name: string | null }[] | null;
};

type InstallationSetup = {
  id: string;
  plant_name: string;
  category: string | null;
  is_default?: boolean | null;
  spread_rate_t_per_m2: number | null;
  kgco2_per_t: number | null;
  kgco2_per_ltr: number | null;
  kgco2e: number | null;
  kgco2e_per_km: number | null;
  kgco2e_unit?: string | null;
  litres_per_t: number | null;
  litres_na: boolean | null;
  one_way: boolean | null;
};

type ReportMetric = {
  id: string;
  kind: "equivalency" | "savings";
  label: string;
  unit: string | null;
  value: number | null;
  calc_op?: string | null;
  calc_factor?: number | null;
  source: string | null;
  source_url?: string | null;
  sort_order: number | null;
  is_active: boolean;
};

type GhgCategory = {
  key: string;
  label: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sort_order?: number | null;
  is_active: boolean;
};

type GhgFactorFilter = {
  id: string;
  year: number;
  category_key: string | null;
  level1: string | null;
  level2: string | null;
  level3: string | null;
  level4: string | null;
  column_text: string | null;
  unit: string | null;
  ghg_unit: string | null;
  factor: number | null;
  is_active: boolean;
};

type ActionResponse = {
  error?: string;
  success?: boolean;
  count?: number;
  matches?: Array<{
    id: string;
    plant_id: string;
    mix_type_id: string;
    product_id: string | null;
    kgco2e_per_tonne: number | null;
    valid_from: string | null;
    valid_to: string | null;
    plants?: { name: string | null } | { name: string | null }[] | null;
    products?: { name: string | null } | { name: string | null }[] | null;
  }>;
  proposed?: {
    kgco2e_per_tonne: number;
    valid_from: string | null;
    valid_to: string | null;
    mix_type_id: string;
    product_id: string;
    a1_includes_raw_materials?: boolean;
  };
};

type Actions = {
  createPlant: (prevState: ActionResponse, formData: FormData) => Promise<ActionResponse>;
  updatePlant: (formData: FormData) => Promise<ActionResponse>;
  createPlantMixFactor: (prevState: ActionResponse, formData: FormData) => Promise<ActionResponse>;
  updatePlantMixFactor: (formData: FormData) => Promise<ActionResponse>;
  setPlantMixDefault: (formData: FormData) => Promise<ActionResponse>;
  createTransportMode: (prevState: ActionResponse, formData: FormData) => Promise<ActionResponse>;
  updateTransportMode: (formData: FormData) => Promise<ActionResponse>;
  deleteTransportMode: (formData: FormData) => Promise<ActionResponse>;
  createMixType: (prevState: ActionResponse, formData: FormData) => Promise<ActionResponse>;
  updateMixType: (formData: FormData) => Promise<ActionResponse>;
  createInstallationSetup: (prevState: ActionResponse, formData: FormData) => Promise<ActionResponse>;
  updateInstallationSetup: (formData: FormData) => Promise<ActionResponse>;
  updateInstallationSetupsBulk: (formData: FormData) => Promise<ActionResponse>;
  uploadInstallationSetups: (prevState: ActionResponse, formData: FormData) => Promise<ActionResponse>;
  deleteInstallationSetup: (formData: FormData) => Promise<ActionResponse>;
  uploadPlants: (prevState: ActionResponse, formData: FormData) => Promise<ActionResponse>;
  createMaterialMapping: (prevState: ActionResponse, formData: FormData) => Promise<ActionResponse>;
  uploadMaterialMappings: (prevState: ActionResponse, formData: FormData) => Promise<ActionResponse>;
  inviteUser: (prevState: ActionResponse, formData: FormData) => Promise<ActionResponse>;
  createReportMetric: (prevState: ActionResponse, formData: FormData) => Promise<ActionResponse>;
  updateReportMetric: (formData: FormData) => Promise<ActionResponse>;
  deleteReportMetric: (formData: FormData) => Promise<ActionResponse>;
  uploadReportMetrics: (prevState: ActionResponse, formData: FormData) => Promise<ActionResponse>;
  updateGhgCategory: (formData: FormData) => Promise<ActionResponse>;
  updateGhgFactorFilter: (formData: FormData) => Promise<ActionResponse>;
  setGhgFactorFiltersActive: (formData: FormData) => Promise<ActionResponse>;
};

type AdminTabsProps = {
  plants: Plant[];
  mixTypes: MixType[];
  products: Product[];
  transportModes: TransportMode[];
  plantMixFactors: PlantMixFactor[];
  installationSetups: InstallationSetup[];
  reportMetrics: ReportMetric[];
  ghgCategories: GhgCategory[];
  ghgFilters: GhgFactorFilter[];
  actions: Actions;
};

type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

export function AdminTabs({
  plants,
  mixTypes,
  products,
  transportModes,
  plantMixFactors,
  installationSetups,
  reportMetrics,
  ghgCategories,
  ghgFilters,
  actions,
}: AdminTabsProps) {
  const [active, setActive] = useState("plants");
  const searchParams = useSearchParams();

  const tabs: TabItem[] = [
    {
      id: "plants",
      label: "Manufacturing Plant",
      content: (
        <ManufacturingTab
          plants={plants}
          plantMixFactors={plantMixFactors}
          actions={actions}
        />
      ),
    },
    {
      id: "logistics",
      label: "Logistics",
      content: (
        <LogisticsTab transportModes={transportModes} actions={actions} />
      ),
    },
    {
      id: "materials",
      label: "Materials",
      content: (
        <MaterialCreationTab
          mixTypes={mixTypes}
          products={products}
          plants={plants}
          actions={actions}
        />
      ),
    },
    {
      id: "installation",
      label: "Installation Setup",
      content: (
        <InstallationTab
          installationSetups={installationSetups}
          actions={actions}
        />
      ),
    },
    {
      id: "conversion-factors",
      label: "Carbon Catalogue",
      content: (
        <ConversionFactorsTab
          categories={ghgCategories}
          filters={ghgFilters}
          actions={actions}
        />
      ),
    },
    {
      id: "reports",
      label: "Reports",
      content: (
        <ReportsTab reportMetrics={reportMetrics} actions={actions} />
      ),
      },
      {
        id: "users",
        label: "User access",
        content: <UserAccessTab actions={actions} />,
      },
  ];

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (!tabParam) return;
    if (tabs.some((tab) => tab.id === tabParam)) {
      setActive(tabParam);
    }
  }, [searchParams, tabs]);

  return (
    <section className="admin-tabs">
      <div className="admin-tab-list">
        {tabs
          .filter((tab) => tab.id !== "users")
          .map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`admin-tab ${active === tab.id ? "active" : ""}`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-tab-content">
        {tabs.find((tab) => tab.id === active)?.content}
      </div>
    </section>
  );
}

function ManufacturingTab({
  plants,
  plantMixFactors,
  actions,
}: {
  plants: Plant[];
  plantMixFactors: PlantMixFactor[];
  actions: Actions;
}) {
  const [createPlantState, createPlantAction] = useActionState(actions.createPlant, {});
  const [uploadPlantsState, uploadPlantsAction] = useActionState(actions.uploadPlants, {});
  const [showModal, setShowModal] = useState(false);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [editingFactorId, setEditingFactorId] = useState<string | null>(null);

  useEffect(() => {
    if (createPlantState?.success) {
      setShowModal(false);
    }
  }, [createPlantState]);


  const plantFactors = useMemo(() => {
    if (!selectedPlantId) return [];
    return plantMixFactors.filter((row) => row.plant_id === selectedPlantId);
  }, [plantMixFactors, selectedPlantId]);

  const selectedPlant = useMemo(
    () => plants.find((plant) => plant.id === selectedPlantId) ?? null,
    [plants, selectedPlantId]
  );

  return (
    <div className="admin-grid">
      <section className="scheme-card">
        <div className="scheme-card-header admin-header-row">
          <div>
            <h2>Plants</h2>
            <p className="scheme-card-subtitle">
              Maintain plant names, locations, and descriptions.
            </p>
          </div>
          <div className="admin-header-actions">
            <form action={uploadPlantsAction} className="admin-upload">
              <input name="file" type="file" accept=".csv" />
              <a
                className="btn-secondary"
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                  "name,location,description\nExample Plant,cv09 02rs,Main asphalt plant"
                )}`}
                download="plants-template.csv"
              >
                Template
              </a>
              <button className="btn-primary" type="submit">
                Upload
              </button>
            </form>
            <button className="btn-primary" type="button" onClick={() => setShowModal(true)}>
              Add plant
            </button>
          </div>
        </div>

        {uploadPlantsState?.error ? (
          <p className="create-scheme-message error">{uploadPlantsState.error}</p>
        ) : null}
        {uploadPlantsState?.success ? (
          <p className="create-scheme-message success">
            Uploaded {uploadPlantsState.count ?? 0} rows.
          </p>
        ) : null}

        <div className="plant-card-grid">
          {plants.map((plant) => {
            const isActive = plant.id === selectedPlantId;
            return (
              <button
                key={plant.id}
                type="button"
                className={`plant-card ${isActive ? "active" : ""}`}
                onClick={() => setSelectedPlantId(plant.id)}
              >
                <div>
                  <h3>{plant.name}</h3>
                  <p>{plant.location ?? "No location"}</p>
                </div>
                <div className="plant-card-meta">
                  {plant.description ? <span>{plant.description}</span> : null}
                  {plant.is_default ? <span className="scheme-muted">Default</span> : null}
                </div>
              </button>
            );
          })}
        </div>

        {selectedPlantId ? (
          <div className="plant-detail">
            <h3 className="display-text">Assigned mixes & products</h3>
            {selectedPlant ? (
              <form action={actions.updatePlant} className="plant-default-form">
                <input type="hidden" name="id" value={selectedPlant.id} />
                <input type="hidden" name="name" value={selectedPlant.name} />
                <input
                  type="hidden"
                  name="location"
                  value={selectedPlant.location ?? ""}
                />
                <input
                  type="hidden"
                  name="description"
                  value={selectedPlant.description ?? ""}
                />
                <label className="admin-inline-checkbox">
                  <input
                    type="checkbox"
                    name="is_default"
                    defaultChecked={selectedPlant.is_default ?? false}
                  />
                  Default plant for new material lines
                </label>
                <button className="btn-secondary" type="submit">
                  Save
                </button>
              </form>
            ) : null}
            <div className="plant-factor-list">
              {plantFactors.length ? (
                plantFactors.map((row) => (
                  <div
                    key={row.id}
                    className={`plant-factor-item ${
                      editingFactorId === row.id ? "is-editing" : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setEditingFactorId((current) =>
                        current === row.id ? null : row.id
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setEditingFactorId((current) =>
                          current === row.id ? null : row.id
                        );
                      }
                    }}
                  >
                    {editingFactorId === row.id ? (
                      <form
                        action={actions.updatePlantMixFactor}
                        className="plant-factor-edit"
                        onClick={(event) => event.stopPropagation()}
                        onSubmit={() => setEditingFactorId(null)}
                      >
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="plant_id" value={row.plant_id} />
                        <input type="hidden" name="mix_type_id" value={row.mix_type_id} />
                        <input
                          type="hidden"
                          name="product_id"
                          value={row.product_id ?? ""}
                        />
                        <label>
                          kgCO2e / t
                          <input
                            name="kgco2e_per_tonne"
                            type="number"
                            step="0.01"
                            defaultValue={row.kgco2e_per_tonne ?? ""}
                          />
                        </label>
                        <label>
                          Valid from
                          <input
                            name="valid_from"
                            type="date"
                            defaultValue={row.valid_from ?? ""}
                          />
                        </label>
                        <label>
                          Valid to
                          <input
                            name="valid_to"
                            type="date"
                            defaultValue={row.valid_to ?? ""}
                          />
                        </label>
                        <label>
                          Source
                          <input name="source" defaultValue={row.source ?? ""} />
                        </label>
                        <div className="plant-factor-actions">
                          <button className="btn-secondary" type="submit">
                            Save
                          </button>
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() => setEditingFactorId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div>
                          <strong>{row.mix_type_id}</strong>
                          <span>{row.products?.name ?? "No product"}</span>
                        </div>
                        <div className="plant-factor-meta">
                          <span>{row.kgco2e_per_tonne ?? "-"} kgCO2e / t</span>
                          <span>{row.valid_from ?? "-"}</span>
                          {row.is_default ? (
                            <span className="scheme-muted">Default</span>
                          ) : null}
                        </div>
                        <form
                          action={actions.setPlantMixDefault}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="plant_id" value={row.plant_id} />
                          <button
                            className="btn-secondary"
                            type="submit"
                            disabled={row.is_default ?? false}
                          >
                            {row.is_default ? "Default" : "Set default"}
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <p className="scheme-card-subtitle">No mix factors assigned yet.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="scheme-card-subtitle">Select a plant to view its materials.</p>
        )}
      </section>

      {showModal ? (
        <div className="admin-modal">
          <div className="admin-modal-card">
            <h3 className="display-text">Add plant</h3>
            <p className="scheme-card-subtitle">Enter the plant details below.</p>
            <form action={createPlantAction} className="admin-modal-form">
              <label>
                Plant name
                <input name="name" placeholder="Plant name" />
              </label>
              <label>
                Location / postcode
                <input name="location" placeholder="Location / postcode" />
              </label>
              <label>
                Description
                <input name="description" placeholder="Description" />
              </label>
              <label className="admin-inline-checkbox">
                <input type="checkbox" name="is_default" />
                Set as default plant
              </label>
              <div className="admin-modal-actions">
                <button className="btn-primary" type="submit">
                  Save plant
                </button>
                <button className="btn-secondary" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
              </div>
              {createPlantState?.error ? (
                <p className="create-scheme-message error">{createPlantState.error}</p>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LogisticsTab({
  transportModes,
  actions,
}: {
  transportModes: TransportMode[];
  actions: Actions;
}) {
  const milesToKm = 1.60934;
  const [createTransportState, createTransportAction] = useActionState(
    actions.createTransportMode,
    {}
  );

  return (
    <section className="scheme-card">
      <div className="scheme-card-header">
        <h2>Transport modes</h2>
        <p className="scheme-card-subtitle">
          Maintain logistics modes and kgCO2e per km (auto-converts from miles).
        </p>
      </div>

      <div className="admin-grid-head admin-logistics-grid admin-grid-labels">
        <span className="admin-spacer" />
        <span>Id</span>
        <span>Name</span>
        <span>kgCO2e</span>
        <span>Default</span>
        <span>Action</span>
      </div>

      <table className="scheme-table admin-table">
        <tbody>
          {transportModes.map((mode) => (
            <tr key={mode.id}>
              <td colSpan={5}>
                <form action={actions.updateTransportMode} className="admin-row-form admin-logistics-grid">
                  <input type="hidden" name="original_id" value={mode.id} />
                  <button
                    className="delete-button"
                    type="submit"
                    formAction={actions.deleteTransportMode}
                    title="Delete mode"
                  >
                    X
                  </button>
                  <input name="id" defaultValue={mode.id} />
                  <input name="name" defaultValue={mode.name} />
                  <div className="admin-inline-field">
                    <input
                      name="kgco2e_per_km"
                      type="number"
                      step="0.0001"
                      defaultValue={
                        mode.kgco2e_per_km === null
                          ? ""
                          : (mode.kgco2e_unit ?? "km").toLowerCase() === "mi"
                            ? (mode.kgco2e_per_km * milesToKm).toFixed(4)
                            : mode.kgco2e_per_km.toFixed(4)
                      }
                    />
                    <select
                      name="kgco2e_unit"
                      defaultValue={(mode.kgco2e_unit ?? "km").toLowerCase()}
                      className="admin-unit-select"
                    >
                      <option value="km">/ km</option>
                      <option value="mi">/ mi</option>
                    </select>
                  </div>
                  <label className="admin-inline-checkbox">
                    <input
                      type="checkbox"
                      name="is_default"
                      defaultChecked={mode.is_default ?? false}
                    />
                    Default
                  </label>
                  <button className="btn-secondary" type="submit">
                    Update
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form action={createTransportAction} className="admin-create">
        <h3 className="display-text">Add transport mode</h3>
        <div className="admin-form-row">
          <input name="id" placeholder="Id (e.g. ARTIC)" />
          <input name="name" placeholder="Name" />
          <div className="admin-inline-field">
            <input
              name="kgco2e_per_km"
              type="number"
              step="0.0001"
              placeholder="kgCO2e"
            />
            <select name="kgco2e_unit" defaultValue="km" className="admin-unit-select">
              <option value="km">/ km</option>
              <option value="mi">/ mi</option>
            </select>
          </div>
          <label className="admin-inline-checkbox">
            <input type="checkbox" name="is_default" />
            Default
          </label>
          <button className="btn-primary" type="submit">
            Add
          </button>
        </div>
        {createTransportState?.error ? (
          <p className="create-scheme-message error">{createTransportState.error}</p>
        ) : null}
        {createTransportState?.success ? (
          <p className="create-scheme-message success">Transport mode added.</p>
        ) : null}
      </form>
    </section>
  );
}

function MaterialCreationTab({
  mixTypes,
  products,
  plants,
  actions,
}: {
  mixTypes: MixType[];
  products: Product[];
  plants: Plant[];
  actions: Actions;
}) {
  const [createMappingState, createMappingAction] = useActionState(
    actions.createMaterialMapping,
    {}
  );
  const [uploadMaterialsState, uploadMaterialsAction] = useActionState(
    actions.uploadMaterialMappings,
    {}
  );
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [selectedOverwriteIds, setSelectedOverwriteIds] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  const [mixTypeId, setMixTypeId] = useState("");
  const [mixTypeName, setMixTypeName] = useState("");
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [kgco2ePerT, setKgco2ePerT] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [validToNa, setValidToNa] = useState(false);
  const [a1IncludesRawMaterials, setA1IncludesRawMaterials] = useState(false);

  useEffect(() => {
    if (createMappingState?.success) {
      setSelectedPlants([]);
      setMixTypeId("");
      setMixTypeName("");
      setProductId("");
      setProductName("");
      setKgco2ePerT("");
      setValidFrom("");
      setValidTo("");
      setValidToNa(false);
      setA1IncludesRawMaterials(false);
    }
  }, [createMappingState]);

  useEffect(() => {
    if (createMappingState?.matches?.length) {
      setShowOverwriteModal(true);
      setSelectedOverwriteIds(createMappingState.matches.map((row) => row.id));
    }
  }, [createMappingState?.matches]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      createMappingAction(formData);
    });
  };

  const displayMixType =
    mixTypeName ||
    mixTypes.find((mix) => mix.id === mixTypeId)?.name ||
    mixTypeId ||
    "-";
  const displayProduct =
    productName ||
    products.find((product) => product.id === productId)?.name ||
    productId ||
    "-";
  const displayPlantNames = selectedPlants.length
    ? plants
        .filter((plant) => selectedPlants.includes(plant.id))
        .map((plant) => plant.name)
        .join(", ")
    : "-";

  const handleOverwrite = () => {
    const formData = new FormData();
    formData.set("plant_ids", JSON.stringify(selectedPlants));
    formData.set("mix_type_id", mixTypeId);
    formData.set("mix_type_name", mixTypeName);
    formData.set("product_id", productId);
    formData.set("product_name", productName);
    formData.set("kgco2e_per_tonne", kgco2ePerT);
    formData.set("valid_from", validFrom);
    formData.set("valid_to", validTo);
    if (validToNa) {
      formData.set("valid_to_na", "on");
    }
    if (a1IncludesRawMaterials) {
      formData.set("a1_includes_raw_materials", "on");
    }
    formData.set("mode", "overwrite");
    formData.set("overwrite_ids", JSON.stringify(selectedOverwriteIds));
    startTransition(() => {
      createMappingAction(formData);
    });
    setShowOverwriteModal(false);
  };

  return (
    <section className="scheme-card">
      <div className="scheme-card-header admin-header-row">
        <div>
          <h2>Material creation</h2>
          <p className="scheme-card-subtitle">
            Assign mix types and products to selected plants.
          </p>
        </div>
        <form action={uploadMaterialsAction} className="admin-upload">
          <input name="file" type="file" accept=".csv" />
          <a
            className="btn-secondary"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(
              "plant_name,mix_type,product_name,kgco2e_per_tonne,valid_from,valid_to,source,a1_includes_raw_materials\nMoorcroft,HOT,TSCS,55,2026-01-03,,manual,false"
            )}`}
            download="materials-template.csv"
          >
            Template
          </a>
          <button className="btn-primary" type="submit">
            Upload
          </button>
        </form>
      </div>

      {uploadMaterialsState?.error ? (
        <p className="create-scheme-message error">{uploadMaterialsState.error}</p>
      ) : null}
      {uploadMaterialsState?.success ? (
        <p className="create-scheme-message success">
          Uploaded {uploadMaterialsState.count ?? 0} rows.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="material-form">
        <div className="material-field">
          <label>Plants</label>
          <details className="material-dropdown">
            <summary>Select plants</summary>
            <div className="material-multi">
              {plants.map((plant) => (
                <label key={plant.id} className="material-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedPlants.includes(plant.id)}
                    onChange={(event) => {
                      setSelectedPlants((prev) =>
                        event.target.checked
                          ? [...prev, plant.id]
                          : prev.filter((id) => id !== plant.id)
                      );
                    }}
                  />
                  {plant.name}
                </label>
              ))}
            </div>
          </details>
          <input type="hidden" name="plant_ids" value={JSON.stringify(selectedPlants)} />
        </div>

        <div className="material-field">
          <label>Mix type</label>
          <select
            name="mix_type_id"
            value={mixTypeId}
            onChange={(event) => setMixTypeId(event.target.value)}
          >
            <option value="">Select mix type</option>
            {mixTypes.map((mix) => (
              <option key={mix.id} value={mix.id}>
                {mix.name}
              </option>
            ))}
          </select>
          <input
            name="mix_type_name"
            placeholder="Or add new mix type"
            value={mixTypeName}
            onChange={(event) => setMixTypeName(event.target.value)}
          />
        </div>

        <div className="material-field">
          <label>Product</label>
          <select
            name="product_id"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="">Select product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <input
            name="product_name"
            placeholder="Or add new product"
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
          />
        </div>

        <div className="material-grid material-grid-tight">
          <label>
            kgCO2e / t
            <input
              name="kgco2e_per_tonne"
              type="number"
              step="0.01"
              value={kgco2ePerT}
              onChange={(event) => setKgco2ePerT(event.target.value)}
            />
          </label>
          <label>
            Valid from
            <input
              name="valid_from"
              type="date"
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
            />
          </label>
          <div className="valid-to-group">
            <label>
              Valid to
              <input
                name="valid_to"
                type="date"
                value={validTo}
                onChange={(event) => setValidTo(event.target.value)}
              />
            </label>
            <label className="admin-checkbox material-checkbox-inline">
              <input
                name="valid_to_na"
                type="checkbox"
                checked={validToNa}
                onChange={(event) => setValidToNa(event.target.checked)}
              />
              N/A
            </label>
          </div>
        </div>
        <label className="admin-checkbox material-checkbox-inline material-checkbox-row">
          <input
            name="a1_includes_raw_materials"
            type="checkbox"
            checked={a1IncludesRawMaterials}
            onChange={(event) => setA1IncludesRawMaterials(event.target.checked)}
          />
          A1 includes raw material transport
        </label>

        <button className="btn-primary" type="submit">
          Create mapping
        </button>

        {createMappingState?.error && !createMappingState?.matches?.length ? (
          <p className="create-scheme-message error">{createMappingState.error}</p>
        ) : null}
        {createMappingState?.success ? (
          <p className="create-scheme-message success">
            Created {createMappingState.count ?? 0} mapping(s).
          </p>
        ) : null}
      </form>

      {showOverwriteModal && createMappingState?.matches?.length ? (
        <div className="admin-modal">
          <div className="admin-modal-card">
            <h3 className="display-text">Overwrite existing mix?</h3>
            <p className="scheme-card-subtitle">
              Matching entries already exist. Choose which ones to overwrite.
            </p>
            <div className="overwrite-proposed">
              <h4>Proposed entry</h4>
              <div className="overwrite-proposed-row">
                <span>Plants: {displayPlantNames}</span>
                <span>Mix: {displayMixType}</span>
                <span>Product: {displayProduct}</span>
                <span>kgCO2e: {kgco2ePerT || "-"}</span>
                <span>
                  Dates: {validFrom || "-"} to {validToNa ? "N/A" : validTo || "-"}
                </span>
              </div>
            </div>
            <p className="scheme-card-subtitle overwrite-heading">
              Select rows to overwrite:
            </p>
            <div className="overwrite-list">
              {createMappingState.matches.map((row) => (
                <label key={row.id} className="overwrite-item">
                  <input
                    type="checkbox"
                    checked={selectedOverwriteIds.includes(row.id)}
                    onChange={(event) => {
                      setSelectedOverwriteIds((prev) =>
                        event.target.checked
                          ? [...prev, row.id]
                          : prev.filter((id) => id !== row.id)
                      );
                    }}
                  />
                  <div className="overwrite-proposed-row overwrite-item-row">
                    <span>Plants: {row.plants?.name ?? "Plant"}</span>
                    <span>Mix: {row.mix_type_id || "-"}</span>
                    <span>Product: {row.products?.name ?? "No product"}</span>
                    <span>kgCO2e: {row.kgco2e_per_tonne ?? "-"}</span>
                    <span>
                      Dates: {row.valid_from ?? "-"} to {row.valid_to ?? "N/A"}
                    </span>
                  </div>
                </label>
              ))}
            </div>
            <div className="admin-modal-actions">
              <button className="btn-primary" type="button" onClick={handleOverwrite}>
                Overwrite selected
              </button>
              <button className="btn-secondary" type="button" onClick={() => setShowOverwriteModal(false)}>
                Keep existing
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function InstallationTab({
  installationSetups,
  actions,
}: {
  installationSetups: InstallationSetup[];
  actions: Actions;
}) {
  const milesToKm = 1.60934;
  const [uploadState, uploadAction] = useActionState(actions.uploadInstallationSetups, {});
  const [createInstallState, createInstallAction] = useActionState(
    actions.createInstallationSetup,
    {}
  );
  const [bulkState, bulkAction] = useActionState(
    actions.updateInstallationSetupsBulk,
    {}
  );
  const [isBulkPending, startBulkTransition] = useTransition();
  const [deleteState, deleteAction] = useActionState(
    async (_prev, formData) => actions.deleteInstallationSetup(formData),
    {}
  );
  const [filter, setFilter] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const values = installationSetups.map((row) => row.category ?? "Uncategorized");
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [installationSetups]);

  const filtered = useMemo(() => {
    if (!filter) return installationSetups;
    return installationSetups.filter(
      (row) => (row.category ?? "Uncategorized") === filter
    );
  }, [filter, installationSetups]);

  const handleBulkSave = () => {
    const container = tableRef.current;
    if (!container) return;
    const payload = filtered
      .map((row) => {
        const form = container.querySelector(
          `form[data-install-id="${row.id}"]`
        ) as HTMLFormElement | null;
        if (!form) return null;
        const getInput = (name: string) =>
          form.querySelector(`[name="${name}"]`) as HTMLInputElement | null;
        return {
          id: row.id,
          category: getInput("category")?.value ?? "",
          plant_name: getInput("plant_name")?.value ?? "",
          spread_rate_t_per_m2: getInput("spread_rate_t_per_m2")?.value ?? "",
          kgco2_per_t: getInput("kgco2_per_t")?.value ?? "",
          kgco2_per_ltr: getInput("kgco2_per_ltr")?.value ?? "",
          kgco2e: getInput("kgco2e")?.value ?? "",
          kgco2e_per_km: getInput("kgco2e_per_km")?.value ?? "",
          kgco2e_unit: getInput("kgco2e_unit")?.value ?? "km",
          litres_per_t: getInput("litres_per_t")?.value ?? "",
          is_default: Boolean(getInput("is_default")?.checked),
        };
      })
      .filter(Boolean);

    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    startBulkTransition(() => bulkAction(formData));
  };

  return (
    <section className="scheme-card">
      <div className="scheme-card-header admin-header-row">
        <div>
          <h2>Installation setup</h2>
          <p className="scheme-card-subtitle">
            Manage installation setup factors for A5 calculations.
          </p>
          <select
            className="scheme-filter admin-header-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-header-actions">
          <form action={uploadAction} className="admin-upload">
            <input name="file" type="file" accept=".csv" />
            <a
              className="btn-secondary"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                "plant_name,category,spread_rate_t_per_m2,kgco2_per_t,kgco2_per_ltr,kgco2e,kgco2e_per_km,kgco2e_unit,litres_per_t,is_default\nExample Plant,Plant,0.03,5.2,0.45,4.2,0.9,km,12.5,false"
              )}`}
              download="installation-setups-template.csv"
            >
              Template
            </a>
            <button className="btn-primary" type="submit">
              Upload
            </button>
          </form>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleBulkSave}
            disabled={isBulkPending || filtered.length === 0}
          >
            Save all changes
          </button>
        </div>
      </div>
      {uploadState?.error ? (
        <p className="create-scheme-message error">{uploadState.error}</p>
      ) : null}
      {uploadState?.success ? (
        <p className="create-scheme-message success">
          Uploaded {uploadState.count ?? 0} rows.
        </p>
      ) : null}
      {deleteState?.error ? (
        <p className="create-scheme-message error">{deleteState.error}</p>
      ) : null}
      {deleteState?.success ? (
        <p className="create-scheme-message success">Row deleted.</p>
      ) : null}
      {bulkState?.error ? (
        <p className="create-scheme-message error">{bulkState.error}</p>
      ) : null}
      {bulkState?.success ? (
        <p className="create-scheme-message success">Changes saved.</p>
      ) : null}

        <div className="admin-grid-head admin-install-grid admin-grid-labels admin-install-headers">
          <span>Category</span>
          <span>Name</span>
          <span>Spread rate (t/m2)</span>
          <span>kgCO2 / t</span>
          <span>kgCO2 / ltr</span>
          <span>kgCO2e</span>
          <span>kgCO2e / (km/mi)</span>
          <span>Litres / t</span>
          <span>Default</span>
          <span>Action</span>
        </div>

      <datalist id="installation-categories">
        <option value="Plant" />
        <option value="Material" />
        <option value="Transport" />
        <option value="Fuel" />
      </datalist>

      <div className="admin-table-scroll installation-scroll" ref={tableRef}>
        <table className="scheme-table admin-table">
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td colSpan={10}>
                  <form
                    action={actions.updateInstallationSetup}
                    className="admin-row-form admin-install-grid"
                    data-install-id={row.id}
                  >
                    <input type="hidden" name="id" value={row.id} />
                    <input
                      name="category"
                      list="installation-categories"
                      defaultValue={row.category ?? ""}
                      placeholder="Plant / Material / Transport"
                    />
                    <div className="admin-row-with-delete">
                      <button
                        className="delete-button"
                        type="submit"
                        formAction={deleteAction}
                        title="Delete row"
                      >
                        X
                      </button>
                      <input name="plant_name" defaultValue={row.plant_name} />
                    </div>
                    <input
                      name="spread_rate_t_per_m2"
                      type="number"
                      step="0.0001"
                      defaultValue={row.spread_rate_t_per_m2 ?? ""}
                    />
                    <input
                      name="kgco2_per_t"
                      type="number"
                      step="0.0001"
                      defaultValue={row.kgco2_per_t ?? ""}
                    />
                    <input
                      name="kgco2_per_ltr"
                      type="number"
                      step="0.0001"
                      defaultValue={row.kgco2_per_ltr ?? ""}
                    />
                    <input
                      name="kgco2e"
                      type="number"
                      step="0.0001"
                      defaultValue={row.kgco2e ?? ""}
                    />
                    <div className="admin-inline-field">
                      <input
                        name="kgco2e_per_km"
                        type="number"
                        step="0.0001"
                        defaultValue={
                          row.kgco2e_per_km === null
                            ? ""
                            : (row.kgco2e_unit ?? "km").toLowerCase() === "mi"
                              ? (row.kgco2e_per_km * milesToKm).toFixed(4)
                              : row.kgco2e_per_km.toFixed(4)
                        }
                      />
                      <select
                        name="kgco2e_unit"
                        defaultValue={(row.kgco2e_unit ?? "km").toLowerCase()}
                        className="admin-unit-select"
                      >
                        <option value="km">/ km</option>
                        <option value="mi">/ mi</option>
                      </select>
                    </div>
                    <input
                      name="litres_per_t"
                      type="number"
                      step="0.0001"
                      defaultValue={row.litres_per_t ?? ""}
                    />
                    <label className="admin-inline-checkbox">
                      <input
                        type="checkbox"
                        name="is_default"
                        defaultChecked={row.is_default ?? false}
                      />
                      Default
                    </label>
                    <button className="btn-secondary" type="submit">
                      Update
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={createInstallAction} className="admin-create">
        <h3 className="display-text">Add installation setup</h3>
        <div className="admin-form-row admin-install-grid">
          <input
            name="category"
            list="installation-categories"
            placeholder="Category"
          />
          <input name="plant_name" placeholder="Name" />
          <input
            name="spread_rate_t_per_m2"
            type="number"
            step="0.0001"
            placeholder="Spread rate (t/m2)"
          />
          <input
            name="kgco2_per_t"
            type="number"
            step="0.0001"
            placeholder="kgCO2 / t"
          />
          <input
            name="kgco2_per_ltr"
            type="number"
            step="0.0001"
            placeholder="kgCO2 / ltr"
          />
          <input
            name="kgco2e"
            type="number"
            step="0.0001"
            placeholder="kgCO2e"
          />
          <div className="admin-inline-field">
            <input
              name="kgco2e_per_km"
              type="number"
              step="0.0001"
              placeholder="kgCO2e"
            />
            <select name="kgco2e_unit" defaultValue="km" className="admin-unit-select">
              <option value="km">/ km</option>
              <option value="mi">/ mi</option>
            </select>
          </div>
          <input
            name="litres_per_t"
            type="number"
            step="0.0001"
            placeholder="Litres / t"
          />
          <label className="admin-inline-checkbox">
            <input type="checkbox" name="is_default" />
            Default
          </label>
          <button className="btn-primary" type="submit">
            Add
          </button>
        </div>
        {createInstallState?.error ? (
          <p className="create-scheme-message error">{createInstallState.error}</p>
        ) : null}
        {createInstallState?.success ? (
          <p className="create-scheme-message success">Installation setup added.</p>
        ) : null}
      </form>
    </section>
  );
}

function ConversionFactorsTab({
  categories,
  filters,
  actions,
}: {
  categories: GhgCategory[];
  filters: GhgFactorFilter[];
  actions: Actions;
}) {
  const [query, setQuery] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [detailsActiveOnly, setDetailsActiveOnly] = useState(false);
  const [levelDropdown, setLevelDropdown] = useState<
    null | "level1" | "level2" | "level3" | "uom" | "ghgUnit"
  >(null);
  const [selectedLevels, setSelectedLevels] = useState({
    level1: [] as string[],
    level2: [] as string[],
    level3: [] as string[],
    uom: [] as string[],
    ghgUnit: [] as string[],
  });
  const [columnFilters, setColumnFilters] = useState({
    level1: "",
    level2: "",
  });

  const levelOptions = useMemo(() => {
    if (!selectedCategory)
      return {
        level1: [],
        level2: [],
        level3: [],
        uom: [] as string[],
        ghgUnit: [] as string[],
      };

    const scoped = filters.filter((filter) => filter.category_key === selectedCategory);
    const uniqueSorted = (values: Array<string | null>) =>
      Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b)
      );

    const matchesSelections = (
      row: GhgFactorFilter,
      selections: { level1?: string[]; level2?: string[]; level3?: string[]; uom?: string[]; ghgUnit?: string[] }
    ) => {
      const inList = (value: string | null, list?: string[]) =>
        !list || list.length === 0 || (value ? list.includes(value) : false);
      return (
        inList(row.level1, selections.level1) &&
        inList(row.level2, selections.level2) &&
        inList(row.level3, selections.level3) &&
        inList(row.unit, selections.uom) &&
        inList(row.ghg_unit, selections.ghgUnit)
      );
    };

    const optionsFor = (key: keyof GhgFactorFilter, selections: Parameters<typeof matchesSelections>[1]) =>
      uniqueSorted(scoped.filter((row) => matchesSelections(row, selections)).map((row) => row[key] as string | null));

    return {
      level1: optionsFor("level1", {
        level2: selectedLevels.level2,
        level3: selectedLevels.level3,
        uom: selectedLevels.uom,
        ghgUnit: selectedLevels.ghgUnit,
      }),
      level2: optionsFor("level2", {
        level1: selectedLevels.level1,
        level3: selectedLevels.level3,
        uom: selectedLevels.uom,
        ghgUnit: selectedLevels.ghgUnit,
      }),
      level3: optionsFor("level3", {
        level1: selectedLevels.level1,
        level2: selectedLevels.level2,
        uom: selectedLevels.uom,
        ghgUnit: selectedLevels.ghgUnit,
      }),
      uom: optionsFor("unit", {
        level1: selectedLevels.level1,
        level2: selectedLevels.level2,
        level3: selectedLevels.level3,
        ghgUnit: selectedLevels.ghgUnit,
      }),
      ghgUnit: optionsFor("ghg_unit", {
        level1: selectedLevels.level1,
        level2: selectedLevels.level2,
        level3: selectedLevels.level3,
        uom: selectedLevels.uom,
      }),
    };
  }, [filters, selectedCategory, selectedLevels]);

  useEffect(() => {
    if (!selectedCategory) return;
    const prune = (current: string[], allowed: string[]) =>
      current.filter((value) => allowed.includes(value));
    setSelectedLevels((prev) => {
      const next = {
        level1: prune(prev.level1, levelOptions.level1),
        level2: prune(prev.level2, levelOptions.level2),
        level3: prune(prev.level3, levelOptions.level3),
        uom: prune(prev.uom, levelOptions.uom),
        ghgUnit: prune(prev.ghgUnit, levelOptions.ghgUnit),
      };
      const isSame =
        next.level1.length === prev.level1.length &&
        next.level2.length === prev.level2.length &&
        next.level3.length === prev.level3.length &&
        next.uom.length === prev.uom.length &&
        next.ghgUnit.length === prev.ghgUnit.length;
      if (isSame) return prev;
      return next;
    });
  }, [selectedCategory, levelOptions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories.filter((category) => {
      if (showActiveOnly && !category.is_active) return false;
      if (!q) return true;
      return (
        category.key.toLowerCase().includes(q) ||
        category.label.toLowerCase().includes(q) ||
        (category.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [categories, query, showActiveOnly]);

  const categoryFilters = useMemo(() => {
    if (!selectedCategory) return [];
    const q = "";
    const matchesColumn = (value: string | null, filterValue: string) => {
      const term = filterValue.trim().toLowerCase();
      if (!term) return true;
      return (value ?? "").toLowerCase().includes(term);
    };
    return filters.filter((filter) => {
      if (filter.category_key !== selectedCategory) return false;
      if (detailsActiveOnly && !filter.is_active) return false;
      if (!q) return true;
      return (
        (filter.level1 ?? "").toLowerCase().includes(q) ||
        (filter.level2 ?? "").toLowerCase().includes(q) ||
        (filter.level3 ?? "").toLowerCase().includes(q) ||
        (filter.level4 ?? "").toLowerCase().includes(q) ||
        (filter.column_text ?? "").toLowerCase().includes(q) ||
        (filter.unit ?? "").toLowerCase().includes(q) ||
        (filter.ghg_unit ?? "").toLowerCase().includes(q)
      );
    }).filter((filter) => {
      const level1Ok =
        selectedLevels.level1.length === 0 ||
        (filter.level1 ? selectedLevels.level1.includes(filter.level1) : false);
      const level2Ok =
        selectedLevels.level2.length === 0 ||
        (filter.level2 ? selectedLevels.level2.includes(filter.level2) : false);
      const level3Ok =
        selectedLevels.level3.length === 0 ||
        (filter.level3 ? selectedLevels.level3.includes(filter.level3) : false);
      const uomOk =
        selectedLevels.uom.length === 0 ||
        (filter.unit ? selectedLevels.uom.includes(filter.unit) : false);
      const ghgUnitOk =
        selectedLevels.ghgUnit.length === 0 ||
        (filter.ghg_unit ? selectedLevels.ghgUnit.includes(filter.ghg_unit) : false);
      return (
        level1Ok &&
        level2Ok &&
        level3Ok &&
        uomOk &&
        ghgUnitOk &&
        matchesColumn(filter.level1, columnFilters.level1) &&
        matchesColumn(filter.level2, columnFilters.level2)
      );
    });
  }, [
    filters,
    selectedCategory,
    detailsActiveOnly,
    columnFilters,
    selectedLevels.level1,
    selectedLevels.level2,
    selectedLevels.level3,
    selectedLevels.uom,
    selectedLevels.ghgUnit,
  ]);

  return (
    <section className="scheme-card">
      <h2>Carbon Catalogue</h2>
      <p className="schemes-subtitle">
        Toggle the categories you want to include in the portal.
      </p>

      <div className="admin-ghg-toolbar">
        <input
          type="search"
          placeholder="Search categories"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <label className="admin-inline-checkbox">
          <input
            type="checkbox"
            checked={showActiveOnly}
            onChange={(event) => setShowActiveOnly(event.target.checked)}
          />
          Show active only
        </label>
      </div>

      <div className="admin-ghg-grid">
        {filtered.map((category) => {
          const isSelected = selectedCategory === category.key;
          return (
            <div key={category.key} className="admin-ghg-card">
              <div
                className={`admin-ghg-row admin-ghg-clickable ${
                  isSelected ? "is-open" : ""
                }`}
                role="button"
                tabIndex={0}
                onClick={() =>
                  setSelectedCategory(isSelected ? null : category.key)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedCategory(isSelected ? null : category.key);
                  }
                }}
              >
                <div className="admin-ghg-meta">
                  <span
                    className="admin-ghg-dot"
                    style={{ background: category.color ?? "#67c5ff" }}
                  />
                  <div>
                    <strong>{category.label}</strong>
                    {category.description ? (
                      <span>{category.description}</span>
                    ) : null}
                  </div>
                </div>
                <form
                  action={actions.updateGhgCategory}
                  className="admin-ghg-actions"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input type="hidden" name="key" value={category.key} />
                  <input
                    type="hidden"
                    name="is_active"
                    value={category.is_active ? "off" : "on"}
                  />
                  <button
                    className={`btn-toggle ${category.is_active ? "on" : "off"}`}
                    type="submit"
                  >
                    {category.is_active ? "Enabled" : "Disabled"}
                  </button>
                </form>
              </div>

              {isSelected ? (
                <div className="admin-ghg-details">
                  <div className="admin-ghg-details-header">
                    <h3>Levels 1-4</h3>
                    <div className="admin-ghg-toolbar">
                      <label className="admin-inline-checkbox">
                        <input
                          type="checkbox"
                          checked={detailsActiveOnly}
                          onChange={(event) =>
                            setDetailsActiveOnly(event.target.checked)
                          }
                        />
                        Show active only
                      </label>
                      <div className="admin-ghg-bulk">
                        <form action={actions.setGhgFactorFiltersActive}>
                          <input
                            type="hidden"
                            name="category_key"
                            value={category.key}
                          />
                          <input type="hidden" name="value" value="on" />
                          <button className="btn-secondary" type="submit">
                            Enable all
                          </button>
                        </form>
                        <form action={actions.setGhgFactorFiltersActive}>
                          <input
                            type="hidden"
                            name="category_key"
                            value={category.key}
                          />
                          <input type="hidden" name="value" value="off" />
                          <button className="btn-secondary" type="submit">
                            Disable all
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                  <div className="admin-ghg-details-table">
                    <div className="admin-ghg-details-row admin-ghg-details-header-row">
                      <span>Level 1</span>
                      <span>Level 2</span>
                      <span>Level 3</span>
                      <span>Level 4</span>
                      <span>Column text</span>
                      <span>UOM</span>
                      <span>GHG / Unit</span>
                      <span>Factor 2025</span>
                      <span>Status</span>
                      <span>Action</span>
                    </div>
                    <div className="admin-ghg-details-row admin-ghg-details-filter-row">
                      <div className="admin-filter-select">
                        <button
                          type="button"
                          className="admin-filter-trigger"
                          onClick={() =>
                            setLevelDropdown((current) =>
                              current === "level1" ? null : "level1"
                            )
                          }
                        >
                          {selectedLevels.level1.length
                            ? `${selectedLevels.level1.length} selected`
                            : "All Level 1"}
                        </button>
                        {levelDropdown === "level1" ? (
                          <div className="admin-filter-menu">
                            {levelOptions.level1.map((option) => (
                              <label key={option} className="admin-filter-option">
                                <input
                                  type="checkbox"
                                  checked={selectedLevels.level1.includes(option)}
                                  onChange={(event) => {
                                    setSelectedLevels((prev) => {
                                      const next = new Set(prev.level1);
                                      if (event.target.checked) {
                                        next.add(option);
                                      } else {
                                        next.delete(option);
                                      }
                                      return { ...prev, level1: Array.from(next) };
                                    });
                                  }}
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="admin-filter-select">
                        <button
                          type="button"
                          className="admin-filter-trigger"
                          onClick={() =>
                            setLevelDropdown((current) =>
                              current === "level2" ? null : "level2"
                            )
                          }
                        >
                          {selectedLevels.level2.length
                            ? `${selectedLevels.level2.length} selected`
                            : "All Level 2"}
                        </button>
                        {levelDropdown === "level2" ? (
                          <div className="admin-filter-menu">
                            {levelOptions.level2.map((option) => (
                              <label key={option} className="admin-filter-option">
                                <input
                                  type="checkbox"
                                  checked={selectedLevels.level2.includes(option)}
                                  onChange={(event) => {
                                    setSelectedLevels((prev) => {
                                      const next = new Set(prev.level2);
                                      if (event.target.checked) {
                                        next.add(option);
                                      } else {
                                        next.delete(option);
                                      }
                                      return { ...prev, level2: Array.from(next) };
                                    });
                                  }}
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="admin-filter-select">
                        <button
                          type="button"
                          className="admin-filter-trigger"
                          onClick={() =>
                            setLevelDropdown((current) =>
                              current === "level3" ? null : "level3"
                            )
                          }
                        >
                          {selectedLevels.level3.length
                            ? `${selectedLevels.level3.length} selected`
                            : "All Level 3"}
                        </button>
                        {levelDropdown === "level3" ? (
                          <div className="admin-filter-menu">
                            {levelOptions.level3.map((option) => (
                              <label key={option} className="admin-filter-option">
                                <input
                                  type="checkbox"
                                  checked={selectedLevels.level3.includes(option)}
                                  onChange={(event) => {
                                    setSelectedLevels((prev) => {
                                      const next = new Set(prev.level3);
                                      if (event.target.checked) {
                                        next.add(option);
                                      } else {
                                        next.delete(option);
                                      }
                                      return { ...prev, level3: Array.from(next) };
                                    });
                                  }}
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <span />
                      <span />
                      <div className="admin-filter-select">
                        <button
                          type="button"
                          className="admin-filter-trigger"
                          onClick={() =>
                            setLevelDropdown((current) =>
                              current === "uom" ? null : "uom"
                            )
                          }
                        >
                          {selectedLevels.uom.length
                            ? `${selectedLevels.uom.length} selected`
                            : "All UOM"}
                        </button>
                        {levelDropdown === "uom" ? (
                          <div className="admin-filter-menu">
                            {levelOptions.uom.map((option) => (
                              <label key={option} className="admin-filter-option">
                                <input
                                  type="checkbox"
                                  checked={selectedLevels.uom.includes(option)}
                                  onChange={(event) => {
                                    setSelectedLevels((prev) => {
                                      const next = new Set(prev.uom);
                                      if (event.target.checked) {
                                        next.add(option);
                                      } else {
                                        next.delete(option);
                                      }
                                      return { ...prev, uom: Array.from(next) };
                                    });
                                  }}
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="admin-filter-select">
                        <button
                          type="button"
                          className="admin-filter-trigger"
                          onClick={() =>
                            setLevelDropdown((current) =>
                              current === "ghgUnit" ? null : "ghgUnit"
                            )
                          }
                        >
                          {selectedLevels.ghgUnit.length
                            ? `${selectedLevels.ghgUnit.length} selected`
                            : "All GHG/Unit"}
                        </button>
                        {levelDropdown === "ghgUnit" ? (
                          <div className="admin-filter-menu">
                            {levelOptions.ghgUnit.map((option) => (
                              <label key={option} className="admin-filter-option">
                                <input
                                  type="checkbox"
                                  checked={selectedLevels.ghgUnit.includes(option)}
                                  onChange={(event) => {
                                    setSelectedLevels((prev) => {
                                      const next = new Set(prev.ghgUnit);
                                      if (event.target.checked) {
                                        next.add(option);
                                      } else {
                                        next.delete(option);
                                      }
                                      return { ...prev, ghgUnit: Array.from(next) };
                                    });
                                  }}
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <span />
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => {
                          setColumnFilters({
                            level1: "",
                            level2: "",
                          });
                          setSelectedLevels({
                            level1: [],
                            level2: [],
                            level3: [],
                            uom: [],
                            ghgUnit: [],
                          });
                          setLevelDropdown(null);
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="admin-ghg-details-scroll">
                    {categoryFilters.map((filter) => (
                      <form
                        key={filter.id}
                        action={actions.updateGhgFactorFilter}
                        className="admin-ghg-details-row"
                      >
                        <input type="hidden" name="id" value={filter.id} />
                        <input
                          type="hidden"
                          name="is_active"
                          value={filter.is_active ? "off" : "on"}
                        />
                        <span>{filter.level1 ?? "-"}</span>
                        <span>{filter.level2 ?? "-"}</span>
                        <span>{filter.level3 ?? "-"}</span>
                        <span>{filter.level4 ?? "-"}</span>
                        <span>{filter.column_text ?? "-"}</span>
                        <span>{filter.unit ?? "-"}</span>
                        <span>{filter.ghg_unit ?? "-"}</span>
                        <span>
                          {filter.factor !== null && filter.factor !== undefined
                            ? Number(filter.factor).toFixed(6)
                            : "-"}
                        </span>
                        <span
                          className={`admin-ghg-status ${
                            filter.is_active ? "on" : "off"
                          }`}
                        >
                          {filter.is_active ? "Enabled" : "Disabled"}
                        </span>
                        <button
                          className={`btn-toggle ${filter.is_active ? "on" : "off"}`}
                          type="submit"
                        >
                          {filter.is_active ? "Disable" : "Enable"}
                        </button>
                      </form>
                    ))}
                    {categoryFilters.length === 0 ? (
                      <p className="create-scheme-message">
                        No matching level filters yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {filtered.length === 0 ? (
          <p className="create-scheme-message">No categories loaded yet.</p>
        ) : null}
      </div>
    </section>
  );
}

function ReportsTab({
  reportMetrics,
  actions,
}: {
  reportMetrics: ReportMetric[];
  actions: Actions;
}) {
  const [createEquivState, createEquivAction] = useActionState(actions.createReportMetric, {});
  const [createSavingsState, createSavingsAction] = useActionState(actions.createReportMetric, {});
  const [uploadReportsState, uploadReportsAction] = useActionState(
    actions.uploadReportMetrics,
    {}
  );

  const equivalencies = reportMetrics.filter((metric) => metric.kind === "equivalency");
  const savings = reportMetrics.filter((metric) => metric.kind === "savings");
  const unitOptions = ["g", "kg", "tonnes", "m3", "ha", "ac", "trees"];
  const applyCalc = (
    base: number | null,
    op: string | null | undefined,
    factor: number | null | undefined
  ) => {
    if (base === null || base === undefined || Number.isNaN(base)) return null;
    if (factor === null || factor === undefined || Number.isNaN(factor)) return base;
    switch ((op ?? "").toLowerCase()) {
      case "+":
        return base + factor;
      case "-":
        return base - factor;
      case "x":
      case "*":
        return base * factor;
      case "/":
        return factor === 0 ? null : base / factor;
      default:
        return base;
    }
  };

  const formatCo2PerT = (
    value: number | null,
    unit: string | null,
    op?: string | null,
    factor?: number | null
  ) => {
    if (value === null || value === undefined || Number.isNaN(value)) return "-";
    const normalized = (unit ?? "").toLowerCase();
    let tonnesValue = value;
    if (normalized === "g") tonnesValue = value / 1_000_000;
    else if (normalized === "kg") tonnesValue = value / 1000;
    else if (normalized === "tonnes") tonnesValue = value;
    const computed = applyCalc(tonnesValue, op, factor);
    return computed === null || Number.isNaN(computed) ? "-" : computed.toFixed(6);
  };

  return (
    <section className="scheme-card">
      <div className="scheme-card-header admin-header-row">
        <div>
          <h2>Reports</h2>
          <p className="scheme-card-subtitle">
            Manage CO2 equivalency parameters and savings metrics.
          </p>
        </div>
        <div className="admin-header-actions">
          <a className="btn-secondary" href="/reports/co2-savings">
            View CO2 savings
          </a>
          <form action={uploadReportsAction} className="admin-upload">
            <input name="file" type="file" accept=".csv" />
            <a
              className="btn-secondary"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                "kind,label,unit,value,calc_op,calc_factor,source,source_url,sort_order,is_active\n" +
                  "equivalency,Return Flight to Sydney,flight,1.5779,x,1,ICAO,https://www.icao.int,10,true\n" +
                  "savings,Vehicle mileage savings WMA,miles,2181,,,https://example.com,10,true"
              )}`}
              download="report-metrics-template.csv"
            >
              Template
            </a>
            <button className="btn-primary" type="submit">
              Upload
            </button>
          </form>
        </div>
      </div>
      {uploadReportsState?.error ? (
        <p className="create-scheme-message error">{uploadReportsState.error}</p>
      ) : null}
      {uploadReportsState?.success ? (
        <p className="create-scheme-message success">
          {uploadReportsState.message ??
            `Uploaded ${uploadReportsState.count ?? 0} rows.`}
        </p>
      ) : null}

      <div className="admin-report-section">
        <div className="admin-header-row">
          <h3>Equivalency parameters</h3>
        </div>
        <div className="admin-report-table">
          <div className="admin-report-header admin-report-grid admin-report-grid-equivalency">
            <span />
            <span>Description</span>
            <span>CO2 value</span>
            <span>Unit</span>
            <span>Op</span>
            <span>Factor</span>
            <span>CO2 / t</span>
            <span>Source</span>
            <span>URL</span>
            <span>Active</span>
            <span>Action</span>
          </div>
          {equivalencies.map((metric) => (
            <form
              key={metric.id}
              action={actions.updateReportMetric}
              className="admin-row-form admin-report-grid admin-report-grid-equivalency"
            >
              <input type="hidden" name="id" value={metric.id} />
              <input type="hidden" name="kind" value={metric.kind} />
              <button
                className="delete-button"
                type="submit"
                formAction={actions.deleteReportMetric}
                title="Delete row"
              >
                X
              </button>
              <input name="label" defaultValue={metric.label} />
              <input
                name="value"
                type="number"
                step="0.0001"
                defaultValue={metric.value ?? ""}
              />
              <select name="unit" defaultValue={metric.unit ?? ""}>
                <option value="">Select</option>
                {unitOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select name="calc_op" defaultValue={metric.calc_op ?? ""}>
                <option value="">None</option>
                <option value="+">+</option>
                <option value="-">-</option>
                <option value="x">x</option>
                <option value="/">/</option>
              </select>
              <input
                name="calc_factor"
                type="number"
                step="0.0001"
                defaultValue={metric.calc_factor ?? ""}
              />
              <span className="admin-report-readonly">
                {formatCo2PerT(
                  metric.value,
                  metric.unit,
                  metric.calc_op ?? null,
                  metric.calc_factor ?? null
                )}
              </span>
              <input name="source" defaultValue={metric.source ?? ""} />
              <input name="source_url" defaultValue={metric.source_url ?? ""} />
              <input type="hidden" name="sort_order" value={metric.sort_order ?? 0} />
              <label className="admin-inline-checkbox">
                <input type="checkbox" name="is_active" defaultChecked={metric.is_active} />
                Active
              </label>
              <button className="btn-secondary" type="submit">
                Update
              </button>
            </form>
          ))}
          <form action={createEquivAction} className="admin-row-form admin-report-grid admin-report-grid-equivalency">
            <input type="hidden" name="kind" value="equivalency" />
            <span />
            <input name="label" placeholder="Description" />
            <input name="value" type="number" step="0.0001" placeholder="CO2 value" />
            <select name="unit" defaultValue="">
              <option value="">Select unit</option>
              {unitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select name="calc_op" defaultValue="">
              <option value="">None</option>
              <option value="+">+</option>
              <option value="-">-</option>
              <option value="x">x</option>
              <option value="/">/</option>
            </select>
            <input name="calc_factor" type="number" step="0.0001" placeholder="Factor" />
            <span className="admin-report-readonly">-</span>
            <input name="source" placeholder="Source (e.g. DEFRA 2025)" />
            <input name="source_url" placeholder="URL" />
            <input type="hidden" name="sort_order" value="0" />
            <label className="admin-inline-checkbox">
              <input type="checkbox" name="is_active" defaultChecked />
              Active
            </label>
            <button className="btn-primary" type="submit">
              Add
            </button>
          </form>
        </div>
        {createEquivState?.error ? (
          <p className="create-scheme-message error">{createEquivState.error}</p>
        ) : null}
        {createEquivState?.success ? (
          <p className="create-scheme-message success">Equivalency added.</p>
        ) : null}
      </div>

      {/* CO2 savings metrics section removed by request. */}
    </section>
  );
}

function UserAccessTab({ actions }: { actions: Actions }) {
  const [inviteState, inviteAction] = useActionState(actions.inviteUser, {});

  return (
    <section className="scheme-card">
      <div className="scheme-card-header">
        <h2>User access</h2>
        <p className="scheme-card-subtitle">
          Invite new users by email. They will receive a link to set a password.
        </p>
      </div>
      <form action={inviteAction} className="admin-create">
        <div className="admin-form-row">
          <input name="email" type="email" placeholder="user@company.com" />
          <button className="btn-primary" type="submit">
            Send invite
          </button>
        </div>
        {inviteState?.error ? (
          <p className="create-scheme-message error">{inviteState.error}</p>
        ) : null}
        {inviteState?.success ? (
          <p className="create-scheme-message success">
            {inviteState.message ?? "Invitation sent."}
          </p>
        ) : null}
      </form>
    </section>
  );
}
