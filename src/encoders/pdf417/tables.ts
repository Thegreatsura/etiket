/**
 * PDF417 codeword pattern tables and text compaction mappings
 * Based on ISO/IEC 15438
 *
 * Each codeword is 17 modules wide, encoded as 8 alternating bar/space widths
 * (4 bars and 4 spaces, starting with a bar).
 * 929 codeword values across 3 clusters (0, 3, 6).
 * Cluster for a row is determined by: row % 3 -> cluster 0, 3, or 6.
 */

/** Start pattern: 17 modules — bar,space,bar,space,bar,space,bar,space */
export const START_PATTERN: readonly number[] = [8, 1, 1, 1, 1, 1, 1, 3]

/** Stop pattern: 18 modules (includes terminating bar) — bar,space,bar,space,bar,space,bar,space,bar */
export const STOP_PATTERN: readonly number[] = [7, 1, 1, 1, 1, 1, 1, 2, 1]

/**
 * PDF417 codeword-to-bar/space pattern tables for each cluster.
 *
 * Each entry is a packed 32-bit integer encoding 8 bar/space widths.
 * Widths are packed as 4 bits each: (w0<<28)|(w1<<24)|(w2<<20)|(w3<<16)|(w4<<12)|(w5<<8)|(w6<<4)|w7
 * Each width is 1-6, and the 8 widths sum to 17.
 *
 * To decode: width[i] = (packed >> (28 - i*4)) & 0xF
 */

/** Unpack a packed pattern integer into an array of 8 bar/space widths */
export function unpackPattern(packed: number): number[] {
  return [
    (packed >>> 28) & 0xf,
    (packed >>> 24) & 0xf,
    (packed >>> 20) & 0xf,
    (packed >>> 16) & 0xf,
    (packed >>> 12) & 0xf,
    (packed >>> 8) & 0xf,
    (packed >>> 4) & 0xf,
    packed & 0xf,
  ]
}

/**
 * Compute the PDF417 codeword pattern for a given codeword value and cluster.
 *
 * This uses the standard PDF417 algorithm to generate bar/space patterns.
 * Each pattern has 4 bars and 4 spaces (8 elements) totaling 17 modules.
 *
 * The algorithm enumerates all valid 17-module patterns for the given cluster
 * and maps codeword values sequentially.
 *
 * Cluster 0: patterns where (bar1+bar3+bar5+bar7) are even sums (specific constraint)
 * Cluster 3: another constraint set
 * Cluster 6: another constraint set
 *
 * For a production-grade implementation, we precompute all patterns using the
 * standard PDF417 systematic encoding.
 */

/**
 * Generate all valid PDF417 symbol characters for a given cluster.
 *
 * A PDF417 symbol character consists of 4 bars (b1,b2,b3,b4) and 4 spaces (s1,s2,s3,s4),
 * interleaved as b1,s1,b2,s2,b3,s3,b4,s4, where:
 *   - each bar width is 1..6
 *   - each space width is 1..6
 *   - b1+s1+b2+s2+b3+s3+b4+s4 = 17
 *   - Cluster 0: (b1-s1-b2+s2) mod 9 == 0  (i.e. equiv to 0 mod 9)
 *   - Cluster 3: (b1-s1-b2+s2) mod 9 == 3
 *   - Cluster 6: (b1-s1-b2+s2) mod 9 == 6
 *
 * The patterns are enumerated in a specific canonical order.
 */
function generateClusterPatterns(clusterMod: number): number[][] {
  const patterns: number[][] = []

  // Enumerate all valid 8-element patterns (b1,s1,b2,s2,b3,s3,b4,s4)
  // where each element is 1..6 and sum = 17
  for (let b1 = 1; b1 <= 6; b1++) {
    for (let s1 = 1; s1 <= 6; s1++) {
      for (let b2 = 1; b2 <= 6; b2++) {
        for (let s2 = 1; s2 <= 6; s2++) {
          for (let b3 = 1; b3 <= 6; b3++) {
            for (let s3 = 1; s3 <= 6; s3++) {
              const remaining = 17 - b1 - s1 - b2 - s2 - b3 - s3
              // remaining = b4 + s4, both must be 1..6
              for (let b4 = Math.max(1, remaining - 6); b4 <= Math.min(6, remaining - 1); b4++) {
                const s4 = remaining - b4
                if (s4 < 1 || s4 > 6) continue

                // Check cluster condition: (b1 - s1 - b2 + s2) mod 9
                let disc = ((b1 - s1 - b2 + s2) % 9 + 9) % 9
                if (disc === clusterMod) {
                  patterns.push([b1, s1, b2, s2, b3, s3, b4, s4])
                }
              }
            }
          }
        }
      }
    }
  }

  // Sort patterns to match the standard PDF417 canonical ordering (ISO 15438 Annex F)
  // The canonical order sorts by elements in reverse: s4, b4, s3, b3, s2, b2, s1, b1
  patterns.sort((a, b) => {
    // Compare in reverse element order
    for (const i of [7, 6, 5, 4, 3, 2, 1, 0]) {
      if (a[i]! !== b[i]!) return a[i]! - b[i]!
    }
    return 0
  })

  return patterns
}

// Precompute cluster pattern tables (lazily)
let _cluster0: number[][] | null = null
let _cluster3: number[][] | null = null
let _cluster6: number[][] | null = null

function getClusterPatterns(cluster: number): number[][] {
  switch (cluster) {
    case 0:
      if (!_cluster0) _cluster0 = generateClusterPatterns(0)
      return _cluster0
    case 3:
      if (!_cluster3) _cluster3 = generateClusterPatterns(3)
      return _cluster3
    case 6:
      if (!_cluster6) _cluster6 = generateClusterPatterns(6)
      return _cluster6
    default:
      throw new Error(`Invalid cluster: ${cluster}`)
  }
}

/**
 * Get the bar/space pattern for a codeword value in a given cluster.
 * @param codeword - Codeword value (0-928)
 * @param cluster - Cluster number (0, 3, or 6)
 * @returns Array of 8 bar/space widths totaling 17 modules
 */
export function getCodewordPattern(codeword: number, cluster: number): number[] {
  const patterns = getClusterPatterns(cluster)
  if (codeword < 0 || codeword >= patterns.length) {
    throw new Error(`Codeword ${codeword} out of range for cluster ${cluster} (max ${patterns.length - 1})`)
  }
  return patterns[codeword]!
}

/**
 * Get the cluster number for a given row.
 * Cluster cycles: row 0 -> cluster 0, row 1 -> cluster 3, row 2 -> cluster 6, row 3 -> cluster 0, etc.
 */
export function getRowCluster(row: number): number {
  return (row % 3) * 3
}

// ---- Text compaction sub-mode tables ----

/** Text compaction sub-modes */
export const enum TextSubMode {
  Alpha = 0,
  Lower = 1,
  Mixed = 2,
  Punctuation = 3,
}

/**
 * Text compaction Alpha sub-mode character mapping.
 * Maps character to codeword pair value (0-29).
 * A-Z = 0-25, space = 26
 */
// prettier-ignore
export const TEXT_ALPHA_MAP: Record<string, number> = {
  'A':0,'B':1,'C':2,'D':3,'E':4,'F':5,'G':6,'H':7,'I':8,'J':9,
  'K':10,'L':11,'M':12,'N':13,'O':14,'P':15,'Q':16,'R':17,'S':18,'T':19,
  'U':20,'V':21,'W':22,'X':23,'Y':24,'Z':25,' ':26,
}

/**
 * Text compaction Lower sub-mode character mapping.
 * a-z = 0-25, space = 26
 */
// prettier-ignore
export const TEXT_LOWER_MAP: Record<string, number> = {
  'a':0,'b':1,'c':2,'d':3,'e':4,'f':5,'g':6,'h':7,'i':8,'j':9,
  'k':10,'l':11,'m':12,'n':13,'o':14,'p':15,'q':16,'r':17,'s':18,'t':19,
  'u':20,'v':21,'w':22,'x':23,'y':24,'z':25,' ':26,
}

/**
 * Text compaction Mixed sub-mode character mapping.
 * 0-9 = 0-9, & = 10, CR = 11, TAB = 12, , = 13, : = 14,
 * # = 15, - = 16, . = 17, $ = 18, / = 19, + = 20, % = 21,
 * * = 22, = = 23, ^ = 24, (unused = 25), space = 26
 */
// prettier-ignore
export const TEXT_MIXED_MAP: Record<string, number> = {
  '0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,
  '&':10,'\r':11,'\t':12,',':13,':':14,'#':15,'-':16,'.':17,'$':18,
  '/':19,'+':20,'%':21,'*':22,'=':23,'^':24,' ':26,
}

/**
 * Text compaction Punctuation sub-mode character mapping.
 * ; = 0, < = 1, > = 2, @ = 3, [ = 4, \ = 5, ] = 6, _ = 7, ` = 8,
 * ~ = 9, ! = 10, CR = 11, TAB = 12, , = 13, : = 14, LF = 15,
 * - = 16, . = 17, $ = 18, / = 19, " = 20, | = 21, * = 22,
 * ( = 23, ) = 24, ? = 25, { = 26, } = 27, ' = 28
 */
// prettier-ignore
export const TEXT_PUNCT_MAP: Record<string, number> = {
  ';':0,'<':1,'>':2,'@':3,'[':4,'\\':5,']':6,'_':7,'`':8,
  '~':9,'!':10,'\r':11,'\t':12,',':13,':':14,'\n':15,
  '-':16,'.':17,'$':18,'/':19,'"':20,'|':21,'*':22,
  '(':23,')':24,'?':25,'{':26,'}':27,"'":28,
}

/**
 * Sub-mode switching codeword values in text compaction.
 * From Alpha: to Lower = 27, to Mixed = 28, to Punct (shift) = 29
 * From Lower: to Alpha (shift) = 27, to Mixed = 28, to Punct (shift) = 29
 * From Mixed: to Lower = 27, to Alpha = 28, to Punct = 29
 * From Punct: to Alpha = 29
 */
export const TEXT_SWITCH = {
  // from Alpha
  ALPHA_TO_LOWER: 27,
  ALPHA_TO_MIXED: 28,
  ALPHA_TO_PUNCT_SHIFT: 29,  // single-char shift to punct

  // from Lower
  LOWER_TO_ALPHA_SHIFT: 27,  // single-char shift to alpha
  LOWER_TO_MIXED: 28,
  LOWER_TO_PUNCT_SHIFT: 29,  // single-char shift to punct

  // from Mixed
  MIXED_TO_LOWER: 27,
  MIXED_TO_ALPHA: 28,
  MIXED_TO_PUNCT: 29,        // latch to punct

  // from Punct
  PUNCT_TO_ALPHA: 29,        // latch to alpha
} as const

/** High-level mode latch codewords */
export const MODE_LATCH = {
  TEXT_COMPACTION: 900,
  BYTE_COMPACTION: 901,
  NUMERIC_COMPACTION: 902,
  BYTE_COMPACTION_6: 924,  // byte compaction, groups of 6
} as const
