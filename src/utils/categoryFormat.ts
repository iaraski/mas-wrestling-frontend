export function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

export function formatWeightLabel(
  weightMin: number | null | undefined,
  weightMax: number | null | undefined,
) {
  if (weightMax == null || Number(weightMax) >= 999) {
    const min = weightMin ?? 0;
    if (!min) return 'абсолютная';
    return `${formatNumber(Math.floor(min))}+ кг`;
  }
  return `до ${formatNumber(weightMax)} кг`;
}

export function formatBirthYearRange(
  ageMin: number | null | undefined,
  ageMax: number | null | undefined,
  atDate?: string | Date | null,
) {
  if (typeof ageMin !== 'number' || typeof ageMax !== 'number') return null;
  const d = atDate ? new Date(atDate) : new Date();
  const year = Number.isFinite(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
  const from = year - ageMax;
  const to = year - ageMin;
  return `${from}-${to} г.р.`;
}

export function formatCategoryGroup(
  gender: string | null | undefined,
  ageMin: number | null | undefined,
  ageMax: number | null | undefined,
) {
  const g = String(gender || '').toLowerCase();
  const isMale = g === 'male' || g === 'm';
  const isFemale = g === 'female' || g === 'f';

  if (ageMin === 18 && ageMax === 21) return isMale ? 'Юниоры' : isFemale ? 'Юниорки' : 'Юниоры';
  if (typeof ageMax === 'number' && ageMax < 18)
    return isMale ? 'Юноши' : isFemale ? 'Девушки' : 'Юноши';
  return isMale ? 'Мужчины' : isFemale ? 'Женщины' : 'Мужчины';
}

export function formatCategoryLabel(args: {
  gender: string | null | undefined;
  ageMin: number | null | undefined;
  ageMax: number | null | undefined;
  weightMin: number | null | undefined;
  weightMax: number | null | undefined;
  atDate?: string | Date | null;
}) {
  const group = formatCategoryGroup(args.gender, args.ageMin, args.ageMax);
  const years = formatBirthYearRange(args.ageMin, args.ageMax, args.atDate);
  const weight = formatWeightLabel(args.weightMin, args.weightMax);
  if (years) return `${group} ${years}, ${weight}`;
  return `${group}, ${weight}`;
}
