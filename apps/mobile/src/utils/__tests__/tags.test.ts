import { addTag, MAX_TAGS, normalizeTag } from '../tags';

test('normalizeTag strips punctuation, spaces and case', () => {
  expect(normalizeTag('  #Coffee Shop! ')).toBe('coffeeshop');
  expect(normalizeTag('探店')).toBe('探店');
  expect(normalizeTag('#')).toBe('');
});

test('addTag ignores empties, duplicates and overflow', () => {
  expect(addTag(['a'], 'B')).toEqual(['a', 'b']);
  const same = ['a'];
  expect(addTag(same, '#A')).toBe(same);
  expect(addTag(same, '  ')).toBe(same);
  const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`);
  expect(addTag(full, 'extra')).toBe(full);
});
