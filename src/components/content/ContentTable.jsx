import { useCallback, useMemo } from 'react';
import Badge from '../ui/Badge';
import { contentStatusTone } from '../../lib/statusMaps';
import { formatPublishDate } from '../../lib/contentFormatting';

function ContentTable({ items, onOpenItem }) {
  const isValidItemsArray = Array.isArray(items);
  const normalizedItems = useMemo(
    () => (isValidItemsArray ? items : []),
    [isValidItemsArray, items],
  );
  const hasHandler = typeof onOpenItem === 'function';

  const itemsById = useMemo(
    () =>
      new Map(normalizedItems.map((item) => [String(item.id), item])),
    [normalizedItems],
  );

  const handleRowClick = useCallback((event) => {
    if (!hasHandler) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const row = target.closest('tr[data-item-id]');
    if (!row) {
      return;
    }

    const itemId = row.getAttribute('data-item-id');
    if (!itemId) {
      return;
    }

    const item = itemsById.get(itemId);
    if (!item) {
      return;
    }

    onOpenItem(item);
  }, [hasHandler, itemsById, onOpenItem]);

  const handleRowKeyDown = useCallback((event) => {
    if (!hasHandler) {
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest('button, a, input, textarea, select, [role="button"]')) {
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    handleRowClick(event);
  }, [handleRowClick, hasHandler]);

  if (!isValidItemsArray) {
    return null;
  }

  return (
    <div className="crm-table">
      {hasHandler ? (
        <p className="helper-text crm-table__hint">Click any row or press Enter/Space to open the piece.</p>
      ) : null}
      <table className="crm-table__native" aria-label="Content pipeline">
        <thead>
          <tr className="crm-table__header">
            <th scope="col">Title / type</th>
            <th scope="col">Platform</th>
            <th scope="col">Stage</th>
            <th scope="col">Publish date</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody
          onClick={hasHandler ? handleRowClick : undefined}
          onKeyDown={hasHandler ? handleRowKeyDown : undefined}
        >
          {normalizedItems.map((item) => {
            const publishLabel = formatPublishDate(item.scheduledFor);
            return (
              <tr
                key={item.id}
                data-item-id={String(item.id)}
                className={hasHandler ? 'crm-table__row crm-table__row--interactive' : 'crm-table__row'}
                title={hasHandler ? `Open ${item.title}` : undefined}
                tabIndex={hasHandler ? 0 : undefined}
              >
                <th scope="row" className="crm-table__cell" data-label="Title / type">
                  <div>
                    <p className="crm-table__title">{item.title}</p>
                    <p className="crm-table__subtitle">{item.contentType || 'Post'}</p>
                  </div>
                </th>
                <td className="crm-table__cell" data-label="Platform">
                  <p className="crm-table__subtitle">{item.platform || '—'}</p>
                </td>
                <td className="crm-table__cell" data-label="Stage">
                  <Badge label={item.status} tone={contentStatusTone[item.status] || 'default'} />
                </td>
                <td className="crm-table__cell" data-label="Publish date">
                  <p className="crm-table__subtitle">
                    {publishLabel || (item.status === 'Published' ? 'Published' : 'Not scheduled')}
                  </p>
                </td>
                <td className="crm-table__cell crm-table__cell--action" data-label="Details">
                  {hasHandler ? (
                    <button type="button" className="crm-table__open-button">
                      Open
                      <span className="sr-only"> {item.title} on {item.platform || 'no platform set'}</span>
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ContentTable;
