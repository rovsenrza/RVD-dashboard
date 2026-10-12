/**
 * Serial numbers come as 1С keeps them, with leading zeros («000002209»); people
 * type them without. An exact match ignores the zeros on both sides.
 */
export const serialKey = (serial: string) =>
  serial
    .trim()
    .toLowerCase()
    .replace(/^0+(?=\d)/, '')

export const sameSerial = (serial: string, typed: string) => serialKey(serial) === serialKey(typed)
