// SDKError is declared in the SDK's type definitions but isn't actually
// exported by the compiled runtime bundle, so `instanceof SDKError` isn't
// usable here — check the error's shape instead.
export function isSdkErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === code
  );
}
