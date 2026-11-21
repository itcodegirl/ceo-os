import { lazy, Suspense } from 'react';

const WeeklyEditorModal = lazy(() => import('./WeeklyEditorModal'));

export default function LazyWeeklyEditorModal(props) {
  if (!props.isOpen) return null;
  return (
    <Suspense fallback={<p role="status">Opening editor…</p>}>
      <WeeklyEditorModal {...props} />
    </Suspense>
  );
}
