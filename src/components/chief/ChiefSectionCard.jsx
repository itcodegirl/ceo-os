export default function ChiefSectionCard({ title, count, destinationNote, children }) {
  return (
    <div className="chief-card chief-section-card">
      <div className="chief-section-header">
        <div className="chief-section-heading">
          <h3>{title}</h3>
          {destinationNote ? (
            <p className="chief-section-destination">{destinationNote}</p>
          ) : null}
        </div>
        <span className="chief-count-badge">{count}</span>
      </div>

      <div className="chief-section-body">{children}</div>
    </div>
  );
}
