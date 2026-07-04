import { nanoid } from 'nanoid';

/** New unique id for any record. */
export function newId(): string {
  return nanoid(12);
}
