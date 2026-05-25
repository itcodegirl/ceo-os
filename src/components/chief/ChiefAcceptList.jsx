import ChiefSectionCard from "./ChiefSectionCard";
import { getChiefAcceptLabel } from "./chiefAcceptLabel";
import {
  getAcceptButtonAriaLabel,
  getAcceptancePreviewCaption,
} from "./acceptancePreview";

/**
 * Per-section configuration for the structured-acceptance lists. Previously
 * ChiefPriorityList / ChiefOpportunityList / ChiefContentList / ChiefTaskList
 * were four near-identical components that differed only in these fields — the
 * accept-row shell (caption, aria label, destination line, accept button, and
 * accepting/accepted states) was copied verbatim across all four. Keep the
 * section key in sync with `acceptancePreview` and the Chief acceptance hook.
 */
const SECTION_CONFIG = {
  priorities: {
    title: "Priorities",
    destinationNote:
      "Accepting adds each item to this week's Weekly Brief priorities.",
    readyLabel: "Add to Weekly",
    getKey: (item) => item.title,
    renderCopy: (item) => (
      <>
        <h4>{item.title}</h4>
        <p>{item.reason}</p>
        <small>
          Owner: {item.owner || "You"} · Status: {item.status || "Planned"}
        </small>
      </>
    ),
    getActionDestination: (item, accepted) =>
      accepted ? "In Weekly Brief" : "→ Weekly Brief priority",
  },
  opportunities: {
    title: "Opportunities",
    destinationNote:
      "Accepting creates a tracked record in your Opportunities pipeline.",
    readyLabel: "Add to Opportunities",
    getKey: (item) => item.name,
    renderCopy: (item) => (
      <>
        <h4>{item.name}</h4>
        <p>{item.company}</p>
        <small>
          {item.priority} priority · {item.stage || "New"}
        </small>
        <p className="chief-next-step">Next step: {item.nextStep}</p>
      </>
    ),
    getActionDestination: (item, accepted) =>
      accepted ? "In Opportunities" : `→ Opportunities · ${item.stage || "New"}`,
  },
  contentItems: {
    title: "Content Ideas",
    destinationNote:
      "Accepting adds a draft to Content OS so you can plan and ship it.",
    readyLabel: "Add to Content",
    getKey: (item) => item.title,
    renderCopy: (item) => (
      <>
        <h4>{item.title}</h4>
        <p>{item.summary}</p>
        <small>
          {item.platform} · {item.status || "Drafting"}
        </small>
      </>
    ),
    getActionDestination: (item, accepted) =>
      accepted ? "In Content OS" : `→ Content OS · ${item.status || "Drafting"}`,
  },
  tasks: {
    title: "Tasks",
    destinationNote: "Accepting adds each task to this week's Weekly Brief.",
    readyLabel: "Add to Weekly",
    getKey: (item) => item.title,
    renderCopy: (item) => (
      <>
        <h4>{item.title}</h4>
        <small>{item.status || "Planned"}</small>
      </>
    ),
    getActionDestination: (item, accepted) =>
      accepted ? "In Weekly Brief" : "→ Weekly Brief task",
  },
};

export default function ChiefAcceptList({
  section,
  items = [],
  onAccept,
  isAccepted,
  isAccepting,
}) {
  const config = SECTION_CONFIG[section];
  if (!config || !items.length) {
    return null;
  }

  return (
    <ChiefSectionCard
      title={config.title}
      count={items.length}
      destinationNote={config.destinationNote}
    >
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
          <div className="chief-item" key={`${config.getKey(item)}-${index}`}>
            <div className="chief-item-copy">
              {config.renderCopy(item)}
              {caption ? (
                <small className="chief-item-destination">→ {caption}</small>
              ) : null}
            </div>

            <div className="chief-item-action">
              <p className="chief-item-destination">
                {config.getActionDestination(item, accepted)}
              </p>
              <button
                type="button"
                aria-label={ariaLabel || undefined}
                title={ariaLabel || undefined}
                disabled={accepting || accepted}
                onClick={() => onAccept(item)}
              >
                {getChiefAcceptLabel({
                  isAccepting: accepting,
                  isAccepted: accepted,
                  readyLabel: config.readyLabel,
                })}
              </button>
            </div>
          </div>
        );
      })}
    </ChiefSectionCard>
  );
}
