export function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

export function formatWeightLabel(weightMin: number | null | undefined, weightMax: number | null | undefined) {
  if (weightMax == null || Number(weightMax) >= 999) {
    const min = weightMin ?? 0;
    return `${formatNumber(Math.floor(min))}+`;
  }
  return `до ${formatNumber(weightMax)} кг`;
}

