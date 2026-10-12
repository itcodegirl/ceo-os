import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import { notebookHref } from '../../lib/notebook/notebookRoutes';
import { NOTEBOOK_SECTIONS } from '../../lib/notebook/notebookSections';
import { hasWriting } from '../../lib/notebook/notebookText';
import { formatIsoDate } from '../../lib/utils';

const shortDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
}

function describeDay(dateKey, todayKey) {
  if (dateKey === todayKey) return 'Today';
  if (dateKey === addDays(todayKey, -1)) return 'Yesterday';
  return shortDate.format(new Date(`${dateKey}T12:00:00`));
}

/** Section switcher plus the current section's pages (days, for Personal). */
function NotebookSidebar({ section, pages, activePageId, activeDate, todayKey, onSelectDate, onNewPage }) {
  const isDaily = section.pageMode === 'daily';
  // Empty days are skipped unless open, so browsing dates doesn't clutter the list.
  const listedPages = isDaily
    ? pages.filter((page) => page.pageDate === todayKey || page.pageDate === activeDate || Object.values(page.blocks).some(hasWriting))
    : pages;

  return (
    <div className="notebook-nav">
      <nav aria-label="Notebook sections">
        <ul className="notebook-nav__sections">
          {NOTEBOOK_SECTIONS.map((candidate) => (
            <li key={candidate.id}>
              <Link
                to={notebookHref(candidate.id)}
                className="notebook-nav__section"
                aria-current={candidate.id === section.id ? 'page' : undefined}
              >
                {candidate.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="notebook-nav__pages">
        <div className="notebook-nav__pages-header">
          <h2 className="notebook-nav__heading">{isDaily ? 'Days' : 'Pages'}</h2>
          {!isDaily ? <Button size="small" onClick={onNewPage}>New page</Button> : null}
        </div>
        <p className="helper-text">{section.description}</p>

        {isDaily ? (
          <label className="notebook-nav__date">
            <span className="helper-text">Go to a day</span>
            <input
              type="date"
              className="input-field__control"
              value={activeDate}
              max={todayKey}
              onChange={(event) => {
                if (event.target.value) onSelectDate(event.target.value);
              }}
            />
          </label>
        ) : null}

        {listedPages.length === 0 ? (
          <p className="helper-text notebook-nav__empty">No pages yet. Start one to begin writing.</p>
        ) : (
          <ul className="notebook-nav__page-list">
            {listedPages.map((page) => {
              const isActive = isDaily ? page.pageDate === activeDate : page.id === activePageId;
              return (
                <li key={page.id}>
                  <Link
                    to={isDaily ? notebookHref(section.id, { date: page.pageDate }) : notebookHref(section.id, { page: page.id })}
                    className="notebook-nav__page"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {isDaily ? describeDay(page.pageDate, todayKey) : page.title}
                    {page.sync.conflict ? <span className="notebook-nav__flag"> · needs you</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default NotebookSidebar;
