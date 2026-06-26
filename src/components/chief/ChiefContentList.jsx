import ChiefAcceptList from "./ChiefAcceptList";

export default function ChiefContentList(props) {
  return (
    <ChiefAcceptList
      {...props}
      section="contentItems"
      title="Content Ideas"
      destinationNote="Accepting adds a draft to Content OS so you can plan and ship it."
      readyLabel="Add to Content"
      getKey={(item) => item.title}
      renderCopy={(item) => (
        <>
          <h4>{item.title}</h4>
          <p>{item.summary}</p>
          <small>
            {item.platform} · {item.status || "Drafting"}
          </small>
        </>
      )}
      renderDestination={(item, accepted) =>
        accepted ? "In Content OS" : `→ Content OS · ${item.status || "Drafting"}`
      }
    />
  );
}
