// Ported from CodeHerWay `src/services/srAlgorithm.test.ts` alongside the scheduler.
import { describe, expect, it } from 'vitest';
import { DAY_MS, nextSRCardStateFromGrade } from './srAlgorithm';

const FIXED_NOW = new Date('2026-04-30T12:00:00Z').getTime();

describe('nextSRCardStateFromGrade (the single 4-grade scheduler)', () => {
  const gradeCard = { interval: 4, ease: 2.3 };

  it('produces a distinct ease delta per grade bucket', () => {
    const eases = ['forgot', 'hard', 'good', 'easy'].map(
      (grade) => nextSRCardStateFromGrade({ card: gradeCard, grade, now: FIXED_NOW }).ease,
    );
    expect(eases[0]).toBeCloseTo(2.0, 5);
    expect(eases[1]).toBeCloseTo(2.2, 5);
    expect(eases[2]).toBeCloseTo(2.4, 5);
    expect(eases[3]).toBeCloseTo(2.5, 5);
    expect(new Set(eases).size).toBe(4);
  });

  it('forgot floors interval to 1 day, resets repetitions, and sets the reshow sentinel', () => {
    const next = nextSRCardStateFromGrade({
      card: { ...gradeCard, interval: 50, repetitionCount: 6 },
      grade: 'forgot',
      now: FIXED_NOW,
    });
    expect(next.interval).toBe(1);
    expect(next.repetitionCount).toBe(0);
    expect(next.reshow).toBe(true);
    expect(next.nextReview).toBe(FIXED_NOW + DAY_MS);
  });

  it('hard grows interval by 1.2; good by prior ease; easy by ease × 1.3', () => {
    const hard = nextSRCardStateFromGrade({ card: gradeCard, grade: 'hard', now: FIXED_NOW });
    const good = nextSRCardStateFromGrade({ card: gradeCard, grade: 'good', now: FIXED_NOW });
    const easy = nextSRCardStateFromGrade({ card: gradeCard, grade: 'easy', now: FIXED_NOW });
    expect(hard.interval).toBe(5); // 4 × 1.2 = 4.8 → 5
    expect(good.interval).toBe(9); // 4 × 2.3 = 9.2 → 9 (before-update ease)
    expect(easy.interval).toBe(12); // 4 × 2.3 × 1.3 = 11.96 → 12
    expect([hard.reshow, good.reshow, easy.reshow]).toEqual([false, false, false]);
  });

  it('counts repetitions for every successful grade', () => {
    for (const grade of ['hard', 'good', 'easy']) {
      const next = nextSRCardStateFromGrade({ card: { ...gradeCard, repetitionCount: 2 }, grade, now: FIXED_NOW });
      expect(next.repetitionCount).toBe(3);
    }
    expect(nextSRCardStateFromGrade({ card: gradeCard, grade: 'good', now: FIXED_NOW }).repetitionCount).toBe(1);
  });

  it('schedules nextReview by interval days from now', () => {
    const good = nextSRCardStateFromGrade({ card: gradeCard, grade: 'good', now: FIXED_NOW });
    expect(good.nextReview).toBe(FIXED_NOW + good.interval * DAY_MS);
  });

  it('clamps ease to the 1.3 floor and 3.0 cap', () => {
    const floored = nextSRCardStateFromGrade({ card: { ...gradeCard, ease: 1.4 }, grade: 'forgot', now: FIXED_NOW });
    const capped = nextSRCardStateFromGrade({ card: { ...gradeCard, ease: 2.95 }, grade: 'easy', now: FIXED_NOW });
    expect(floored.ease).toBe(1.3);
    expect(capped.ease).toBe(3.0);
  });

  it('interval never drops below 1 day for any grade', () => {
    for (const grade of ['forgot', 'hard', 'good', 'easy']) {
      const next = nextSRCardStateFromGrade({ card: { interval: 0, ease: 1.3 }, grade, now: FIXED_NOW });
      expect(next.interval).toBeGreaterThanOrEqual(1);
    }
  });

  it('a good streak grows the interval strictly', () => {
    let card = { interval: 1, ease: 2.5 };
    const intervals = [];
    for (let i = 0; i < 4; i += 1) {
      const next = nextSRCardStateFromGrade({ card, grade: 'good', now: FIXED_NOW });
      intervals.push(next.interval);
      card = { interval: next.interval, ease: next.ease };
    }
    for (let i = 1; i < intervals.length; i += 1) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
    }
  });

  it('rejects an unknown grade', () => {
    expect(() => nextSRCardStateFromGrade({ card: gradeCard, grade: 'meh', now: FIXED_NOW })).toThrow('Unknown grade');
  });
});
