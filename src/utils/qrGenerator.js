// Автономный pure-JS генератор QR-кодов (ISO/IEC 18004, Model 2, Byte mode, EC Level L, v1-v20)
// Работает 100% оффлайн без внешних зависимостей и CDN.

const QR_VERSIONS_L = [
  null,
  { totalData: 19, ecPerBlock: 7, g1Blocks: 1, g1Data: 19, g2Blocks: 0, g2Data: 0, align: [] },
  { totalData: 34, ecPerBlock: 10, g1Blocks: 1, g1Data: 34, g2Blocks: 0, g2Data: 0, align: [6, 18] },
  { totalData: 55, ecPerBlock: 15, g1Blocks: 1, g1Data: 55, g2Blocks: 0, g2Data: 0, align: [6, 22] },
  { totalData: 80, ecPerBlock: 20, g1Blocks: 1, g1Data: 80, g2Blocks: 0, g2Data: 0, align: [6, 26] },
  { totalData: 108, ecPerBlock: 26, g1Blocks: 1, g1Data: 108, g2Blocks: 0, g2Data: 0, align: [6, 30] },
  { totalData: 136, ecPerBlock: 18, g1Blocks: 2, g1Data: 68, g2Blocks: 0, g2Data: 0, align: [6, 34] },
  { totalData: 156, ecPerBlock: 20, g1Blocks: 2, g1Data: 78, g2Blocks: 0, g2Data: 0, align: [6, 22, 38] },
  { totalData: 194, ecPerBlock: 24, g1Blocks: 2, g1Data: 97, g2Blocks: 0, g2Data: 0, align: [6, 24, 42] },
  { totalData: 232, ecPerBlock: 30, g1Blocks: 2, g1Data: 116, g2Blocks: 0, g2Data: 0, align: [6, 26, 46] },
  { totalData: 274, ecPerBlock: 18, g1Blocks: 2, g1Data: 68, g2Blocks: 2, g2Data: 69, align: [6, 28, 50] },
  { totalData: 324, ecPerBlock: 20, g1Blocks: 4, g1Data: 81, g2Blocks: 0, g2Data: 0, align: [6, 30, 54] },
  { totalData: 370, ecPerBlock: 24, g1Blocks: 2, g1Data: 92, g2Blocks: 2, g2Data: 93, align: [6, 32, 58] },
  { totalData: 428, ecPerBlock: 26, g1Blocks: 4, g1Data: 107, g2Blocks: 0, g2Data: 0, align: [6, 34, 62] },
  { totalData: 461, ecPerBlock: 30, g1Blocks: 3, g1Data: 115, g2Blocks: 1, g2Data: 116, align: [6, 26, 46, 66] },
  { totalData: 523, ecPerBlock: 22, g1Blocks: 5, g1Data: 87, g2Blocks: 1, g2Data: 88, align: [6, 26, 48, 70] },
  { totalData: 589, ecPerBlock: 24, g1Blocks: 5, g1Data: 98, g2Blocks: 1, g2Data: 99, align: [6, 26, 50, 74] },
  { totalData: 647, ecPerBlock: 28, g1Blocks: 1, g1Data: 107, g2Blocks: 5, g2Data: 108, align: [6, 30, 54, 78] },
  { totalData: 721, ecPerBlock: 30, g1Blocks: 5, g1Data: 120, g2Blocks: 1, g2Data: 121, align: [6, 30, 56, 82] },
  { totalData: 795, ecPerBlock: 28, g1Blocks: 3, g1Data: 113, g2Blocks: 4, g2Data: 114, align: [6, 30, 58, 86] },
  { totalData: 861, ecPerBlock: 28, g1Blocks: 3, g1Data: 107, g2Blocks: 5, g2Data: 108, align: [6, 34, 62, 90] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]);

const buildRsGeneratorPoly = (degree) => {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
};

const computeRsEcBytes = (dataBytes, ecCount) => {
  const gen = buildRsGeneratorPoly(ecCount);
  const res = new Uint8Array(ecCount);
  for (let i = 0; i < dataBytes.length; i++) {
    const factor = dataBytes[i] ^ res[0];
    for (let j = 0; j < ecCount - 1; j++) {
      res[j] = res[j + 1];
    }
    res[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j++) {
        res[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return res;
};

const computeFormatBitsL = (maskId) => {
  const data = (0b01 << 3) | (maskId & 0x7); // EC Level L = 01
  let d = data << 10;
  for (let i = 4; i >= 0; i--) {
    if (d & (1 << (i + 10))) {
      d ^= 0x537 << i;
    }
  }
  return ((data << 10) | d) ^ 0x5412;
};

const computeVersionBits = (version) => {
  let d = version << 12;
  for (let i = 5; i >= 0; i--) {
    if (d & (1 << (i + 12))) {
      d ^= 0x1f25 << i;
    }
  }
  return (version << 12) | d;
};

const MASK_FNS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

const scoreMaskPenalty = (matrix) => {
  const n = matrix.length;
  let penalty = 0;

  // Rule 1: 5+ consecutive same-color modules in row/col
  for (let r = 0; r < n; r++) {
    let runColor = matrix[r][0];
    let runLen = 1;
    for (let c = 1; c < n; c++) {
      if (matrix[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = matrix[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  for (let c = 0; c < n; c++) {
    let runColor = matrix[0][c];
    let runLen = 1;
    for (let r = 1; r < n; r++) {
      if (matrix[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = matrix[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 blocks
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = matrix[r][c];
      if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // Rule 3: 1:1:3:1:1 finder-like patterns
  const matchP1 = (arr, i) =>
    arr[i] === 1 && arr[i + 1] === 0 && arr[i + 2] === 1 && arr[i + 3] === 1 && arr[i + 4] === 1 &&
    arr[i + 5] === 0 && arr[i + 6] === 1 && arr[i + 7] === 0 && arr[i + 8] === 0 && arr[i + 9] === 0 && arr[i + 10] === 0;
  const matchP2 = (arr, i) =>
    arr[i] === 0 && arr[i + 1] === 0 && arr[i + 2] === 0 && arr[i + 3] === 0 && arr[i + 4] === 1 &&
    arr[i + 5] === 0 && arr[i + 6] === 1 && arr[i + 7] === 1 && arr[i + 8] === 1 && arr[i + 9] === 0 && arr[i + 10] === 1;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c <= n - 11; c++) {
      if (matchP1(matrix[r], c) || matchP2(matrix[r], c)) penalty += 40;
    }
  }
  const colArr = new Uint8Array(n);
  for (let c = 0; c < n; c++) {
    for (let r = 0; r < n; r++) colArr[r] = matrix[r][c];
    for (let r = 0; r <= n - 11; r++) {
      if (matchP1(colArr, r) || matchP2(colArr, r)) penalty += 40;
    }
  }

  // Rule 4: dark ratio deviation from 50%
  let dark = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (matrix[r][c]) dark++;
  }
  const pct = (dark * 100) / (n * n);
  const k = Math.min(Math.abs(Math.floor(pct / 5) * 5 - 50), Math.abs(Math.ceil(pct / 5) * 5 - 50));
  penalty += (k / 5) * 10;

  return penalty;
};

const createBaseMatrix = (version) => {
  const spec = QR_VERSIONS_L[version];
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Uint8Array(size));
  const isFunc = Array.from({ length: size }, () => new Uint8Array(size));

  const setFunc = (r, c, val) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = val ? 1 : 0;
      isFunc[r][c] = 1;
    }
  };

  // Finder patterns + 1px white separators
  const placeFinder = (top, left) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = top + dr;
        const c = left + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inBox = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const isDark =
          inBox &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        setFunc(r, c, isDark);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment patterns
  const alignPos = spec.align;
  for (let i = 0; i < alignPos.length; i++) {
    for (let j = 0; j < alignPos.length; j++) {
      const ar = alignPos[i];
      const ac = alignPos[j];
      if ((i === 0 && j === 0) || (i === 0 && j === alignPos.length - 1) || (i === alignPos.length - 1 && j === 0)) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isDark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunc(ar + dr, ac + dc, isDark);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Dark module
  setFunc(size - 8, 8, 1);

  // Reserve Format Info slots
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      setFunc(8, i, 0);
      setFunc(i, 8, 0);
    }
  }
  for (let i = 0; i < 8; i++) {
    setFunc(8, size - 1 - i, 0);
  }
  for (let i = 0; i < 7; i++) {
    setFunc(size - 1 - i, 8, 0);
  }

  // Version Info (v >= 7)
  if (version >= 7) {
    const vBits = computeVersionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (vBits >>> i) & 1;
      const a = Math.floor(i / 3);
      const b = (i % 3) + size - 11;
      setFunc(a, b, bit);
      setFunc(b, a, bit);
    }
  }

  return { size, modules, isFunc };
};

const writeFormatBits = (modules, size, maskId) => {
  const fmt = computeFormatBitsL(maskId);
  // Copy 1: top-left
  for (let i = 0; i <= 5; i++) modules[8][i] = (fmt >>> (14 - i)) & 1;
  modules[8][7] = (fmt >>> 8) & 1;
  modules[8][8] = (fmt >>> 7) & 1;
  modules[7][8] = (fmt >>> 6) & 1;
  for (let i = 0; i <= 5; i++) modules[5 - i][8] = (fmt >>> (5 - i)) & 1;

  // Copy 2: bottom-left & top-right
  for (let i = 0; i < 7; i++) modules[size - 1 - i][8] = (fmt >>> (14 - i)) & 1;
  for (let i = 0; i < 8; i++) modules[8][size - 8 + i] = (fmt >>> (7 - i)) & 1;
};

export const encodeQrMatrix = (text) => {
  const utf8 = new TextEncoder().encode(String(text || ''));
  let chosenVersion = -1;

  for (let v = 1; v < QR_VERSIONS_L.length; v++) {
    const capBits = QR_VERSIONS_L[v].totalData * 8;
    const headerBits = v <= 9 ? 12 : 20;
    if (headerBits + utf8.length * 8 <= capBits) {
      chosenVersion = v;
      break;
    }
  }

  if (chosenVersion === -1) {
    return { ok: false, reason: 'TOO_LARGE', byteLength: utf8.length, maxBytes: 858 };
  }

  const spec = QR_VERSIONS_L[chosenVersion];
  const bitBuf = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) {
      bitBuf.push((val >>> i) & 1);
    }
  };

  // Byte mode: 0100 + char count + payload bytes
  pushBits(0b0100, 4);
  pushBits(utf8.length, chosenVersion <= 9 ? 8 : 16);
  for (let i = 0; i < utf8.length; i++) {
    pushBits(utf8[i], 8);
  }

  const maxBits = spec.totalData * 8;
  const termLen = Math.min(4, maxBits - bitBuf.length);
  pushBits(0, termLen);
  while (bitBuf.length % 8 !== 0) bitBuf.push(0);

  const dataBytes = new Uint8Array(spec.totalData);
  for (let i = 0; i < bitBuf.length / 8; i++) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | bitBuf[i * 8 + k];
    dataBytes[i] = b;
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  for (let i = bitBuf.length / 8; i < spec.totalData; i++) {
    dataBytes[i] = padBytes[padIdx % 2];
    padIdx++;
  }

  // Split into blocks & compute Reed-Solomon EC codewords
  const blocks = [];
  let offset = 0;
  for (let i = 0; i < spec.g1Blocks; i++) {
    const slice = dataBytes.subarray(offset, offset + spec.g1Data);
    offset += spec.g1Data;
    blocks.push({ data: slice, ec: computeRsEcBytes(slice, spec.ecPerBlock) });
  }
  for (let i = 0; i < spec.g2Blocks; i++) {
    const slice = dataBytes.subarray(offset, offset + spec.g2Data);
    offset += spec.g2Data;
    blocks.push({ data: slice, ec: computeRsEcBytes(slice, spec.ecPerBlock) });
  }

  // Interleave data and EC codewords
  const codewords = [];
  const maxDataLen = Math.max(spec.g1Data, spec.g2Data);
  for (let col = 0; col < maxDataLen; col++) {
    for (const blk of blocks) {
      if (col < blk.data.length) codewords.push(blk.data[col]);
    }
  }
  for (let col = 0; col < spec.ecPerBlock; col++) {
    for (const blk of blocks) {
      codewords.push(blk.ec[col]);
    }
  }

  const { size, modules: baseModules, isFunc } = createBaseMatrix(chosenVersion);

  // Place data bits in zig-zag order
  let cwIdx = 0;
  let bitInByte = 7;
  let goingUp = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = goingUp ? size - 1 - step : step;
      for (let dx = 0; dx < 2; dx++) {
        const c = right - dx;
        if (isFunc[r][c]) continue;
        let bit = 0;
        if (cwIdx < codewords.length) {
          bit = (codewords[cwIdx] >>> bitInByte) & 1;
          bitInByte--;
          if (bitInByte < 0) {
            bitInByte = 7;
            cwIdx++;
          }
        }
        baseModules[r][c] = bit;
      }
    }
    goingUp = !goingUp;
  }

  // Evaluate 8 masks and choose lowest penalty
  let bestMask = 0;
  let bestPenalty = Infinity;
  let bestMatrix = null;

  for (let m = 0; m < 8; m++) {
    const candidate = baseModules.map(row => new Uint8Array(row));
    const maskFn = MASK_FNS[m];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!isFunc[r][c] && maskFn(r, c)) {
          candidate[r][c] ^= 1;
        }
      }
    }
    writeFormatBits(candidate, size, m);
    const penalty = scoreMaskPenalty(candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = m;
      bestMatrix = candidate;
    }
  }

  return {
    ok: true,
    version: chosenVersion,
    size,
    mask: bestMask,
    matrix: bestMatrix,
  };
};

export const buildQrSvgPath = (matrix) => {
  if (!Array.isArray(matrix)) return '';
  const n = matrix.length;
  const parts = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        parts.push(`M${c},${r}h1v1h-1z`);
      }
    }
  }
  return parts.join('');
};
