import { DAY_MS, nextSRCardStateFromGrade, SR_STARTING_EASE, SR_STARTING_INTERVAL } from './srAlgorithm';

/** Review metadata every new card starts with: due tomorrow at the SM-2 default ease. */
export function createInitialSchedule(now = new Date()) {
  return {
    ease: SR_STARTING_EASE,
    intervalDays: SR_STARTING_INTERVAL,
    repetitionCount: 0,
    nextReviewAt: new Date(now.getTime() + SR_STARTING_INTERVAL * DAY_MS).toISOString(),
  };
}

/**
 * Bridges the scheduler to the notebook card shape. There is no review screen
 * yet; this is the entry point a review queue will call.
 */
export function scheduleAfterGrade(schedule, grade, now = new Date()) {
  const next = nextSRCardStateFromGrade({
    card: { ease: schedule.ease, interval: schedule.intervalDays, repetitionCount: schedule.repetitionCount },
    grade,
    now: now.getTime(),
  });
  return {
    schedule: {
      ease: next.ease,
      intervalDays: next.interval,
      repetitionCount: next.repetitionCount,
      nextReviewAt: new Date(next.nextReview).toISOString(),
      lastGrade: grade,
      gradedAt: now.toISOString(),
    },
    reshow: next.reshow,
  };
}
