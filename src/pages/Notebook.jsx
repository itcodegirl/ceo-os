import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/Icon';
import PageHeader from '../components/ui/PageHeader';
import NewPageDialog from '../components/notebook/NewPageDialog';
import NotebookPageView from '../components/notebook/NotebookPageView';
import NotebookSidebar from '../components/notebook/NotebookSidebar';
import { useNotebookPage } from '../hooks/useNotebookPage';
import { useNotebookPages } from '../hooks/useNotebookPages';
import { useToast } from '../hooks/useToast';
import { getTodayJournalDateKey } from '../lib/journalRepository';
import { createNotebookPage } from '../lib/notebook/notebookPagesRepository';
import { notebookHref } from '../lib/notebook/notebookRoutes';
import { getNotebookSection, isNotebookSectionId, NOTEBOOK_SECTION_IDS } from '../lib/notebook/notebookSections';
import '../styles/forms.css';
import '../styles/notebook.css';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function Notebook() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [creatingPage, setCreatingPage] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const requestedSection = searchParams.get('section');
  const section = getNotebookSection(isNotebookSectionId(requestedSection) ? requestedSection : NOTEBOOK_SECTION_IDS.personal);
  const isDaily = section.pageMode === 'daily';
  const todayKey = getTodayJournalDateKey();
  const requestedDate = searchParams.get('date');
  const date = requestedDate && DATE_KEY_PATTERN.test(requestedDate) && requestedDate <= todayKey ? requestedDate : todayKey;

  const { pages } = useNotebookPages(section.id);
  const requestedPageId = searchParams.get('page');
  const pageId = isDaily
    ? null
    : (pages.some((page) => page.id === requestedPageId) ? requestedPageId : pages[0]?.id ?? null);
  const page = useNotebookPage({ sectionId: section.id, pageId, date });

  const handleCreate = ({ title, sourceUrl }) => {
    try {
      const created = createNotebookPage({ section: section.id, title, sourceUrl });
      setCreatingPage(false);
      navigate(notebookHref(section.id, { page: created.id }));
    } catch {
      showToast('Could not create the page on this device.');
    }
  };

  let content;
  if (page) {
    content = (
      <NotebookPageView
        key={`${page.id}:${page.sync.revision}:${reloadToken}`}
        page={page}
        section={section}
        headerMeta={isDaily && date !== todayKey ? (
          <Link className="notebook-sheet__today-link" to={notebookHref(section.id)}>Back to today</Link>
        ) : null}
        onReload={() => setReloadToken((token) => token + 1)}
        onDeleted={() => navigate(notebookHref(section.id))}
      />
    );
  } else if (page === null) {
    content = (
      <EmptyState
        icon={<Icon name="journal" size={20} />}
        title={`No ${section.label} pages yet`}
        description={section.description}
        action={<Button onClick={() => setCreatingPage(true)}>New page</Button>}
      />
    );
  } else {
    content = <p className="helper-text" role="status">Opening today&apos;s page…</p>;
  }

  return (
    <section className="notebook-route">
      <PageHeader
        title="Notebook"
        description="Personal reflection, professional notes, learning, and CodeHerWay ideas, in one place."
      />
      <div className="notebook-layout">
        <NotebookSidebar
          section={section}
          pages={pages}
          activePageId={page?.id}
          activeDate={date}
          todayKey={todayKey}
          onSelectDate={(nextDate) => navigate(notebookHref(section.id, { date: nextDate }))}
          onNewPage={() => setCreatingPage(true)}
        />
        <div className="notebook-main">{content}</div>
      </div>
      {creatingPage ? (
        <NewPageDialog section={section} onCancel={() => setCreatingPage(false)} onCreate={handleCreate} />
      ) : null}
    </section>
  );
}

export default Notebook;
