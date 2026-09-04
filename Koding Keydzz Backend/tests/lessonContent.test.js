import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { worldSchema, lessonSchema } from '../src/utils/validators.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lessonContent = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'src', 'seed', 'lessonContent.json'),
    'utf8'
  )
);

describe('lessonContent.json', () => {
  it('has the 5 expected world slugs and 16 lessons total', () => {
    const slugs = Object.keys(lessonContent);
    expect(slugs.sort()).toEqual(
      [
        'algorithm-desert',
        'coding-forest',
        'function-castle',
        'loop-mountain',
        'python-kingdom',
      ].sort()
    );
    const total = slugs.reduce((n, s) => n + lessonContent[s].length, 0);
    expect(total).toBe(16);
  });

  it('every lesson has a title, order and a rich body', () => {
    for (const slug of Object.keys(lessonContent)) {
      for (const lesson of lessonContent[slug]) {
        expect(typeof lesson.title).toBe('string');
        expect(lesson.title.length).toBeGreaterThan(0);
        expect(typeof lesson.order).toBe('number');
        expect(lesson.body).toBeTruthy();
        expect(typeof lesson.body.intro).toBe('string');
        expect(lesson.body.intro.length).toBeGreaterThan(0);
        expect(Array.isArray(lesson.body.sections)).toBe(true);
        expect(lesson.body.sections.length).toBeGreaterThan(0);
        expect(lesson.body.tryIt).toBeTruthy();
      }
    }
  });
});

describe('worldSchema', () => {
  it('accepts a valid world', () => {
    const parsed = worldSchema.parse({
      name: 'Coding Forest',
      slug: 'coding-forest',
      order: 1,
      topics: ['Variables'],
      description: 'A world',
      requiredLevel: 1,
      icon: 'forest',
    });
    expect(parsed.slug).toBe('coding-forest');
  });

  it('rejects a bad slug (uppercase / spaces)', () => {
    expect(worldSchema.safeParse({ name: 'X', slug: 'Bad Slug' }).success).toBe(false);
    expect(worldSchema.safeParse({ name: 'X', slug: 'UPPER' }).success).toBe(false);
  });
});

describe('lessonSchema', () => {
  const fullBody = {
    tagline: 'A tagline',
    intro: 'An intro',
    sections: [{ heading: 'H', body: 'B', bullets: ['one', 'two'] }],
    snippet: { language: 'python', lines: ['print(1)'], caption: 'cap' },
    tryIt: { language: 'python', starter: 'x = 1', challenge: 'do it', hint: 'a hint' },
    guide: [{ step: 'Step 1', body: 'Do this' }],
    takeaways: ['learned a lot'],
  };

  it('accepts a lesson WITH a full body', () => {
    const res = lessonSchema.safeParse({
      world: '507f1f77bcf86cd799439011',
      title: 'Variables',
      content: 'intro',
      order: 1,
      language: 'python',
      body: fullBody,
    });
    expect(res.success).toBe(true);
  });

  it('accepts { body } alone through .partial()', () => {
    const res = lessonSchema.partial().safeParse({ body: fullBody });
    expect(res.success).toBe(true);
  });
});
