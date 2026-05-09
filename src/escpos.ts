import { EpsonRawPayload } from './transport';

export type EscPosAlign = 'left' | 'center' | 'right';
export type EscPosCutMode = 'full' | 'partial';

export class EscPosBuilder {
  private chunks: Uint8Array[] = [];

  public clear() {
    this.chunks = [];
    return this;
  }

  public raw(data: EpsonRawPayload) {
    this.chunks.push(normalizeRawPayload(data));
    return this;
  }

  public initialize() {
    return this.raw([0x1b, 0x40]);
  }

  public text(value: string) {
    return this.raw(encodeUtf8(value));
  }

  public line(value?: string) {
    if (value !== undefined) {
      this.text(value);
    }

    return this.newLine(1);
  }

  public newLine(lines = 1) {
    assertRange('lines', lines, 1, 255);
    return this.raw([0x1b, 0x64, lines]);
  }

  public align(align: EscPosAlign) {
    const mode = align === 'left' ? 0 : align === 'center' ? 1 : 2;
    return this.raw([0x1b, 0x61, mode]);
  }

  public bold(enabled = true) {
    return this.raw([0x1b, 0x45, enabled ? 1 : 0]);
  }

  public underline(mode: 0 | 1 | 2 = 1) {
    assertRange('mode', mode, 0, 2);
    return this.raw([0x1b, 0x2d, mode]);
  }

  public invert(enabled = true) {
    return this.raw([0x1d, 0x42, enabled ? 1 : 0]);
  }

  public characterSize(widthScale = 0, heightScale = 0) {
    assertRange('widthScale', widthScale, 0, 7);
    assertRange('heightScale', heightScale, 0, 7);

    const size = (widthScale << 4) | heightScale;
    return this.raw([0x1d, 0x21, size]);
  }

  public feed(lines = 1) {
    return this.newLine(lines);
  }

  public cut(mode: EscPosCutMode = 'full', feedLines = 3) {
    assertRange('feedLines', feedLines, 0, 255);

    const cutMode = mode === 'full' ? 0 : 1;
    return this.raw([0x1d, 0x56, cutMode, feedLines]);
  }

  public openDrawer(pin: 0 | 1 = 0, onMs = 120, offMs = 240) {
    assertRange('onMs', onMs, 2, 510);
    assertRange('offMs', offMs, 2, 510);

    const pinMode = pin === 0 ? 0 : 1;
    return this.raw([0x1b, 0x70, pinMode, toPulseTicks(onMs), toPulseTicks(offMs)]);
  }

  public beep(repeat = 1, duration = 2) {
    assertRange('repeat', repeat, 1, 9);
    assertRange('duration', duration, 1, 9);
    return this.raw([0x1b, 0x42, repeat, duration]);
  }

  public build() {
    return concatEscPosPayloads(...this.chunks);
  }
}

export function createEscPosBuilder() {
  return new EscPosBuilder();
}

export function concatEscPosPayloads(...payloads: EpsonRawPayload[]) {
  const chunks = payloads.map(normalizeRawPayload);
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);

  const out = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return out;
}

function normalizeRawPayload(data: EpsonRawPayload): Uint8Array {
  if (typeof data === 'string') {
    return encodeUtf8(data);
  }

  if (data instanceof Uint8Array) {
    return data;
  }

  if (Array.isArray(data)) {
    const normalized = data.map((value) => {
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new Error('Parameter "data" is invalid');
      }

      return value;
    });

    return Uint8Array.from(normalized);
  }

  throw new Error('Parameter "data" is invalid');
}

function encodeUtf8(value: string) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value);
  }

  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];

  for (let index = 0; index < encoded.length; index += 1) {
    const current = encoded[index];

    if (current === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(current.charCodeAt(0));
    }
  }

  return Uint8Array.from(bytes);
}

function toPulseTicks(durationMs: number) {
  const ticks = Math.round(durationMs / 2);
  return Math.max(1, Math.min(255, ticks));
}

function assertRange(name: string, value: number, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Parameter "${name}" is invalid`);
  }
}
