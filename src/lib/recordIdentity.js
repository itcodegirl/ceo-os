export function normalizeComparableValue(value) {
  return String(value || '').trim().toLowerCase();
}

export function buildOpportunitySignature(value) {
  const normalizedName = normalizeComparableValue(
    value?.name || value?.title || value?.text || value?.summary || value?.task,
  );
  const normalizedCompany = normalizeComparableValue(value?.company || value?.organization);

  return normalizedName ? `${normalizedName}|${normalizedCompany}` : '';
}

export function buildContentSignature(value) {
  const normalizedTitle = normalizeComparableValue(
    value?.title || value?.name || value?.text || value?.summary || value?.task,
  );
  const normalizedPlatform = normalizeComparableValue(value?.platform || value?.channel);

  return normalizedTitle ? `${normalizedTitle}|${normalizedPlatform}` : '';
}

export function buildPrioritySignature(value) {
  const normalizedTitle = normalizeComparableValue(
    value?.title || value?.name || value?.text || value?.summary || value?.task,
  );

  return normalizedTitle || '';
}
