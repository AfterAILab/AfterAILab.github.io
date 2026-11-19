// JavaScriptCore (Kakiaji) has no `console`; libraries that log through it would throw. Messages are dropped.
const g = globalThis as { console?: Partial<Console> };
if (!g.console) {
  const drop = () => {};
  g.console = { log: drop, info: drop, warn: drop, error: drop, debug: drop };
}
export {};
