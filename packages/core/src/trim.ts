/**
 * `value` without any of `chars` at its start and end, such as trailing
 * slashes: `trimChars("/repo//", "/")` → `repo`. Patterns such as `/\/+$/`
 * take time that grows with the square of a string's length on long runs
 * that don't reach the end, so trimming walks the string instead.
 */
export function trimChars(value: string, chars: string, { start = true, end = true } = {}): string {
  let from = 0;
  let to = value.length;
  while (start && from < to && chars.includes(value.charAt(from))) from++;
  while (end && to > from && chars.includes(value.charAt(to - 1))) to--;
  return value.slice(from, to);
}
