/**
 * Every public symbol has to appear in the API reference.
 *
 * Documentation drifts silently: a new export ships, nobody writes it up, and
 * the reference quietly stops being a reference. This turns that into a test
 * failure at the moment the export is added.
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import * as etiket from "../src/index"

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8")
}

const API_REFERENCE = read("../docs/api/index.md")
const TYPESCRIPT_PAGE = read("../docs/getting-started/typescript.md")
const INDEX_SOURCE = read("../src/index.ts")

/** The type names `src/index.ts` re-exports, which do not exist at runtime */
function exportedTypeNames(): string[] {
  const names: string[] = []
  for (const block of INDEX_SOURCE.matchAll(/export type \{([^}]*)\}/g)) {
    for (const entry of block[1]!.split(",")) {
      const name = entry
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (name) names.push(name)
    }
  }
  return [...new Set(names)]
}

describe("API reference", () => {
  it("documents every exported value", () => {
    const undocumented = Object.keys(etiket).filter((name) => !API_REFERENCE.includes(name))
    expect(undocumented, "exports missing from docs/api/index.md").toEqual([])
  })

  it("documents a meaningful number of exports", () => {
    // Guards against the reference being emptied or the import breaking
    expect(Object.keys(etiket).length).toBeGreaterThan(150)
  })
})

describe("TypeScript reference", () => {
  it("documents every exported type", () => {
    const undocumented = exportedTypeNames().filter((name) => !TYPESCRIPT_PAGE.includes(name))
    expect(undocumented, "types missing from docs/getting-started/typescript.md").toEqual([])
  })

  it("finds the exported types to check", () => {
    expect(exportedTypeNames().length).toBeGreaterThan(50)
  })
})
