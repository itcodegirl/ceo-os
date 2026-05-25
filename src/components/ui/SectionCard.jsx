import Icon from './Icon';
import ActionControl from './ActionControl';

function SectionCard({
  id,
  title,
  children,
  iconName = 'section',
  actionText,
  actionIconName,
  actionDisabled = false,
  actionTo,
  onAction,
  actionLabel,
}) {
  return (
    <section className="section-card" id={id}>
      <div className="section-card__header">
        <h2 className="section-card__title">
          <Icon name={iconName} size={16} className="section-card__title-icon" />
          <span>{title}</span>
        </h2>
        <ActionControl
          actionText={actionText}
          actionIconName={actionIconName}
          actionDisabled={actionDisabled}
          actionTo={actionTo}
          onAction={onAction}
          actionLabel={actionLabel}
        />
      </div>
      <div className="section-card__body">{children}</div>
    </section>
  );
}

export default SectionCard;
