export function utcTimestamp(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('utcTimestamp requires a valid Date.');
  }
  return date.toISOString();
}

export function createTimestampSource(start = new Date()) {
  let current = start.getTime();
  return () => {
    const value = new Date(current).toISOString();
    current += 1;
    return value;
  };
}
