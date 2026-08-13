export const logger = {
  warn(...args: unknown[]): void {
    if (__DEV__) {
      console.warn(...args);
    }
  },
  error(...args: unknown[]): void {
    if (__DEV__) {
      console.error(...args);
    }
  },
};
