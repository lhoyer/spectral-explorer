/**
 * Embeds the spectrum config inside saved PNGs (tEXt chunk), so a single
 * image file restores its calibration when loaded again.
 */

export const CONFIG_KEYWORD = "SpectralExplorerConfig"

let table: Uint32Array | null = null
function crc32(bytes: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (const b of bytes) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const latin1 = (s: string) => Uint8Array.from(s, (ch) => ch.charCodeAt(0) & 0xff)

export async function addPngText(png: Blob, keyword: string, text: string): Promise<Blob> {
  const buf = new Uint8Array(await png.arrayBuffer())
  const data = latin1(`${keyword}\0${text}`)
  const typeAndData = new Uint8Array(4 + data.length)
  typeAndData.set(latin1("tEXt"), 0)
  typeAndData.set(data, 4)
  const chunk = new Uint8Array(12 + data.length)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, data.length)
  chunk.set(typeAndData, 4)
  view.setUint32(8 + data.length, crc32(typeAndData))
  const iend = buf.length - 12 // IEND is always the last 12 bytes
  const out = new Uint8Array(buf.length + chunk.length)
  out.set(buf.subarray(0, iend), 0)
  out.set(chunk, iend)
  out.set(buf.subarray(iend), iend + chunk.length)
  return new Blob([out], { type: "image/png" })
}

export function readPngText(buf: Uint8Array, keyword: string): string | null {
  const sig = [0x89, 0x50, 0x4e, 0x47]
  if (buf.length < 8 || sig.some((v, i) => buf[i] !== v)) return null
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let p = 8
  while (p + 8 <= buf.length) {
    const len = view.getUint32(p)
    const type = String.fromCharCode(...buf.subarray(p + 4, p + 8))
    if (type === "tEXt") {
      const data = buf.subarray(p + 8, p + 8 + len)
      const zero = data.indexOf(0)
      if (zero > 0 && String.fromCharCode(...data.subarray(0, zero)) === keyword) {
        let s = ""
        for (const b of data.subarray(zero + 1)) s += String.fromCharCode(b)
        return s
      }
    }
    if (type === "IEND") break
    p += 12 + len
  }
  return null
}
