import { describe, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import {
  encodeMaxiCode,
  encodeGS1DataBarOmni,
  encodeGS1DataBarLimited,
  encodeGS1DataBarExpanded,
} from "../src/index"
import { renderMaxiCodeRaster } from "../src/renderers/png/rasterize"
import { toBitmap } from "bwip-js/node"

function barsToImageData(bars: number[], barWidth = 4, height = 100, margin = 40) {
  let totalModules = 0
  for (const w of bars) totalModules += w
  const imgWidth = totalModules * barWidth + margin * 2
  const imgHeight = height + margin * 2
  const data = new Uint8ClampedArray(imgWidth * imgHeight * 4)
  data.fill(255)
  let x = margin
  let isBar = true
  for (const w of bars) {
    if (isBar) {
      const barEnd = x + w * barWidth
      for (let py = margin; py < margin + height; py++) {
        for (let px = x; px < barEnd && px < imgWidth; px++) {
          const idx = (py * imgWidth + px) * 4
          data[idx] = 0
          data[idx + 1] = 0
          data[idx + 2] = 0
          data[idx + 3] = 255
        }
      }
    }
    x += w * barWidth
    isBar = !isBar
  }
  return { data, width: imgWidth, height: imgHeight }
}

async function dec1d(bars: number[], opts: Record<string, unknown> = {}) {
  const img = barsToImageData(bars)
  const r = await readBarcodes(img as unknown as ImageData, { tryHarder: true, ...opts })
  return r.map((x) => [x.format, x.text, x.isValid])
}

function maxiToImageData(matrix: boolean[][], moduleSize = 12, margin = 3) {
  const { width, height, rows } = renderMaxiCodeRaster(matrix, { moduleSize, margin })
  const data = new Uint8ClampedArray(width * height * 4)
  data.fill(255)
  for (let y = 0; y < height; y++) {
    const row = rows[y]!
    for (let x = 0; x < width; x++) {
      if (row[x]) {
        const idx = (y * width + x) * 4
        data[idx] = 0
        data[idx + 1] = 0
        data[idx + 2] = 0
      }
    }
  }
  return { data, width, height }
}

async function decMaxi(matrix: boolean[][]) {
  const img = maxiToImageData(matrix)
  const r = await readBarcodes(img as unknown as ImageData, {
    tryHarder: true,
    formats: ["MaxiCode"],
  })
  return r.map((x) => [x.format, JSON.stringify(x.text), x.isValid])
}

function bwipBars(bcid: string, text: string, opts: Record<string, unknown> = {}): number[] {
  const bm = toBitmap({ bcid, text, scale: 1, height: 10, ...opts }) as unknown as {
    data: Uint8Array
    width: number
    height: number
  }
  // Read the top row run-lengths
  const row: number[] = []
  const w = bm.width
  let run = 0
  let cur = bm.data[0]
  for (let x = 0; x < w; x++) {
    const v = bm.data[x]
    if (v === cur) run++
    else {
      row.push(run)
      run = 1
      cur = v
    }
  }
  row.push(run)
  return row
}

describe("scratch", () => {
  it("maxicode variations", async () => {
    console.log("mode4 THIS IS A TEST", JSON.stringify(await decMaxi(encodeMaxiCode("THIS IS A TEST"))))
    console.log("mode4 ABCDEFGHIJKLMNOP", JSON.stringify(await decMaxi(encodeMaxiCode("ABCDEFGHIJKLMNOP"))))
    console.log("mode4 A", JSON.stringify(await decMaxi(encodeMaxiCode("A"))))
    console.log("mode4 0123456789", JSON.stringify(await decMaxi(encodeMaxiCode("0123456789"))))
    console.log("mode5 TEST", JSON.stringify(await decMaxi(encodeMaxiCode("TEST", { mode: 5 }))))
    console.log(
      "mode2",
      JSON.stringify(
        await decMaxi(
          encodeMaxiCode("TESTING", {
            mode: 2,
            postalCode: "152382802",
            countryCode: 840,
            serviceClass: 1,
          }),
        ),
      ),
    )
    console.log(
      "mode3",
      JSON.stringify(
        await decMaxi(
          encodeMaxiCode("TESTING", {
            mode: 3,
            postalCode: "AB1 2CD",
            countryCode: 826,
            serviceClass: 1,
          }),
        ),
      ),
    )
  })

  it("databar valid gtins", async () => {
    console.log("omni", JSON.stringify(await dec1d(encodeGS1DataBarOmni("01234567890128"))))
    console.log("ltd", JSON.stringify(await dec1d(encodeGS1DataBarLimited("01234567890128"))))
    console.log("exp", JSON.stringify(await dec1d(encodeGS1DataBarExpanded("(01)90012345678908"))))
  })

  it("databar vs bwip", async () => {
    const ours = encodeGS1DataBarOmni("01234567890128")
    const theirs = bwipBars("databaromni", "01234567890128")
    console.log("ours ", ours.join(","), "sum", ours.reduce((a, b) => a + b, 0))
    console.log("bwip ", theirs.join(","), "sum", theirs.reduce((a, b) => a + b, 0))
    console.log("bwip decode", JSON.stringify(await dec1d(theirs.slice(1))))
  })
})
