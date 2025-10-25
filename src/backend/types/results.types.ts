export type DbResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
};