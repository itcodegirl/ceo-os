/** Builds a Notebook URL; pages are addressed by query so page titles/meta stay on /notebook. */
export function notebookHref(sectionId, params = {}) {
  const search = new URLSearchParams({ section: sectionId, ...params });
  return `/notebook?${search.toString()}`;
}

/**
 * The link to one page. Personal pages are addressed by date, which stays
 * valid if the page is merged with the same day from another device.
 */
export function notebookPageHref(page) {
  return page.section === 'personal'
    ? notebookHref(page.section, { date: page.pageDate })
    : notebookHref(page.section, { page: page.id });
}
