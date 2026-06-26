import ChiefAcceptList from "./ChiefAcceptList";

export default function ChiefTaskList(props) {
  return (
    <ChiefAcceptList
      {...props}
      section="tasks"
      title="Tasks"
      destinationNote="Accepting adds each task to this week's Weekly Brief."
      readyLabel="Add to Weekly"
      getKey={(item) => item.title}
      renderCopy={(item) => (
        <>
          <h4>{item.title}</h4>
          <small>{item.status || "Planned"}</small>
        </>
      )}
      renderDestination={(item, accepted) =>
        accepted ? "In Weekly Brief" : "→ Weekly Brief task"
      }
    />
  );
}
