import ChiefSectionCard from "./ChiefSectionCard";
import { getChiefAcceptLabel } from "./chiefAcceptLabel";
import {
  getAcceptButtonAriaLabel,
  getAcceptancePreviewCaption,
} from "./acceptancePreview";

export default function ChiefTaskList({
  items = [],
  onAccept,
  isAccepted,
  isAccepting
}) {
  if (!items.length) return null;

  return (
    <ChiefSectionCard
      title="Tasks"
      count={items.length}
      destinationNote="Accepting adds each task to this week's Weekly Brief."
    >
      {items.map((item, index) => {
        const accepting = Boolean(isAccepting?.(item));
        const accepted = Boolean(isAccepted?.(item));
        const ariaLabel = getAcceptButtonAriaLabel({
          section: "tasks",
          item,
          isAccepting: accepting,
          isAccepted: accepted,
        });
        const caption = getAcceptancePreviewCaption("tasks", item);

        return (
          <div className="chief-item" key={`${item.title}-${index}`}>
            <div className="chief-item-copy">
              <h4>{item.title}</h4>
              <small>{item.status || "Planned"}</small>
              {caption ? (
                <small className="chief-item-destination">→ {caption}</small>
              ) : null}
            </div>

            <div className="chief-item-action">
              <p className="chief-item-destination">
                {accepted ? "In Weekly Brief" : "→ Weekly Brief task"}
              </p>
              <button
                type="button"
                aria-label={ariaLabel || undefined}
                title={ariaLabel || undefined}
                disabled={accepting || accepted}
                onClick={() => onAccept(item)}
              >
                {getChiefAcceptLabel({ isAccepting: accepting, isAccepted: accepted, readyLabel: "Add to Weekly" })}
              </button>
            </div>
          </div>
        );
      })}
    </ChiefSectionCard>
  );
}
