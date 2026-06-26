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

/**
 * Builds a CRUD-page `validate(payload, context)` function that rejects a
 * payload whose identity signature already exists in `context.items`. The
 * record currently being edited (`context.selectedItem`) is excluded so a
 * no-op edit never reports itself as a duplicate. Returns `''` (no error)
 * when the signature is empty or unique, and `message` when it collides.
 *
 * Centralizes the previously byte-for-byte-duplicated dedup validators in
 * `OpportunityCrudPage` and `ContentCrudPage`.
 */
export function makeDuplicateValidator(buildSignature, message) {
  return function validateForDuplicate(payload, context = {}) {
    const { items = [], selectedItem = null } = context;
    const nextSignature = buildSignature(payload);
    if (!nextSignature) {
      return '';
    }

    const hasDuplicate = items.some((item) => {
      if (selectedItem?.id && String(item.id) === String(selectedItem.id)) {
        return false;
      }

      return buildSignature(item) === nextSignature;
    });

    return hasDuplicate ? message : '';
  };
}
