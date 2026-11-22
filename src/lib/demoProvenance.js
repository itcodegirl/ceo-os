// A seed ID alone cannot tell us whether a person has made an example their own.
export function demoFingerprint(record) {
  return JSON.stringify(Object.fromEntries(Object.entries(record)
    .filter(([key]) => !['id', 'updatedAt', 'demoSeed'].includes(key)).sort(([a], [b]) => a.localeCompare(b))));
}
export function markDemoSeed(record) {
  return { ...record, demoSeed: demoFingerprint(record) };
}
export function isUntouchedDemo(record, seeds) {
  const seed = seeds.find((candidate) => String(candidate.id) === String(record.id));
  if (!seed) return false;
  if (record.demoSeed) return record.demoSeed === demoFingerprint(record);
  // Legacy seeds have no marker. Preserve anything edited or of uncertain origin.
  return !record.updatedAt && demoFingerprint(record) === demoFingerprint(seed);
}
export function retainAuthoredRecords(records, seeds) {
  return records.filter((record) => !isUntouchedDemo(record, seeds));
}
export function mergeDemoSeeds(records, seeds) {
  const authored = retainAuthoredRecords(records, seeds);
  const ids = new Set(authored.map((record) => String(record.id)));
  return [...authored, ...seeds.filter((seed) => !ids.has(String(seed.id))).map(markDemoSeed)];
}
