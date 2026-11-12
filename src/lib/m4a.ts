/**
 * Duration (in seconds) of an MP4/M4A file, read from the movie header box (moov > mvhd).
 * Enough for the AAC files scripts/weekly-audio.sh writes; throws on anything it cannot read.
 */
export function m4aDurationSeconds(data: Buffer): number {
  const moov = findBox(data, 0, data.length, 'moov');
  const mvhd = moov && findBox(data, moov.start, moov.end, 'mvhd');
  if (!mvhd) throw new Error('no moov/mvhd box');
  const version = data.readUInt8(mvhd.start);
  // version 0: creation(4) modification(4) timescale(4) duration(4); version 1: 8 / 8 / 4 / 8.
  const timescale = data.readUInt32BE(mvhd.start + (version === 1 ? 20 : 12));
  const duration =
    version === 1 ? Number(data.readBigUInt64BE(mvhd.start + 24)) : data.readUInt32BE(mvhd.start + 16);
  if (!timescale) throw new Error('mvhd timescale is 0');
  return duration / timescale;
}

/** The payload range of the first box of `type` among the boxes in [from, to). */
function findBox(data: Buffer, from: number, to: number, type: string): { start: number; end: number } | undefined {
  let at = from;
  while (at + 8 <= to) {
    let size = data.readUInt32BE(at);
    let header = 8;
    if (size === 1) {
      size = Number(data.readBigUInt64BE(at + 8));
      header = 16;
    } else if (size === 0) {
      size = to - at;
    }
    if (size < header) break;
    if (data.toString('latin1', at + 4, at + 8) === type) return { start: at + header, end: at + size };
    at += size;
  }
  return undefined;
}
