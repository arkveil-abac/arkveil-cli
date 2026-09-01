/** Commander option processor that accumulates repeated flags into an array. */
export function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

/** Commander option processor for comma-separated values; repeats accumulate. */
export function collectList(value: string, previous: string[] = []): string[] {
  return [
    ...previous,
    ...value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  ];
}
