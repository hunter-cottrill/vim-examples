import type { ApiResponse } from '@vimconnect/app-sdk';

/**
 * Unwrap the Entity API's { success, data } envelope. Types-only SDK import,
 * so this does not constitute a third SDK boundary.
 *
 * `success: false` is thrown rather than returned so it flows into the same
 * retry-then-fall-back handling as a rejection — both mean "we do not have
 * this data yet", and neither may be reported as an empty list.
 */
export async function unwrap<T>(call: Promise<ApiResponse<T>>): Promise<T> {
  const response = await call;
  if (!response.success) throw new Error('Entity API call returned success: false');
  return response.data;
}
