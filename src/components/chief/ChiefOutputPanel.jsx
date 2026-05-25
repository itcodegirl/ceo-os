import ChiefSummaryCard from "./ChiefSummaryCard";
import ChiefPriorityList from "./ChiefPriorityList";
import ChiefOpportunityList from "./ChiefOpportunityList";
import ChiefContentList from "./ChiefContentList";
import ChiefTaskList from "./ChiefTaskList";
import EmptyOutputState from "./EmptyOutputState";
import OutputLoadingState from "./OutputLoadingState";

export default function ChiefOutputPanel({
  isGenerating,
  result,
  onAcceptPriority,
  onAcceptOpportunity,
  onAcceptContent,
  onAcceptTask,
  onAcceptAll,
  isAcceptingAll,
  isPriorityAccepted,
  isPriorityAccepting,
  isOpportunityAccepted,
  isOpportunityAccepting,
  isContentAccepted,
  isContentAccepting,
  isTaskAccepted,
  isTaskAccepting
}) {
  if (isGenerating) {
    return <OutputLoadingState />;
  }

  if (!result) {
    return <EmptyOutputState />;
  }

  const structured = result.structured || {};
  const priorities = structured.priorities || [];
  const opportunities = structured.opportunities || [];
  const contentItems = structured.contentItems || [];
  const tasks = structured.tasks || [];
  const hasStructuredItems = priorities.length
    + opportunities.length
    + contentItems.length
    + tasks.length > 0;

  return (
    <section className="chief-output-panel">
      <ChiefSummaryCard
        title={result.title}
        summary={result.summary}
        source={result.source}
        fallbackReason={result.fallbackReason}
        errorCode={result.errorCode}
        errorMessage={result.errorMessage}
        onAcceptAll={onAcceptAll}
        isAcceptingAll={isAcceptingAll}
        canAcceptAll={hasStructuredItems}
        structuredCounts={{
          priorities: priorities.length,
          opportunities: opportunities.length,
          contentItems: contentItems.length,
          tasks: tasks.length,
        }}
      />

      {!hasStructuredItems ? (
        <p className="helper-text" role="status">
          No structured actions were detected. Review the summary, or regenerate with more specific notes.
        </p>
      ) : null}

      <ChiefPriorityList
        items={priorities}
        onAccept={onAcceptPriority}
        isAccepted={isPriorityAccepted}
        isAccepting={isPriorityAccepting}
      />
      <ChiefOpportunityList
        items={opportunities}
        onAccept={onAcceptOpportunity}
        isAccepted={isOpportunityAccepted}
        isAccepting={isOpportunityAccepting}
      />
      <ChiefContentList
        items={contentItems}
        onAccept={onAcceptContent}
        isAccepted={isContentAccepted}
        isAccepting={isContentAccepting}
      />
      <ChiefTaskList
        items={tasks}
        onAccept={onAcceptTask}
        isAccepted={isTaskAccepted}
        isAccepting={isTaskAccepting}
      />
    </section>
  );
}
