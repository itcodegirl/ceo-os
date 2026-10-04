import { describe, expect, it } from 'vitest';
import { createInitialSchedule, scheduleAfterGrade } from './cardSchedule';
import { DAY_MS, SR_STARTING_EASE, SR_STARTING_INTERVAL } from './srAlgorithm';

const NOW = new Date('2026-09-13T09:00:00.000Z');

describe('card schedule', () => {
  it('seeds every new card from the defaults and makes it due tomorrow', () => {
    expect(createInitialSchedule(NOW)).toEqual({
      ease: SR_STARTING_EASE,
      intervalDays: SR_STARTING_INTERVAL,
      repetitionCount: 0,
      nextReviewAt: new Date(NOW.getTime() + DAY_MS).toISOString(),
    });
  });

  it('maps the scheduler result onto the card schedule shape', () => {
    const { schedule, reshow } = scheduleAfterGrade(createInitialSchedule(NOW), 'good', NOW);
    expect(schedule).toEqual({
      ease: 2.6,
      intervalDays: 3, // 1 × 2.5 → 2.5 → 3
      repetitionCount: 1,
      nextReviewAt: new Date(NOW.getTime() + 3 * DAY_MS).toISOString(),
      lastGrade: 'good',
      gradedAt: NOW.toISOString(),
    });
    expect(reshow).toBe(false);
  });

  it('passes the same-session reshow signal through for forgot', () => {
    const { schedule, reshow } = scheduleAfterGrade(
      { ease: 2.5, intervalDays: 12, repetitionCount: 4, nextReviewAt: NOW.toISOString() },
      'forgot',
      NOW,
    );
    expect(reshow).toBe(true);
    expect(schedule.intervalDays).toBe(1);
    expect(schedule.repetitionCount).toBe(0);
  });
});
