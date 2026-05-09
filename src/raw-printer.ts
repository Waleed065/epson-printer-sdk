import { EpsonRawPayload, EpsonRawTcpClient } from './transport';

export interface RawTcpPrinterOptions {
  port: number;
  timeout?: number;
  rawTcpClient: EpsonRawTcpClient;
}

export interface RawTcpSendResult {
  success: boolean;
  code: string;
  bytesSent: number;
  statusCode?: number;
  responseData?: string | Uint8Array;
  raw: unknown;
}

export interface RawTcpPrinterError {
  code: string;
  message: string;
  status: number;
  responseText: string;
  error?: Error;
}

class RawTcpPrinter {
  private readonly host: string;
  private readonly port: number;
  private readonly timeout: number;
  private readonly rawTcpClient: EpsonRawTcpClient;

  public onreceive?: (result: RawTcpSendResult) => void;
  public onerror?: (error: RawTcpPrinterError) => void;

  constructor(host: string, options: RawTcpPrinterOptions) {
    if (!options.rawTcpClient) {
      throw new Error('ERROR_PARAMETER');
    }

    if (!Number.isInteger(options.port) || options.port <= 0) {
      throw new Error('ERROR_PARAMETER');
    }

    this.host = host;
    this.port = options.port;
    this.timeout = options.timeout ?? 10000;
    this.rawTcpClient = options.rawTcpClient;
  }

  public async sendRaw(data: EpsonRawPayload): Promise<RawTcpSendResult> {
    const payload = normalizeRawPayload(data);

    try {
      const response = ((await this.rawTcpClient.send({
        host: this.host,
        port: this.port,
        data: payload,
        timeoutMs: this.timeout,
      })) ?? {}) as {
        code?: string;
        statusCode?: number;
        data?: string | Uint8Array;
        raw?: unknown;
      };

      const result: RawTcpSendResult = {
        success: true,
        code: response.code ?? 'OK',
        bytesSent: payload.byteLength,
        statusCode: response.statusCode,
        responseData: response.data,
        raw: response.raw ?? response,
      };

      this.onreceive?.(result);

      return result;
    } catch (error) {
      const rawError = toRawError(error);
      this.onerror?.(rawError);
      throw rawError.error ?? new Error(rawError.message);
    }
  }

  public dispose() {}
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
        throw new Error('ERROR_PARAMETER');
      }

      return value;
    });

    return Uint8Array.from(normalized);
  }

  throw new Error('ERROR_PARAMETER');
}

function encodeUtf8(value: string): Uint8Array {
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

function toRawError(error: unknown): RawTcpPrinterError {
  if (error instanceof Error) {
    return {
      code: error.message === 'ERROR_PARAMETER' ? 'ERROR_PARAMETER' : 'RAW_TCP_SEND_ERROR',
      message: error.message,
      status: 0,
      responseText: error.message,
      error,
    };
  }

  return {
    code: 'RAW_TCP_SEND_ERROR',
    message: 'Raw TCP send failed',
    status: 0,
    responseText: 'Raw TCP send failed',
    error: new Error('Raw TCP send failed'),
  };
}

export default RawTcpPrinter;
