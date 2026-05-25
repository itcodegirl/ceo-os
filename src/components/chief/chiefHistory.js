export function getChiefResponseId(item, index) {
  return item?.id || `chief-output-${index}`;
}

export function countStructuredItems(structuredPayload) {
  if (!structuredPayload || typeof structuredPayload !== 'object') {
    return 0;
  }
  return ['priorities', 'opportunities', 'contentItems', 'tasks'].reduce((total, key) => {
    const value = structuredPayload[key];
    return total + (Array.isArray(value) ? value.length : 0);
  }, 0);
}
