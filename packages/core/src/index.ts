export function createMock(spec: unknown): never {
  void spec // Mark parameter as intentionally unused
  throw new Error('onemock: createMock is not implemented yet')
}
