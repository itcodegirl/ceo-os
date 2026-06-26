import ChiefAcceptList from "./ChiefAcceptList";

export default function ChiefPriorityList(props) {
  return (
    <ChiefAcceptList
      {...props}
      section="priorities"
      title="Priorities"
      destinationNote="Accepting adds each item to this week's Weekly Brief priorities."
      readyLabel="Add to Weekly"
      getKey={(item) => item.title}
      renderCopy={(item) => (
        <>
          <h4>{item.title}</h4>
          <p>{item.reason}</p>
          <small>
            Owner: {item.owner || "You"} · Status: {item.status || "Planned"}
          </small>
        </>
      )}
      renderDestination={(item, accepted) =>
        accepted ? "In Weekly Brief" : "→ Weekly Brief priority"
      }
    />
  );
}
