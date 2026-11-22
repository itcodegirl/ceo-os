import ChiefAcceptList from "./ChiefAcceptList";

export default function ChiefTaskList(props) {
  return (
    <ChiefAcceptList
      {...props}
      section="tasks"
      title="Tasks"
      destinationNote="Accepting saves each task as a priority in this week's Weekly Brief."
      readyLabel="Add to Weekly"
      getKey={(item) => item.title}
      renderCopy={(item) => (
        <>
          <h4>{item.title}</h4>
          <small>Owner: {item.owner || "Not specified"} · {item.status || "Planned (default)"}</small>
        </>
      )}
      renderDestination={(item, accepted) =>
        accepted ? "In Weekly Brief" : "→ Weekly Brief priority (from task)"
      }
    />
  );
}
