export function createMock(spec: unknown): never {
  void spec
  throw new Error('onemock: createMock is not implemented yet')
}
