import ChiefSectionCard from "./ChiefSectionCard";
import { getChiefAcceptLabel } from "./chiefAcceptLabel";
import {
  getAcceptButtonAriaLabel,
  getAcceptancePreviewCaption,
} from "./acceptancePreview";

export default function ChiefContentList({
  items = [],
  onAccept,
  isAccepted,
  isAccepting
}) {
  if (!items.length) return null;

  return (
    <ChiefSectionCard
      title="Content Ideas"
      count={items.length}
      destinationNote="Accepting adds a draft to Content OS so you can plan and ship it."
    >
      {items.map((item, index) => {
        const accepting = Boolean(isAccepting?.(item));
        const accepted = Boolean(isAccepted?.(item));
        const statusLabel = item.status || "Drafting";
        const ariaLabel = getAcceptButtonAriaLabel({
          section: "contentItems",
          item,
          isAccepting: accepting,
          isAccepted: accepted,
        });
        const caption = getAcceptancePreviewCaption("contentItems", item);

        return (
          <div className="chief-item" key={`${item.title}-${index}`}>
            <div className="chief-item-copy">
              <h4>{item.title}</h4>
              <p>{item.summary}</p>
              <small>
                {item.platform} · {statusLabel}
              </small>
              {caption ? (
                <small className="chief-item-destination">→ {caption}</small>
              ) : null}
            </div>

            <div className="chief-item-action">
              <p className="chief-item-destination">
                {accepted ? "In Content OS" : `→ Content OS · ${statusLabel}`}
              </p>
              <button
                type="button"
                aria-label={ariaLabel || undefined}
                title={ariaLabel || undefined}
                disabled={accepting || accepted}
                onClick={() => onAccept(item)}
              >
                {getChiefAcceptLabel({ isAccepting: accepting, isAccepted: accepted, readyLabel: "Add to Content" })}
              </button>
            </div>
          </div>
        );
      })}
    </ChiefSectionCard>
  );
}
