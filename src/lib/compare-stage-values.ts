type LifecycleStageLike = {
  stage: string;
  description: string;
  total_kgco2e: number | null;
  kgco2e_per_tonne: number | null;
};

type CompareStageValueItem = {
  lifecycle: LifecycleStageLike[];
  a1Factor?: number | null;
  deliveredTonnage?: number | null;
};

const toFiniteNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const sumValues = (values: Array<number | null>) => {
  let total = 0;
  let hasValue = false;

  values.forEach((value) => {
    if (value === null) return;
    total += value;
    hasValue = true;
  });

  return hasValue ? total : null;
};

const getLifecycleStage = (item: CompareStageValueItem, stageKey: string) =>
  item.lifecycle.find((row) => row.stage === stageKey) ?? null;

const getDeliveredStagePerTonne = (
  item: CompareStageValueItem,
  stageKey: string
) => {
  const deliveredTonnage = toFiniteNumber(item.deliveredTonnage);
  const totalKg = toFiniteNumber(getLifecycleStage(item, stageKey)?.total_kgco2e);
  if (deliveredTonnage === null || deliveredTonnage <= 0 || totalKg === null) {
    return null;
  }
  return totalKg / deliveredTonnage;
};

export const getStagePerTonneValue = (
  item: CompareStageValueItem,
  stageKey: string
): number | null => {
  if (stageKey === "A1") {
    return toFiniteNumber(item.a1Factor);
  }

  if (stageKey === "A1-A3") {
    return sumValues([
      getStagePerTonneValue(item, "A2"),
      getStagePerTonneValue(item, "A3"),
    ]);
  }

  if (stageKey === "A1-A5") {
    return sumValues([
      getStagePerTonneValue(item, "A2"),
      getStagePerTonneValue(item, "A3"),
      getStagePerTonneValue(item, "A4"),
      getStagePerTonneValue(item, "A5"),
    ]);
  }

  if (stageKey === "A2" || stageKey === "A3") {
    return (
      getDeliveredStagePerTonne(item, stageKey) ??
      toFiniteNumber(getLifecycleStage(item, stageKey)?.kgco2e_per_tonne)
    );
  }

  return toFiniteNumber(getLifecycleStage(item, stageKey)?.kgco2e_per_tonne);
};

export const getStageTotalKgValue = (
  item: CompareStageValueItem,
  stageKey: string
): number | null => {
  if (stageKey === "A1") {
    const a1Factor = toFiniteNumber(item.a1Factor);
    const deliveredTonnage = toFiniteNumber(item.deliveredTonnage);
    if (a1Factor === null || deliveredTonnage === null) return null;
    return a1Factor * deliveredTonnage;
  }

  if (stageKey === "A1-A3") {
    return sumValues([
      getStageTotalKgValue(item, "A2"),
      getStageTotalKgValue(item, "A3"),
    ]);
  }

  if (stageKey === "A1-A5") {
    return sumValues([
      getStageTotalKgValue(item, "A2"),
      getStageTotalKgValue(item, "A3"),
      getStageTotalKgValue(item, "A4"),
      getStageTotalKgValue(item, "A5"),
    ]);
  }

  return toFiniteNumber(getLifecycleStage(item, stageKey)?.total_kgco2e);
};

export const getStageTotalTonnes = (
  item: CompareStageValueItem,
  stageKey: string
): number | null => {
  const totalKg = getStageTotalKgValue(item, stageKey);
  return totalKg === null ? null : totalKg / 1000;
};

export const getComparisonCardStageRows = (item: CompareStageValueItem) => {
  const a4 = getLifecycleStage(item, "A4");
  const a5 = getLifecycleStage(item, "A5");

  return [
    {
      stage: "A1-A3",
      description: "Raw materials, transport and manufacturing",
      total: getStageTotalKgValue(item, "A1-A3"),
      perTonne: getStagePerTonneValue(item, "A1-A3"),
    },
    {
      stage: "A4",
      description: a4?.description ?? "Transport to site",
      total: toFiniteNumber(a4?.total_kgco2e),
      perTonne: toFiniteNumber(a4?.kgco2e_per_tonne),
    },
    {
      stage: "A5",
      description: a5?.description ?? "Installation",
      total: toFiniteNumber(a5?.total_kgco2e),
      perTonne: toFiniteNumber(a5?.kgco2e_per_tonne),
    },
  ];
};

export type { CompareStageValueItem };
