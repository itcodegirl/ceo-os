import { countStructuredItems, getChiefResponseId } from "./chiefHistory";

function formatSourceLabel(source) {
  return source === "fallback" ? "Local fallback" : "AI generated";
}

export default function ChiefHistoryList({ items = [], selectedId, onSelect }) {
  if (!Array.isArray(items) || items.length < 2) {
    return null;
  }

  return (
    <div className="chief-card chief-history-card">
      <div className="chief-section-header">
        <div className="chief-section-heading">
          <h3>Recent outputs</h3>
          <p className="chief-section-destination">
            Kept on this workspace. Pick one to review it again — nothing is deleted when you generate a new one.
          </p>
        </div>
        <span className="chief-count-badge">{items.length}</span>
      </div>

      <ul className="chief-history-list">
        {items.map((item, index) => {
          const id = getChiefResponseId(item, index);
          const isActive = selectedId ? id === selectedId : index === 0;
          const structuredCount = countStructuredItems(item?.structuredPayload);

          return (
            <li key={id}>
              <button
                type="button"
                className={`chief-history-item ${isActive ? "chief-history-item--active" : ""}`.trim()}
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelect?.(id)}
              >
                <span className="chief-history-item__title">{item?.title || "Executive Output"}</span>
                <span className="chief-history-item__meta">
                  {formatSourceLabel(item?.source)}
                  {index === 0 ? " · Latest" : ""}
                  {structuredCount > 0 ? ` · ${structuredCount} structured item${structuredCount === 1 ? "" : "s"}` : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
