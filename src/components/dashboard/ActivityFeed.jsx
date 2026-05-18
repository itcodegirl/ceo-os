import { memo } from 'react';
import EmptyHint from '../ui/EmptyHint';

function ActivityFeedComponent({ items = [] }) {
  const normalizedItems = Array.isArray(items) ? items : [];

  if (!normalizedItems.length) {
    return (
      <EmptyHint>
        No activity yet. Add a note or mark a priority complete to begin the feed.
      </EmptyHint>
    );
  }

  return (
    <ul className="activity-feed" aria-label="Recent activity feed">
      {normalizedItems.map((item) => (
        <li key={item.id} className="activity-feed__item">
          <article className="activity-item">
            <p className="activity-item__title">{item.title}</p>
            <p className="activity-item__meta">
              {item.time} | {item.type}
            </p>
          </article>
        </li>
      ))}
    </ul>
  );
}

const ActivityFeed = memo(ActivityFeedComponent);

export default ActivityFeed;
