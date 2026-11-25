// Policy: a field of a value parsed from JSON, for the policies that read what GitHub or ghg write.

/** Undefined when the value is not an object or has no such field. */
export function fieldOf(value: unknown, name: string): unknown {
  return typeof value === "object" && value !== null && name in value ? Reflect.get(value, name) : undefined;
}
