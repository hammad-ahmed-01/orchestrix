export function calculateDurationMs(
  startedAt: string,
  completedAt: string | undefined,
): number | undefined {
  if (completedAt === undefined) {
    return undefined;
  }

  const startedMs = Date.parse(startedAt);
  const completedMs = Date.parse(completedAt);

  if (Number.isNaN(startedMs) || Number.isNaN(completedMs)) {
    return undefined;
  }

  return Math.max(0, completedMs - startedMs);
}
