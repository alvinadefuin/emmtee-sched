const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID.test(value);

export const isId = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;
