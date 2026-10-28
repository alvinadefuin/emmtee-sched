export type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export const notNull = <T>(value: T | null): value is T => value !== null;
