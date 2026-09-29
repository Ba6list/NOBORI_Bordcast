export type StatePatchOperation = {
  path: (string | number)[];
  value: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createStatePatch(
  base: unknown,
  next: unknown,
  path: (string | number)[] = [],
): StatePatchOperation[] {
  if (Object.is(base, next)) return [];

  if (Array.isArray(base) && Array.isArray(next)) {
    if (base.length !== next.length) return [{ path, value: next }];
    return next.flatMap((value, index) =>
      createStatePatch(base[index], value, [...path, index]),
    );
  }

  if (isPlainObject(base) && isPlainObject(next)) {
    const keys = new Set([...Object.keys(base), ...Object.keys(next)]);
    return [...keys].flatMap((key) =>
      createStatePatch(base[key], next[key], [...path, key]),
    );
  }

  return [{ path, value: next }];
}

export function applyStatePatch<T>(
  base: T,
  operations: StatePatchOperation[],
): T {
  let next = JSON.parse(JSON.stringify(base)) as T;

  for (const operation of operations) {
    if (operation.path.length === 0) {
      next = operation.value as T;
      continue;
    }

    let target = next as Record<string | number, unknown>;
    for (const segment of operation.path.slice(0, -1)) {
      target = target[segment] as Record<string | number, unknown>;
    }
    target[operation.path.at(-1)!] = operation.value;
  }

  return next;
}
