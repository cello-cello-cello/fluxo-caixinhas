import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let value = n
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})

function crc32(buffer) {
  let value = 0xffffffff
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  }
  return (value ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, checksum])
}

function makeIcon(size, maskable) {
  const rowBytes = size * 3
  const raw = Buffer.alloc((rowBytes + 1) * size)
  const navy = [30, 58, 95]
  const moss = [74, 107, 83]
  const white = [255, 255, 255]
  const outer = maskable ? 0.34 : 0.42
  const inner = outer - 0.09

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (rowBytes + 1)
    raw[rowStart] = 0
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5 - size / 2) / size
      const dy = (y + 0.5 - size / 2) / size
      const distance = Math.sqrt(dx * dx + dy * dy)
      const isRing = distance <= outer && distance >= inner
      const isDot = distance <= 0.075
      const color = isDot ? moss : isRing ? white : navy
      const index = rowStart + 1 + x * 3
      raw[index] = color[0]
      raw[index + 1] = color[1]
      raw[index + 2] = color[2]
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 2

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const icons = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-192.png', 192, true],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
]

for (const [name, size, maskable] of icons) {
  writeFileSync(join(process.cwd(), 'public', name), makeIcon(size, maskable))
}
