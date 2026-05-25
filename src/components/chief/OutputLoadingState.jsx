// Quiet skeleton that mirrors the real `ChiefSummaryCard` + section-card
// structure while a generation is in flight. The previous "Reading your
// notes / Pulling out priorities…" step list read as AI theater — it
// implied a fake multi-stage pipeline and turned the wait into
// performance art. A skeleton that hints at the eventual layout feels
// more trustworthy and gives screen readers a single polite status
// announcement instead of a paragraph of progress copy.
export default function OutputLoadingState() {
  return (
    <section className="chief-output-panel" aria-busy="true">
      <p className="sr-only" role="status" aria-live="polite">
        Working on your action plan…
      </p>

      <div className="chief-card chief-summary-card chief-loading-state" aria-hidden="true">
        <div className="chief-summary-header">
          <div className="chief-loading-stack">
            <div className="skeleton-line skeleton-line--label" />
            <div className="skeleton-line skeleton-line--value" />
          </div>
          <div className="skeleton-line skeleton-line--meta-wide" />
        </div>
        <div className="skeleton-line skeleton-line--panel" />
      </div>

      <div className="chief-card chief-loading-state" aria-hidden="true">
        <div className="chief-loading-stack">
          <div className="skeleton-line skeleton-line--label" />
          <div className="skeleton-line skeleton-line--offset" />
          <div className="skeleton-line skeleton-line--offset" />
        </div>
      </div>

      <div className="chief-card chief-loading-state" aria-hidden="true">
        <div className="chief-loading-stack">
          <div className="skeleton-line skeleton-line--label" />
          <div className="skeleton-line skeleton-line--offset" />
        </div>
      </div>
    </section>
  );
}
