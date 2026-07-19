let clockFn: () => Date = () => new Date();

export function now(): Date {
  return clockFn();
}

export function setClock(fn: () => Date): void {
  clockFn = fn;
}

export function useRealClock(): void {
  clockFn = () => new Date();
}
