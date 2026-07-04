import { describe, it, expect } from 'vitest';
import {
  gradeMcq,
  gradeFillblank,
  gradeDragdrop,
  gradeMatch,
  gradeCoding,
  gradeQuestion,
  gradeQuiz,
} from '../src/services/quizService.js';

describe('quiz grading helpers', () => {
  describe('gradeMcq', () => {
    const options = ['red', 'green', 'blue'];
    it('matches by index when correct is an index', () => {
      expect(gradeMcq(1, 1, options)).toBe(true);
      expect(gradeMcq(0, 1, options)).toBe(false);
    });
    it('matches answer index against correct value', () => {
      expect(gradeMcq(2, 'blue', options)).toBe(true);
      expect(gradeMcq(0, 'blue', options)).toBe(false);
    });
    it('matches by value', () => {
      expect(gradeMcq('green', 'green', options)).toBe(true);
    });
    it('handles missing answers', () => {
      expect(gradeMcq(undefined, 1, options)).toBe(false);
      expect(gradeMcq(null, 1, options)).toBe(false);
    });
  });

  describe('gradeFillblank', () => {
    it('is case-insensitive and trims', () => {
      expect(gradeFillblank('  Hello ', 'hello')).toBe(true);
      expect(gradeFillblank('WORLD', 'world')).toBe(true);
    });
    it('accepts an array of accepted answers', () => {
      expect(gradeFillblank('color', ['colour', 'color'])).toBe(true);
      expect(gradeFillblank('nope', ['colour', 'color'])).toBe(false);
    });
  });

  describe('gradeDragdrop', () => {
    it('requires ordered array equality', () => {
      expect(gradeDragdrop(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
      expect(gradeDragdrop(['b', 'a', 'c'], ['a', 'b', 'c'])).toBe(false);
    });
    it('rejects different lengths or non-arrays', () => {
      expect(gradeDragdrop(['a'], ['a', 'b'])).toBe(false);
      expect(gradeDragdrop('a', ['a'])).toBe(false);
    });
  });

  describe('gradeMatch', () => {
    it('matches object maps order-independently', () => {
      expect(gradeMatch({ cat: 'meow', dog: 'woof' }, { dog: 'woof', cat: 'meow' })).toBe(true);
      expect(gradeMatch({ cat: 'woof', dog: 'meow' }, { cat: 'meow', dog: 'woof' })).toBe(false);
    });
    it('matches array-of-pairs form', () => {
      expect(
        gradeMatch(
          [['cat', 'meow'], ['dog', 'woof']],
          [{ left: 'cat', right: 'meow' }, { left: 'dog', right: 'woof' }]
        )
      ).toBe(true);
    });
    it('rejects empty or mismatched-size maps', () => {
      expect(gradeMatch({}, {})).toBe(false);
      expect(gradeMatch({ a: '1' }, { a: '1', b: '2' })).toBe(false);
    });
  });

  describe('gradeCoding', () => {
    it('marks pending when no expected output', () => {
      expect(gradeCoding('whatever', null)).toEqual({ correct: false, pending: true });
      expect(gradeCoding('whatever', '')).toEqual({ correct: false, pending: true });
    });
    it('compares normalized output', () => {
      expect(gradeCoding('  5\n', '5')).toEqual({ correct: true, pending: false });
      expect(gradeCoding({ output: 'HELLO' }, 'hello')).toEqual({ correct: true, pending: false });
      expect(gradeCoding('6', '5')).toEqual({ correct: false, pending: false });
    });
  });

  describe('gradeQuestion', () => {
    it('dispatches by type', () => {
      expect(gradeQuestion({ type: 'mcq', correctAnswer: 1, options: ['a', 'b'] }, 1).correct).toBe(true);
      expect(gradeQuestion({ type: 'fillblank', correctAnswer: 'x' }, 'X').correct).toBe(true);
    });
  });

  describe('gradeQuiz', () => {
    const questions = [
      { _id: 'q1', type: 'mcq', correctAnswer: 1, options: ['a', 'b'], points: 10 },
      { _id: 'q2', type: 'fillblank', correctAnswer: 'cat', points: 10 },
      { _id: 'q3', type: 'dragdrop', correctAnswer: ['1', '2'], points: 10 },
    ];

    it('scores, counts, and passes at >= 70%', () => {
      const res = gradeQuiz(questions, { q1: 1, q2: 'CAT', q3: ['1', '2'] });
      expect(res.score).toBe(30);
      expect(res.total).toBe(30);
      expect(res.correctCount).toBe(3);
      expect(res.passed).toBe(true);
      expect(res.perQuestion).toHaveLength(3);
    });

    it('fails below 70%', () => {
      const res = gradeQuiz(questions, { q1: 0, q2: 'dog', q3: ['2', '1'] });
      expect(res.score).toBe(0);
      expect(res.passed).toBe(false);
    });

    it('passes at exactly 70% (2 of 3 with extra weight)', () => {
      const weighted = [
        { _id: 'a', type: 'mcq', correctAnswer: 0, options: ['x'], points: 70 },
        { _id: 'b', type: 'mcq', correctAnswer: 0, options: ['x'], points: 30 },
      ];
      const res = gradeQuiz(weighted, { a: 0, b: 1 });
      expect(res.score).toBe(70);
      expect(res.total).toBe(100);
      expect(res.passed).toBe(true);
    });

    it('flags pending coding questions', () => {
      const res = gradeQuiz([{ _id: 'c', type: 'coding', correctAnswer: null, points: 10 }], {});
      expect(res.hasPending).toBe(true);
    });
  });
});
