"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
};

type Plant = {
  id: string;
  name: string;
};

type MixType = {
  id: string;
  name: string;
};

type TransportMode = {
  id: string;
  name: string;
};

type PlantMixOption = {
  plant_id: string;
  product_id: string | null;
  mix_type_id: string | null;
};

type SchemeMaterialFormProps = {
  schemeId: string;
  action: (formData: FormData) => void;
  products: Product[];
  plants: Plant[];
  mixTypes: MixType[];
  transportModes: TransportMode[];
  plantMixOptions: PlantMixOption[];
  defaultPlantId?: string | null;
  defaultProductId?: string | null;
  defaultMixTypeId?: string | null;
  defaultTransportModeId?: string | null;
  hasSitePostcode: boolean;
  distanceLabel: string;
};

export function SchemeMaterialForm({
  schemeId,
  action,
  products,
  plants,
  mixTypes,
  transportModes,
  plantMixOptions,
  defaultPlantId,
  defaultProductId,
  defaultMixTypeId,
  defaultTransportModeId,
  hasSitePostcode,
  distanceLabel,
}: SchemeMaterialFormProps) {
  const [plantId, setPlantId] = useState(defaultPlantId ?? "");
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const [mixTypeId, setMixTypeId] = useState(defaultMixTypeId ?? "");
  const [transportModeId, setTransportModeId] = useState(defaultTransportModeId ?? "");
  const [distanceUnit, setDistanceUnit] = useState(
    distanceLabel === "mi" ? "mi" : "km"
  );

  useEffect(() => {
    setDistanceUnit(distanceLabel === "mi" ? "mi" : "km");
  }, [distanceLabel]);

  const availableProductIds = useMemo(() => {
    if (!plantId) return null;
    const ids = new Set<string>();
    plantMixOptions.forEach((row) => {
      if (row.plant_id === plantId && row.product_id) {
        ids.add(row.product_id);
      }
    });
    return ids;
  }, [plantId, plantMixOptions]);

  const filteredProducts = useMemo(() => {
    if (!availableProductIds) return products;
    return products.filter((product) => availableProductIds.has(product.id));
  }, [availableProductIds, products]);

  useEffect(() => {
    if (!availableProductIds) return;
    if (productId && !availableProductIds.has(productId)) {
      setProductId("");
    }
  }, [availableProductIds, productId]);

  return (
    <form action={action} className="scheme-form">
      <label>
        Product
        <select
          name="product_id"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
        >
          <option value="">Select product</option>
          {availableProductIds && filteredProducts.length === 0 ? (
            <option value="" disabled>
              No products assigned to this plant
            </option>
          ) : null}
          {filteredProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Plant
        <select
          name="plant_id"
          value={plantId}
          onChange={(event) => setPlantId(event.target.value)}
        >
          <option value="">Select plant</option>
          {plants.map((plant) => (
            <option key={plant.id} value={plant.id}>
              {plant.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Transport mode
        <select
          name="transport_mode_id"
          value={transportModeId}
          onChange={(event) => setTransportModeId(event.target.value)}
        >
          <option value="">Select transport mode</option>
          {transportModes.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Mix type
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
      </label>

      <label>
        Tonnage (t)
        <input type="number" name="tonnage" step="0.01" min="0.01" required />
      </label>

      <label>
        Delivery type
        <select name="delivery_type" defaultValue="delivery">
          <option value="delivery">Delivery (plant to site)</option>
          <option value="return">Return (site to plant)</option>
          <option value="tip">Tip (sent to landfill)</option>
        </select>
      </label>

      {hasSitePostcode ? (
        <div className="scheme-manual-distance">
          <input
            id={`manual-distance-${schemeId}`}
            type="checkbox"
            className="scheme-manual-distance-toggle"
          />
          <label htmlFor={`manual-distance-${schemeId}`}>Enter distance manually</label>
          <div className="scheme-manual-distance-field">
            <label>
              Distance
              <div className="scheme-distance-row">
                <select
                  name="distance_unit"
                  value={distanceUnit}
                  onChange={(event) => setDistanceUnit(event.target.value)}
                >
                  <option value="km">km</option>
                  <option value="mi">mi</option>
                </select>
                <input type="number" name="distance_km" step="0.1" />
              </div>
            </label>
          </div>
          <span className="scheme-muted">
            Auto-calculated using scheme + plant postcodes.
          </span>
        </div>
      ) : (
        <label>
          Distance
          <div className="scheme-distance-row">
            <select
              name="distance_unit"
              value={distanceUnit}
              onChange={(event) => setDistanceUnit(event.target.value)}
            >
              <option value="km">km</option>
              <option value="mi">mi</option>
            </select>
            <input type="number" name="distance_km" step="0.1" />
          </div>
          <span className="scheme-muted">
            Enter a distance or add a site postcode to auto-calculate.
          </span>
        </label>
      )}

      <button className="btn-primary" type="submit">
        Add material
      </button>
    </form>
  );
}
