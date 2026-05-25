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
 * Builds a `useCrudPage` `validate` function that rejects a payload duplicating
 * an existing record. `buildSignature` is one of the helpers above; `message`
 * is returned when a *different* record with the same signature already exists.
 * Returns '' (no error) for an empty signature or when no duplicate is found.
 * The same record (matched by id against `context.selectedItem`) never counts
 * as its own duplicate, so editing without changing identity is allowed.
 * Shared by the Opportunity and Content CRUD pages.
 */
export function makeDuplicateValidator(buildSignature, message) {
  return function validateNoDuplicate(payload, context = {}) {
    const nextSignature = buildSignature(payload);
    if (!nextSignature) {
      return '';
    }

    const { items = [], selectedItem = null } = context;
    const hasDuplicate = items.some((item) => {
      if (selectedItem?.id && String(item.id) === String(selectedItem.id)) {
        return false;
      }
      return buildSignature(item) === nextSignature;
    });

    return hasDuplicate ? message : '';
  };
}
