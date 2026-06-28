/** Commander option processor that accumulates repeated flags into an array. */
export function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}
