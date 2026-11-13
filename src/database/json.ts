export function toJsonText(value: unknown): string {
  return JSON.stringify(value);
}

export function fromJsonText(text: string): unknown {
  return JSON.parse(text) as unknown;
}

export function fromNullableJsonText(text: string | null): unknown {
  if (text === null) {
    return undefined;
  }

  return fromJsonText(text);
}

export function toNullableJsonText(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  return toJsonText(value);
}
