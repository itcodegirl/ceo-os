/** Builds a Notebook URL; pages are addressed by query so page titles/meta stay on /notebook. */
export function notebookHref(sectionId, params = {}) {
  const search = new URLSearchParams({ section: sectionId, ...params });
  return `/notebook?${search.toString()}`;
}
