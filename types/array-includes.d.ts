// Keep Array#includes usable when TypeScript infers an empty fallback (`[]`) as never[].
// This is intentionally limited to the never case; normal arrays retain their element type.
declare global {
  interface Array<T> {
    includes(searchElement: T extends never ? unknown : T, fromIndex?: number): boolean;
  }
}

export {};