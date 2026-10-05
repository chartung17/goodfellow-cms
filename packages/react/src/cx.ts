import { twMerge } from "tailwind-merge";

/**
 * Joins class names, skipping empty values. Conflicting Tailwind classes are
 * resolved in favor of the later one, so put a block's `className` last and
 * whatever an editor types overrides the block's defaults (`py-20` + `py-4` → `py-4`).
 */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return twMerge(classes);
}
