import ChiefSectionCard from "./ChiefSectionCard";
import { getChiefAcceptLabel } from "./chiefAcceptLabel";
import {
  getAcceptButtonAriaLabel,
  getAcceptancePreviewCaption,
} from "./acceptancePreview";

export default function ChiefOpportunityList({
  items = [],
  onAccept,
  isAccepted,
  isAccepting
}) {
  if (!items.length) return null;

  return (
    <ChiefSectionCard
      title="Opportunities"
      count={items.length}
      destinationNote="Accepting creates a tracked record in your Opportunities pipeline."
    >
      {items.map((item, index) => {
        const accepting = Boolean(isAccepting?.(item));
        const accepted = Boolean(isAccepted?.(item));
        const stageLabel = item.stage || "New";
        const ariaLabel = getAcceptButtonAriaLabel({
          section: "opportunities",
          item,
          isAccepting: accepting,
          isAccepted: accepted,
        });
        const caption = getAcceptancePreviewCaption("opportunities", item);

        return (
          <div className="chief-item" key={`${item.name}-${index}`}>
            <div className="chief-item-copy">
              <h4>{item.name}</h4>
              <p>{item.company}</p>
              <small>
                {item.priority} priority · {stageLabel}
              </small>
              <p className="chief-next-step">Next step: {item.nextStep}</p>
              {caption ? (
                <small className="chief-item-destination">→ {caption}</small>
              ) : null}
            </div>

            <div className="chief-item-action">
              <p className="chief-item-destination">
                {accepted ? "In Opportunities" : `→ Opportunities · ${stageLabel}`}
              </p>
              <button
                type="button"
                aria-label={ariaLabel || undefined}
                title={ariaLabel || undefined}
                disabled={accepting || accepted}
                onClick={() => onAccept(item)}
              >
                {getChiefAcceptLabel({ isAccepting: accepting, isAccepted: accepted, readyLabel: "Add to Opportunities" })}
              </button>
            </div>
          </div>
        );
      })}
    </ChiefSectionCard>
  );
}
