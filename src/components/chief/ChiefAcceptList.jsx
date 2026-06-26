import ChiefSectionCard from "./ChiefSectionCard";
import { getChiefAcceptLabel } from "./chiefAcceptLabel";
import {
  getAcceptButtonAriaLabel,
  getAcceptancePreviewCaption,
} from "./acceptancePreview";

/**
 * Shared scaffold for the four Chief of Staff structured-output lists
 * (priorities, opportunities, content drafts, tasks). Every list rendered an
 * identical section card → item map → accept button + aria/title wiring and
 * differed only in:
 *   - `section` / `title` / `destinationNote` / `readyLabel` (config strings),
 *   - `getKey(item)` (which field uniquely identifies a row), and
 *   - `renderCopy(item)` and `renderDestination(item, accepted)` (the per-type
 *     body and the "→ destination" action line).
 *
 * Collapsing the boilerplate here keeps the accept-button accessibility,
 * disabled-state, and key logic in one place so the four lists can't drift.
 */
export default function ChiefAcceptList({
  items = [],
  onAccept,
  isAccepted,
  isAccepting,
  section,
  title,
  destinationNote,
  readyLabel,
  getKey,
  renderCopy,
  renderDestination,
}) {
  if (!items.length) return null;

  return (
    <ChiefSectionCard title={title} count={items.length} destinationNote={destinationNote}>
      {items.map((item, index) => {
        const accepting = Boolean(isAccepting?.(item));
        const accepted = Boolean(isAccepted?.(item));
        const ariaLabel = getAcceptButtonAriaLabel({
          section,
          item,
          isAccepting: accepting,
          isAccepted: accepted,
        });
        const caption = getAcceptancePreviewCaption(section, item);

        return (
          <div className="chief-item" key={`${getKey(item)}-${index}`}>
            <div className="chief-item-copy">
              {renderCopy(item)}
              {caption ? (
                <small className="chief-item-destination">→ {caption}</small>
              ) : null}
            </div>

            <div className="chief-item-action">
              <p className="chief-item-destination">
                {renderDestination(item, accepted)}
              </p>
              <button
                type="button"
                aria-label={ariaLabel || undefined}
                title={ariaLabel || undefined}
                disabled={accepting || accepted}
                onClick={() => onAccept(item)}
              >
                {getChiefAcceptLabel({ isAccepting: accepting, isAccepted: accepted, readyLabel })}
              </button>
            </div>
          </div>
        );
      })}
    </ChiefSectionCard>
  );
}
