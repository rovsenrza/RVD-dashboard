import pg from 'pg'

export type Db = pg.Pool

/** `schema` pins the search path: tests run each suite in a schema of its own. */
export function createPool(url: string, schema?: string): Db {
  return new pg.Pool({
    connectionString: url,
    max: 10,
    ...(schema ? { options: `-c search_path=${schema},public` } : {}),
  })
}
