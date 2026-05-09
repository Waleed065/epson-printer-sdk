export type EpsonConnectionProtocol = 'http' | 'https' | 'tcp';

export type EpsonEndpointQuery = Record<string, string | number | boolean | undefined>;

export interface EpsonEndpoint {
  protocol: EpsonConnectionProtocol;
  host: string;
  port: number;
  path: string;
  query?: EpsonEndpointQuery;
}

export interface EpsonTransportRequest {
  endpoint: EpsonEndpoint;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

export interface EpsonTransport {
  request(request: EpsonTransportRequest): Promise<string>;
}

export interface EpsonTcpClientRequest {
  host: string;
  port: number;
  path: string;
  query?: EpsonEndpointQuery;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}

export interface EpsonTcpClient {
  request(request: EpsonTcpClientRequest): Promise<string>;
}

export type EpsonRawPayload = Uint8Array | number[] | string;

export interface EpsonRawTcpSendRequest {
  host: string;
  port: number;
  data: Uint8Array;
  timeoutMs: number;
}

export interface EpsonRawTcpSendResponse {
  code?: string;
  statusCode?: number;
  data?: string | Uint8Array;
  raw?: unknown;
}

export interface EpsonRawTcpClient {
  send(request: EpsonRawTcpSendRequest): Promise<EpsonRawTcpSendResponse | void>;
}

export interface EpsonTransportFactoryOptions {
  tcpClient?: EpsonTcpClient;
  transport?: EpsonTransport;
}

class FetchEpsonTransport implements EpsonTransport {
  public async request(request: EpsonTransportRequest): Promise<string> {
    if (request.endpoint.protocol === 'tcp') {
      throw new Error('TCP transport requires a tcpClient adapter');
    }

    const url = buildEndpointUrl(request.endpoint);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    let abortTimer: ReturnType<typeof setTimeout> | undefined;

    if (controller) {
      abortTimer = setTimeout(() => controller.abort(), request.timeoutMs);
    }

    const fetchPromise = fetch(url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: controller?.signal,
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      return response.text();
    });

    try {
      return await withTimeout(fetchPromise, request.timeoutMs, 'REQUEST_TIMEOUT');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('REQUEST_TIMEOUT');
      }

      throw error;
    } finally {
      if (abortTimer) {
        clearTimeout(abortTimer);
      }
    }
  }
}

class TcpEpsonTransport implements EpsonTransport {
  private readonly tcpClient: EpsonTcpClient;

  constructor(tcpClient: EpsonTcpClient) {
    this.tcpClient = tcpClient;
  }

  public request(request: EpsonTransportRequest): Promise<string> {
    if (request.endpoint.protocol !== 'tcp') {
      throw new Error('TCP transport can only be used with protocol "tcp"');
    }

    return this.tcpClient.request({
      host: request.endpoint.host,
      port: request.endpoint.port,
      path: request.endpoint.path,
      query: request.endpoint.query,
      method: request.method,
      headers: request.headers ?? {},
      body: request.body ?? '',
      timeoutMs: request.timeoutMs,
    });
  }
}

export function createEpsonTransport(
  protocol: EpsonConnectionProtocol,
  options?: EpsonTransportFactoryOptions,
): EpsonTransport {
  if (options?.transport) {
    return options.transport;
  }

  if (protocol === 'tcp') {
    if (!options?.tcpClient) {
      throw new Error('TCP transport requires a tcpClient adapter');
    }

    return new TcpEpsonTransport(options.tcpClient);
  }

  return new FetchEpsonTransport();
}

export function buildEndpointUrl(endpoint: EpsonEndpoint): string {
  const query = toQueryString(endpoint.query);
  return `${endpoint.protocol}://${endpoint.host}:${endpoint.port}${endpoint.path}${query}`;
}

export function toQueryString(query?: EpsonEndpointQuery): string {
  if (!query) {
    return '';
  }

  const entries = Object.entries(query).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    return '';
  }

  const serialized = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  return `?${serialized}`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(code)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
