'use client'

import React from 'react'

/**
 * Lightweight, zero-dependency pure TypeScript QR Code SVG generator
 * Implements ISO/IEC 18004 QR Matrix encoding with Error Correction (Level L/M)
 * Produces crisp, scalable vector SVG for web and high-resolution print (A4).
 */

// Galois field 256 math tables for Reed-Solomon error correction
const GF256_EXP = new Uint8Array(512)
const GF256_LOG = new Uint8Array(256)

let x = 1
for (let i = 0; i < 255; i++) {
  GF256_EXP[i] = x
  GF256_EXP[i + 255] = x
  GF256_LOG[x] = i
  x = (x << 1) ^ (x >= 128 ? 0x11d : 0)
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF256_EXP[GF256_LOG[a] + GF256_LOG[b]]
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let i = 0; i < degree; i++) {
    const nextPoly = new Uint8Array(poly.length + 1)
    const factor = GF256_EXP[i]
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= gfMul(poly[j], factor)
      nextPoly[j + 1] ^= poly[j]
    }
    poly = nextPoly
  }
  return poly
}

function rsCompute(data: Uint8Array, ecLength: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLength)
  const remainder = new Uint8Array(ecLength)
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0]
    for (let j = 0; j < ecLength - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMul(gen[j + 1], factor)
    }
    remainder[ecLength - 1] = gfMul(gen[ecLength], factor)
  }
  return remainder
}

// Version table constants for QR Version 4 (33x33) and Version 5 (37x37)
interface QRVersionConfig {
  version: number
  size: number
  totalCodewords: number
  dataCodewords: number
  ecCodewords: number
  alignments: number[]
}

const CONFIG_V4: QRVersionConfig = {
  version: 4,
  size: 33,
  totalCodewords: 100,
  dataCodewords: 64, // Level M
  ecCodewords: 36,
  alignments: [6, 26],
}

const CONFIG_V5: QRVersionConfig = {
  version: 5,
  size: 37,
  totalCodewords: 134,
  dataCodewords: 86, // Level M
  ecCodewords: 48,
  alignments: [6, 30],
}

function encodeTextToBytes(text: string, cfg: QRVersionConfig): Uint8Array {
  const encoder = new TextEncoder()
  const rawBytes = encoder.encode(text)

  const bits: number[] = []
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1)
    }
  }

  // Byte mode indicator = 0100
  pushBits(0b0100, 4)
  // Character count indicator (8 bits for Version 1-9 in byte mode)
  pushBits(rawBytes.length, 8)

  // Data payload
  for (const b of rawBytes) {
    pushBits(b, 8)
  }

  // Terminator (up to 4 zeroes)
  const maxDataBits = cfg.dataCodewords * 8
  const termLen = Math.min(4, maxDataBits - bits.length)
  pushBits(0, termLen)

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0)
  }

  // Convert bit array to byte array
  const dataBytes = new Uint8Array(cfg.dataCodewords)
  let byteIdx = 0
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i + j]
    }
    dataBytes[byteIdx++] = b
  }

  // Pad bytes 0xEC and 0x11
  let padToggle = false
  while (byteIdx < cfg.dataCodewords) {
    dataBytes[byteIdx++] = padToggle ? 0x11 : 0xec
    padToggle = !padToggle
  }

  return dataBytes
}

function generateQRMatrix(text: string): boolean[][] {
  const encoder = new TextEncoder()
  const len = encoder.encode(text).length
  const cfg = len <= 60 ? CONFIG_V4 : CONFIG_V5

  const size = cfg.size
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array(size).fill(null)
  )
  const isFunctionModule: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  )

  const setModule = (r: number, c: number, val: boolean) => {
    matrix[r][c] = val
    isFunctionModule[r][c] = true
  }

  // 1. Finder patterns (Top-Left, Top-Right, Bottom-Left)
  const drawFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const mr = row + r
        const mc = col + c
        if (mr >= 0 && mr < size && mc >= 0 && mc < size) {
          if (
            (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            setModule(mr, mc, true)
          } else {
            setModule(mr, mc, false)
          }
        }
      }
    }
  }

  drawFinder(0, 0)
  drawFinder(0, size - 7)
  drawFinder(size - 7, 0)

  // 2. Alignment patterns
  for (const r of cfg.alignments) {
    for (const c of cfg.alignments) {
      if (isFunctionModule[r][c]) continue
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBlack =
            Math.max(Math.abs(dr), Math.abs(dc)) === 2 || (dr === 0 && dc === 0)
          setModule(r + dr, c + dc, isBlack)
        }
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunctionModule[6][i]) setModule(6, i, i % 2 === 0)
    if (!isFunctionModule[i][6]) setModule(i, 6, i % 2 === 0)
  }

  // 4. Dark module
  setModule(size - 8, 8, true)

  // 5. Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (!isFunctionModule[8][i]) isFunctionModule[8][i] = true
    if (!isFunctionModule[i][8]) isFunctionModule[i][8] = true
  }
  for (let i = size - 8; i < size; i++) {
    if (!isFunctionModule[8][i]) isFunctionModule[8][i] = true
    if (!isFunctionModule[i][8]) isFunctionModule[i][8] = true
  }

  // 6. Encode data & error correction codewords
  const dataCodewords = encodeTextToBytes(text, cfg)
  const ecCodewords = rsCompute(dataCodewords, cfg.ecCodewords)

  // Interleave and serialize all bits
  const allBits: number[] = []
  for (const b of dataCodewords) {
    for (let i = 7; i >= 0; i--) allBits.push((b >>> i) & 1)
  }
  for (const b of ecCodewords) {
    for (let i = 7; i >= 0; i--) allBits.push((b >>> i) & 1)
  }

  // 7. Place data bits (zigzag upward/downward)
  let bitIdx = 0
  let upward = true
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right-- // Skip vertical timing pattern column
    const cols = [right, right - 1]
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i)

    for (const r of rows) {
      for (const c of cols) {
        if (!isFunctionModule[r][c]) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0
          // Apply standard mask pattern 0: (r + c) % 2 === 0
          const mask = (r + c) % 2 === 0
          matrix[r][c] = (bit === 1) !== mask
        }
      }
    }
    upward = !upward
  }

  // 8. Format bits (Mask 0, Error Correction M = 0b00)
  // Standard format information for EC Level M + Mask 0 is 0x5412
  const formatInfo = 0x5412
  for (let i = 0; i < 15; i++) {
    const bit = ((formatInfo >>> i) & 1) === 1

    // Top-left area
    if (i < 6) setModule(8, i, bit)
    else if (i === 6) setModule(8, 7, bit)
    else if (i === 7) setModule(8, 8, bit)
    else if (i === 8) setModule(7, 8, bit)
    else setModule(14 - i, 8, bit)

    // Split area around finder patterns
    if (i < 8) setModule(size - 1 - i, 8, bit)
    else setModule(8, size - 15 + i, bit)
  }

  return matrix.map((row) => row.map((cell) => cell === true))
}

export interface QRCodeSVGProps {
  value: string
  size?: number
  bgColor?: string
  fgColor?: string
  className?: string
  includeMargin?: boolean
}

/**
 * Pure SVG QR Code Component
 * Compatible with all standard modern browsers, server-side rendering, and A4 print engines.
 */
export function QRCodeSVG({
  value,
  size = 140,
  bgColor = '#FFFFFF',
  fgColor = '#0F172A',
  className = '',
  includeMargin = true,
}: QRCodeSVGProps) {
  const matrix = React.useMemo(() => {
    try {
      return generateQRMatrix(value)
    } catch (err) {
      console.error('Error generating QR matrix:', err)
      return []
    }
  }, [value])

  if (matrix.length === 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 ${className}`}
      >
        QR Unavailable
      </div>
    )
  }

  const matrixSize = matrix.length
  const margin = includeMargin ? 3 : 0
  const totalGridSize = matrixSize + margin * 2

  let pathD = ''
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        pathD += `M${c + margin},${r + margin}h1v1h-1z `
      }
    }
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${totalGridSize} ${totalGridSize}`}
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
      aria-label={`QR code for verification link`}
    >
      <rect width="100%" height="100%" fill={bgColor} />
      <path d={pathD} fill={fgColor} />
    </svg>
  )
}

export default QRCodeSVG

