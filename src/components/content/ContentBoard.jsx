import { useMemo, useState } from 'react';
import ContentTable from './ContentTable';
import { CONTENT_STATUSES } from '../../lib/contentPayloadSchema';
import { contentStatusRank } from '../../lib/contentFormatting';

const ALL_FILTER = '__all__';

function sortForBoard(items) {
  return [...items].sort((a, b) => {
    const rankDiff = contentStatusRank(a.status) - contentStatusRank(b.status);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    // Within a stage, soonest publish date first; undated pieces sit last.
    const aDate = a.scheduledFor || '9999-99-99';
    const bDate = b.scheduledFor || '9999-99-99';
    if (aDate !== bDate) {
      return aDate.localeCompare(bDate);
    }
    return String(a.title).localeCompare(String(b.title));
  });
}

function ContentBoard({ items, onOpenItem }) {
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const [activeStatus, setActiveStatus] = useState(ALL_FILTER);

  const counts = useMemo(() => {
    const map = new Map();
    for (const item of safeItems) {
      map.set(item.status, (map.get(item.status) || 0) + 1);
    }
    return map;
  }, [safeItems]);

  const availableStatuses = useMemo(
    () => CONTENT_STATUSES.filter((status) => counts.get(status)),
    [counts],
  );

  // Never strand the user on a filter that no longer has any content
  // (e.g. the last "Editing" piece moved to "Ready" in another tab).
  const effectiveStatus = activeStatus !== ALL_FILTER && !counts.get(activeStatus)
    ? ALL_FILTER
    : activeStatus;

  const visibleItems = useMemo(() => {
    const filtered = effectiveStatus === ALL_FILTER
      ? safeItems
      : safeItems.filter((item) => item.status === effectiveStatus);
    return sortForBoard(filtered);
  }, [safeItems, effectiveStatus]);

  return (
    <div className="content-board-view">
      {availableStatuses.length > 1 ? (
        <div className="content-filters" role="group" aria-label="Filter content by stage">
          <button
            type="button"
            className={`content-filter-chip ${effectiveStatus === ALL_FILTER ? 'content-filter-chip--active' : ''}`.trim()}
            aria-pressed={effectiveStatus === ALL_FILTER}
            onClick={() => setActiveStatus(ALL_FILTER)}
          >
            All
            <span className="content-filter-chip__count">{safeItems.length}</span>
          </button>
          {availableStatuses.map((status) => (
            <button
              key={status}
              type="button"
              className={`content-filter-chip ${effectiveStatus === status ? 'content-filter-chip--active' : ''}`.trim()}
              aria-pressed={effectiveStatus === status}
              onClick={() => setActiveStatus(status)}
            >
              {status}
              <span className="content-filter-chip__count">{counts.get(status)}</span>
            </button>
          ))}
        </div>
      ) : null}

      <ContentTable items={visibleItems} onOpenItem={onOpenItem} />
    </div>
  );
}

export default ContentBoard;
