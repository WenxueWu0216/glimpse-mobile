import { formatCount } from '../format';

test.each([
  [0, '0'],
  [999, '999'],
  [1000, '1k'],
  [1234, '1.2k'],
  [9999, '9.9k'],
  [15_800, '15k'],
  [2_400_000, '2.4M'],
])('formatCount(%d) -> %s', (input, expected) => {
  expect(formatCount(input)).toBe(expected);
});
