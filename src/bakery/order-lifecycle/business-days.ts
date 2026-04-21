export function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      added += 1;
    }
  }
  return result;
}

export function isBeforeDate(target: Date, reference: Date): boolean {
  return target.getTime() < reference.getTime();
}
