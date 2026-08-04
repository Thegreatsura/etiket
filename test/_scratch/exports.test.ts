import { it } from "vitest"
import { writeFileSync } from "node:fs"
import * as etiket from "../../src/index"

it("dumps", () => {
  writeFileSync("/tmp/claude-1002/exports.txt", Object.keys(etiket).sort().join("\n"))
})
