import EpsonPrinter, { EpsonPrinterOptions } from './printer';
import RawTcpPrinter, { RawTcpPrinterOptions } from './raw-printer';
import {
  EpsonConnectionProtocol,
  EpsonRawTcpClient,
  EpsonTcpClient,
  EpsonTransport,
  createEpsonTransport,
} from './transport';

export type EpsonCommunicationLayer = 'epos-xml' | 'raw-tcp';

export type EpsonManagedDevice = EpsonPrinter | RawTcpPrinter;

export interface EpsonDeviceConnectOptions {
  layer?: EpsonCommunicationLayer;
  protocol?: EpsonConnectionProtocol;
  path?: string;
  timeout?: number;
  eposprint?: boolean;
  transport?: EpsonTransport;
  tcpClient?: EpsonTcpClient;
  rawTcpClient?: EpsonRawTcpClient;
}

export interface EpsonDeviceCreateOptions {
  layer?: EpsonCommunicationLayer;
  timeout?: number;
  protocol?: EpsonConnectionProtocol;
  path?: string;
  port?: number;
  transport?: EpsonTransport;
  tcpClient?: EpsonTcpClient;
  rawTcpClient?: EpsonRawTcpClient;
  driver?: string;
  crypto?: boolean;
  buffer?: boolean;
}

type EpsonConnectResult = 'OK' | 'SSL_CONNECT_OK' | 'ERROR_PARAMETER' | 'SYSTEM_ERROR';

type EpsonCreateResult =
  | 'OK'
  | 'ERROR_PARAMETER'
  | 'SYSTEM_ERROR'
  | 'DEVICE_NOT_FOUND'
  | 'DEVICE_IN_USE'
  | 'DEVICE_OPEN_ERROR';

type EpsonDeleteResult = 'OK' | 'DEVICE_NOT_OPEN' | 'DEVICE_CLOSE_ERROR';

class EpsonDeviceManager {
  public static readonly DEVICE_TYPE_SCANNER = 'type_scanner';
  public static readonly DEVICE_TYPE_KEYBOARD = 'type_keyboard';
  public static readonly DEVICE_TYPE_POSKEYBOARD = 'type_poskeyboard';
  public static readonly DEVICE_TYPE_MSR = 'type_msr';
  public static readonly DEVICE_TYPE_CAT = 'type_cat';
  public static readonly DEVICE_TYPE_CASH_CHANGER = 'type_cash_changer';
  public static readonly DEVICE_TYPE_PRINTER = 'type_printer';
  public static readonly DEVICE_TYPE_DISPLAY = 'type_display';
  public static readonly DEVICE_TYPE_SIMPLE_SERIAL = 'type_simple_serial';
  public static readonly DEVICE_TYPE_HYBRID_PRINTER = 'type_hybrid_printer';
  public static readonly DEVICE_TYPE_HYBRID_PRINTER2 = 'type_hybrid_printer2';
  public static readonly DEVICE_TYPE_DT = 'type_dt';
  public static readonly DEVICE_TYPE_OTHER_PERIPHERAL = 'type_other_peripheral';
  public static readonly DEVICE_TYPE_GFE = 'type_storage';

  public static readonly RESULT_OK = 'OK';
  public static readonly RESULT_SSL_CONNECT_OK = 'SSL_CONNECT_OK';

  public static readonly ERROR_PARAMETER = 'ERROR_PARAMETER';
  public static readonly ERROR_SYSTEM = 'SYSTEM_ERROR';
  public static readonly ERROR_DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND';
  public static readonly ERROR_DEVICE_IN_USE = 'DEVICE_IN_USE';
  public static readonly ERROR_DEVICE_OPEN = 'DEVICE_OPEN_ERROR';
  public static readonly ERROR_DEVICE_CLOSE = 'DEVICE_CLOSE_ERROR';
  public static readonly ERROR_DEVICE_NOT_OPEN = 'DEVICE_NOT_OPEN';

  public static readonly IFPORT_EPOSDEVICE = 8008;
  public static readonly IFPORT_EPOSDEVICE_S = 8043;
  public static readonly CONNECT_TIMEOUT = 15000;
  public static readonly RECONNECT_TIMEOUT = 3000;
  public static readonly MAX_RECONNECT_RETRY = 5;

  public readonly DEVICE_TYPE_SCANNER = EpsonDeviceManager.DEVICE_TYPE_SCANNER;
  public readonly DEVICE_TYPE_KEYBOARD = EpsonDeviceManager.DEVICE_TYPE_KEYBOARD;
  public readonly DEVICE_TYPE_POSKEYBOARD = EpsonDeviceManager.DEVICE_TYPE_POSKEYBOARD;
  public readonly DEVICE_TYPE_MSR = EpsonDeviceManager.DEVICE_TYPE_MSR;
  public readonly DEVICE_TYPE_CAT = EpsonDeviceManager.DEVICE_TYPE_CAT;
  public readonly DEVICE_TYPE_CASH_CHANGER = EpsonDeviceManager.DEVICE_TYPE_CASH_CHANGER;

  public readonly DEVICE_TYPE_PRINTER = EpsonDeviceManager.DEVICE_TYPE_PRINTER;
  public readonly DEVICE_TYPE_DISPLAY = EpsonDeviceManager.DEVICE_TYPE_DISPLAY;
  public readonly DEVICE_TYPE_SIMPLE_SERIAL = EpsonDeviceManager.DEVICE_TYPE_SIMPLE_SERIAL;
  public readonly DEVICE_TYPE_HYBRID_PRINTER = EpsonDeviceManager.DEVICE_TYPE_HYBRID_PRINTER;
  public readonly DEVICE_TYPE_HYBRID_PRINTER2 = EpsonDeviceManager.DEVICE_TYPE_HYBRID_PRINTER2;
  public readonly DEVICE_TYPE_DT = EpsonDeviceManager.DEVICE_TYPE_DT;
  public readonly DEVICE_TYPE_OTHER_PERIPHERAL = EpsonDeviceManager.DEVICE_TYPE_OTHER_PERIPHERAL;
  public readonly DEVICE_TYPE_GFE = EpsonDeviceManager.DEVICE_TYPE_GFE;

  public readonly RESULT_OK = EpsonDeviceManager.RESULT_OK;
  public readonly RESULT_SSL_CONNECT_OK = EpsonDeviceManager.RESULT_SSL_CONNECT_OK;

  public readonly ERROR_PARAMETER = EpsonDeviceManager.ERROR_PARAMETER;
  public readonly ERROR_SYSTEM = EpsonDeviceManager.ERROR_SYSTEM;
  public readonly ERROR_DEVICE_NOT_FOUND = EpsonDeviceManager.ERROR_DEVICE_NOT_FOUND;
  public readonly ERROR_DEVICE_IN_USE = EpsonDeviceManager.ERROR_DEVICE_IN_USE;
  public readonly ERROR_DEVICE_OPEN = EpsonDeviceManager.ERROR_DEVICE_OPEN;
  public readonly ERROR_DEVICE_CLOSE = EpsonDeviceManager.ERROR_DEVICE_CLOSE;
  public readonly ERROR_DEVICE_NOT_OPEN = EpsonDeviceManager.ERROR_DEVICE_NOT_OPEN;

  public readonly IFPORT_EPOSDEVICE = EpsonDeviceManager.IFPORT_EPOSDEVICE;
  public readonly IFPORT_EPOSDEVICE_S = EpsonDeviceManager.IFPORT_EPOSDEVICE_S;
  public readonly CONNECT_TIMEOUT = EpsonDeviceManager.CONNECT_TIMEOUT;
  public readonly RECONNECT_TIMEOUT = EpsonDeviceManager.RECONNECT_TIMEOUT;
  public readonly MAX_RECONNECT_RETRY = EpsonDeviceManager.MAX_RECONNECT_RETRY;

  private connected = false;
  private host = '';
  private port = 80;
  private layer: EpsonCommunicationLayer = 'epos-xml';
  private protocol: EpsonConnectionProtocol = 'http';
  private path = '/cgi-bin/epos/service.cgi';
  private timeout = 10000;

  private transport?: EpsonTransport;
  private tcpClient?: EpsonTcpClient;
  private rawTcpClient?: EpsonRawTcpClient;

  private readonly printers = new Map<string, EpsonManagedDevice>();

  public ondisconnect?: () => void;
  public onreconnecting?: () => void;
  public onreconnect?: () => void;

  public connect(
    target: string,
    port: number,
    callback?: (result: EpsonConnectResult) => void,
    options?: EpsonDeviceConnectOptions,
  ): EpsonConnectResult {
    if (this.connected) {
      this.disconnect();
    }

    if (!target || !Number.isInteger(port) || port <= 0) {
      callback?.(EpsonDeviceManager.ERROR_PARAMETER);
      return EpsonDeviceManager.ERROR_PARAMETER;
    }

    this.host = target;
    this.port = port;
    this.layer = options?.layer ?? 'epos-xml';
    this.protocol = options?.protocol ?? inferProtocolFromPort(port, this.layer);
    this.path = options?.path ?? '/cgi-bin/epos/service.cgi';
    this.timeout = options?.timeout ?? 10000;

    if (this.layer === 'raw-tcp' && this.protocol !== 'tcp') {
      callback?.(EpsonDeviceManager.ERROR_PARAMETER);
      return EpsonDeviceManager.ERROR_PARAMETER;
    }

    this.tcpClient = options?.tcpClient;
    this.rawTcpClient = options?.rawTcpClient;

    if (this.layer === 'epos-xml') {
      try {
        this.transport =
          options?.transport ?? createEpsonTransport(this.protocol, { tcpClient: this.tcpClient });
      } catch {
        callback?.(EpsonDeviceManager.ERROR_PARAMETER);
        return EpsonDeviceManager.ERROR_PARAMETER;
      }
    } else {
      this.transport = options?.transport;
    }

    this.connected = true;

    const result =
      this.protocol === 'https'
        ? EpsonDeviceManager.RESULT_SSL_CONNECT_OK
        : EpsonDeviceManager.RESULT_OK;

    callback?.(result);
    return result;
  }

  public disconnect(callback?: (result: 'OK') => void) {
    for (const printer of this.printers.values()) {
      printer.dispose();
    }

    this.printers.clear();
    this.connected = false;

    this.ondisconnect?.();
    callback?.(EpsonDeviceManager.RESULT_OK);
  }

  public isConnected() {
    return this.connected;
  }

  public createDevice(
    deviceId: string,
    deviceType: string,
    options: EpsonDeviceCreateOptions | boolean | undefined,
    callback: (printer: EpsonManagedDevice | null, result: EpsonCreateResult) => void,
  ) {
    if (!this.connected || !this.host) {
      callback(null, EpsonDeviceManager.ERROR_SYSTEM);
      return;
    }

    if (deviceType !== EpsonDeviceManager.DEVICE_TYPE_PRINTER) {
      callback(null, EpsonDeviceManager.ERROR_DEVICE_NOT_FOUND);
      return;
    }

    const normalizedOptions = normalizeCreateOptions(options);
    const resolvedDeviceId = deviceId || 'local_printer';
    const resolvedLayer = normalizedOptions.layer ?? this.layer;

    if (this.printers.has(resolvedDeviceId)) {
      callback(null, EpsonDeviceManager.ERROR_DEVICE_IN_USE);
      return;
    }

    try {
      if (resolvedLayer === 'raw-tcp') {
        const rawTcpClient = normalizedOptions.rawTcpClient ?? this.rawTcpClient;

        if (!rawTcpClient) {
          throw new Error(EpsonDeviceManager.ERROR_PARAMETER);
        }

        const rawPrinterOptions: RawTcpPrinterOptions = {
          port: normalizedOptions.port ?? this.port,
          timeout: normalizedOptions.timeout ?? this.timeout,
          rawTcpClient,
        };

        const rawPrinter = new RawTcpPrinter(this.host, rawPrinterOptions);
        this.printers.set(resolvedDeviceId, rawPrinter);
        callback(rawPrinter, EpsonDeviceManager.RESULT_OK);
        return;
      }

      const resolvedProtocol =
        normalizedOptions.protocol ??
        (this.layer === 'epos-xml' ? this.protocol : inferProtocolFromPort(this.port, 'epos-xml'));

      const printerOptions: EpsonPrinterOptions = {
        deviceId: resolvedDeviceId,
        timeout: normalizedOptions.timeout ?? this.timeout,
        protocol: resolvedProtocol,
        path: normalizedOptions.path ?? this.path,
        port: normalizedOptions.port ?? this.port,
        transport:
          normalizedOptions.transport ??
          this.transport ??
          createEpsonTransport(resolvedProtocol, {
            tcpClient: normalizedOptions.tcpClient ?? this.tcpClient,
          }),
        tcpClient: normalizedOptions.tcpClient ?? this.tcpClient,
      };

      const printer = new EpsonPrinter(this.host, printerOptions);
      this.printers.set(resolvedDeviceId, printer);

      callback(printer, EpsonDeviceManager.RESULT_OK);
    } catch (error) {
      callback(null, toCreateResultError(error));
    }
  }

  public deleteDevice(
    printer: EpsonManagedDevice,
    callback?: (result: EpsonDeleteResult) => void,
  ) {
    try {
      const entry = [...this.printers.entries()].find(([, current]) => current === printer);

      if (!entry) {
        throw new Error(EpsonDeviceManager.ERROR_DEVICE_NOT_OPEN);
      }

      const [deviceId] = entry;

      printer.dispose();
      this.printers.delete(deviceId);

      callback?.(EpsonDeviceManager.RESULT_OK);
    } catch (error) {
      callback?.(toDeleteResultError(error));
    }
  }

  public getDevice(deviceId: string) {
    return this.printers.get(deviceId);
  }
}

function inferProtocolFromPort(port: number, layer: EpsonCommunicationLayer): EpsonConnectionProtocol {
  if (layer === 'raw-tcp') {
    return 'tcp';
  }

  if (port === EpsonDeviceManager.IFPORT_EPOSDEVICE || port === 80) {
    return 'http';
  }

  if (port === EpsonDeviceManager.IFPORT_EPOSDEVICE_S || port === 443) {
    return 'https';
  }

  return 'http';
}

function normalizeCreateOptions(options: EpsonDeviceCreateOptions | boolean | undefined) {
  if (typeof options === 'boolean') {
    return { crypto: options } as EpsonDeviceCreateOptions;
  }

  if (options === undefined) {
    return {} as EpsonDeviceCreateOptions;
  }

  return options;
}

function toCreateResultError(error: unknown): EpsonCreateResult {
  if (!(error instanceof Error)) {
    return EpsonDeviceManager.ERROR_DEVICE_OPEN;
  }

  switch (error.message) {
    case EpsonDeviceManager.ERROR_PARAMETER:
      return EpsonDeviceManager.ERROR_PARAMETER;
    case EpsonDeviceManager.ERROR_SYSTEM:
      return EpsonDeviceManager.ERROR_SYSTEM;
    case EpsonDeviceManager.ERROR_DEVICE_NOT_FOUND:
      return EpsonDeviceManager.ERROR_DEVICE_NOT_FOUND;
    case EpsonDeviceManager.ERROR_DEVICE_IN_USE:
      return EpsonDeviceManager.ERROR_DEVICE_IN_USE;
    case EpsonDeviceManager.ERROR_DEVICE_OPEN:
      return EpsonDeviceManager.ERROR_DEVICE_OPEN;
    default:
      return EpsonDeviceManager.ERROR_DEVICE_OPEN;
  }
}

function toDeleteResultError(error: unknown): EpsonDeleteResult {
  if (!(error instanceof Error)) {
    return EpsonDeviceManager.ERROR_DEVICE_CLOSE;
  }

  if (error.message === EpsonDeviceManager.ERROR_DEVICE_NOT_OPEN) {
    return EpsonDeviceManager.ERROR_DEVICE_NOT_OPEN;
  }

  return EpsonDeviceManager.ERROR_DEVICE_CLOSE;
}

export default EpsonDeviceManager;
