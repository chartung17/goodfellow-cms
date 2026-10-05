/** Builds Puck select/radio options from a map of value → label. */
export function options<T extends string>(labels: Record<T, string>): Array<{ value: T; label: string }> {
  return (Object.entries(labels) as Array<[T, string]>).map(([value, label]) => ({ value, label }));
}

export const yesNo = [
  { value: true, label: "Yes" },
  { value: false, label: "No" },
];

export type Gap = "none" | "sm" | "md" | "lg";

export const gapLabels: Record<Gap, string> = { none: "None", sm: "Small", md: "Medium", lg: "Large" };

export const gapClasses: Record<Gap, string> = { none: "gap-0", sm: "gap-3", md: "gap-6", lg: "gap-10" };
