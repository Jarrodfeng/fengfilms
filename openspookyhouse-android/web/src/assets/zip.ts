// Minimal ZIP reader (stored + deflate) built on DecompressionStream, so a
// zipped copy of the game files can be imported in one go.

const u16 = (d: DataView, o: number) => d.getUint16(o, true);
const u32 = (d: DataView, o: number) => d.getUint32(o, true);

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function isZip(data: Uint8Array): boolean {
  return data.length > 4 && data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04;
}

/** Returns base file name -> contents for every file in the archive. */
export async function unzip(data: Uint8Array, wanted?: (name: string) => boolean): Promise<Map<string, Uint8Array>> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // Find the end-of-central-directory record
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a valid ZIP file');
  const count = u16(view, eocd + 10);
  let p = u32(view, eocd + 16);
  const out = new Map<string, Uint8Array>();
  for (let n = 0; n < count; n++) {
    if (u32(view, p) !== 0x02014b50) break;
    const method = u16(view, p + 10);
    const csize = u32(view, p + 20);
    const nameLen = u16(view, p + 28);
    const extraLen = u16(view, p + 30);
    const commentLen = u16(view, p + 32);
    const local = u32(view, p + 42);
    const fullName = new TextDecoder().decode(data.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const name = fullName.split(/[\\/]/).pop() ?? '';
    if (!name || (wanted && !wanted(name))) continue;
    const lNameLen = u16(view, local + 26);
    const lExtraLen = u16(view, local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const raw = data.subarray(start, start + csize);
    if (method === 0) out.set(name, raw.slice());
    else if (method === 8) out.set(name, await inflateRaw(raw));
  }
  return out;
}
