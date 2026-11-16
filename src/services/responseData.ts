import type { ApiResponse } from "@/types/common";

export type ApiDataResponse<T> = ApiResponse<T> | T;

export function unwrapApiData<T extends object>(response: ApiDataResponse<T>): T {
  // The live quotation APIs return the payload directly until the backend deploys.
  if (!("success" in response)) return response;
  if (!response.success || response.data == null) throw new Error(response.message);

  return response.data;
}
