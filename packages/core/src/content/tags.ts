/**
 * Text with HTML tags taken out, each replaced by what `replace` returns for
 * it (nothing, by default). A `<` that never closes stays as text. The result
 * is plain text, not HTML: escape it before putting it in a page.
 */
export function withoutTags(html: string, replace: (tag: string) => string = () => ""): string {
  let result = "";
  let from = 0;
  for (;;) {
    const start = html.indexOf("<", from);
    const end = start === -1 ? -1 : html.indexOf(">", start);
    if (end === -1) return result + html.slice(from);
    result += html.slice(from, start) + replace(html.slice(start, end + 1));
    from = end + 1;
  }
}
