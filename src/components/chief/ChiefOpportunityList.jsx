import ChiefAcceptList from "./ChiefAcceptList";

export default function ChiefOpportunityList(props) {
  return (
    <ChiefAcceptList
      {...props}
      section="opportunities"
      title="Opportunities"
      destinationNote="Accepting creates a tracked record in your Opportunities pipeline."
      readyLabel="Add to Opportunities"
      getKey={(item) => item.name}
      renderCopy={(item) => (
        <>
          <h4>{item.name}</h4>
          <p>{item.company || "Company not specified"}</p>
          <small>
            {item.priority || "Medium (default)"} priority · {item.stage || "New (default)"}
          </small>
          <p className="chief-next-step">Next step: {item.nextStep}</p>
        </>
      )}
      renderDestination={(item, accepted) =>
        accepted ? "In Opportunities" : `→ Opportunities · ${item.stage || "New"}`
      }
    />
  );
}
