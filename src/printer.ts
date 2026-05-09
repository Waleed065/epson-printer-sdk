/* eslint-disable radix */
import EpsonPrint from './print';
import {
  EpsonConnectionProtocol,
  EpsonEndpoint,
  EpsonTcpClient,
  EpsonTransport,
  createEpsonTransport,
} from './transport';

const EPSON_XML_ENVELOPE_PREFIX =
  '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">';

const EPSON_XML_BODY_PREFIX = '<s:Body>';

const EPSON_XML_BODY_SUFFIX = '</s:Body></s:Envelope>';

const EPSON_PRINT_PARAMETER_NAMESPACE = 'http://www.epson-pos.com/schemas/2011/03/epos-print';

const DEFAULT_SERVICE_PATH = '/cgi-bin/epos/service.cgi';

export interface EpsonPrintResponse {
  success: boolean;
  code: string;
  status: number;
  battery: number;
  printJobId?: string;
  printjobid?: string;
  raw: ParsedResponseNode;
}

export interface EpsonPrinterErrorResponse {
  status: number;
  responseText: string;
  error?: Error;
}

export interface EpsonPrinterStatus {
  isResponsive: boolean;
  isPrintSuccess: boolean;
  drawerIsOpen: boolean;
  coverIsOpen: boolean;
  isOffline: boolean;
  paperNearEmpty: boolean;
  paperEmpty: boolean;
  isPaperFeed: boolean;
  isWaitingForOnline: boolean;
  isPanelSwitchPressed: boolean;
  hasMechanicalError: boolean;
  hasAutoCutterError: boolean;
  hasUnrecoverableError: boolean;
  hasAutoRecoverableError: boolean;
  isWaitingForRemoveLabel: boolean;
  isNoLabel: boolean;
  isSpoolerStopped: boolean;
  isBatteryOffline: boolean;
  isBuzzerOn: boolean;
  statusCode: number;
  battery: number;
}

export interface EpsonPrinterOptions {
  deviceId?: string;
  timeout?: number;
  protocol?: EpsonConnectionProtocol;
  port?: number;
  path?: string;
  transport?: EpsonTransport;
  tcpClient?: EpsonTcpClient;
}

export interface EpsonSendOptions {
  printJobId?: string;
}

export interface EpsonStatusMonitorOptions {
  intervalMs?: number;
  statusPrint?: EpsonPrint;
}

class EpsonPrinter {
  public static ASB_NO_RESPONSE = 0x00000001 as const;
  public static ASB_PRINT_SUCCESS = 0x00000002 as const;
  public static ASB_DRAWER_KICK = 0x00000004 as const;
  public static ASB_BATTERY_OFFLINE = 0x00000004 as const;
  public static ASB_OFF_LINE = 0x00000008 as const;
  public static ASB_COVER_OPEN = 0x00000020 as const;
  public static ASB_PAPER_FEED = 0x00000040 as const;
  public static ASB_WAIT_ON_LINE = 0x00000100 as const;
  public static ASB_PANEL_SWITCH = 0x00000200 as const;
  public static ASB_MECHANICAL_ERR = 0x00000400 as const;
  public static ASB_AUTOCUTTER_ERR = 0x00000800 as const;
  public static ASB_UNRECOVER_ERR = 0x00002000 as const;
  public static ASB_AUTORECOVER_ERR = 0x00004000 as const;
  public static ASB_RECEIPT_NEAR_END = 0x00020000 as const;
  public static ASB_RECEIPT_END = 0x00080000 as const;
  public static ASB_BUZZER = 0x01000000 as const;
  public static ASB_WAIT_REMOVE_LABEL = 0x01000000 as const;
  public static ASB_NO_LABEL = 0x04000000 as const;
  public static ASB_SPOOLER_IS_STOPPED = 0x80000000 as const;
  public static DRAWER_OPEN_LEVEL_LOW = 0 as const;
  public static DRAWER_OPEN_LEVEL_HIGH = 1 as const;

  private readonly endpoint: EpsonEndpoint;
  private readonly transport: EpsonTransport;
  private readonly requestTimeoutMs: number;

  private monitorTimer?: ReturnType<typeof setTimeout>;
  private monitorIntervalMs = 3000;
  private isMonitoring = false;
  private hasStatusSnapshot = false;
  private status = 0;
  private battery = 0;

  public drawerOpenLevel: 0 | 1 = EpsonPrinter.DRAWER_OPEN_LEVEL_LOW;

  public onreceive?: (response: EpsonPrintResponse) => void;
  public onstatuschange?: (status: number) => void;
  public ononline?: () => void;
  public onoffline?: () => void;
  public onpoweroff?: () => void;
  public oncoverok?: () => void;
  public oncoveropen?: () => void;
  public onpaperok?: () => void;
  public onpapernearend?: () => void;
  public onpaperend?: () => void;
  public ondrawerclosed?: () => void;
  public ondraweropen?: () => void;
  public onprintsuccess?: () => void;
  public onbatterystatuschange?: (battery: number) => void;
  public onbatteryok?: () => void;
  public onbatterylow?: () => void;
  public onerror?: (error: EpsonPrinterErrorResponse) => void;

  constructor(ip: string, options?: EpsonPrinterOptions) {
    const deviceId = options?.deviceId ?? 'local_printer';
    this.requestTimeoutMs = options?.timeout ?? 10000;

    const protocol = options?.protocol ?? 'http';
    const port = options?.port ?? getDefaultPort(protocol);

    this.endpoint = {
      protocol,
      host: ip,
      port,
      path: options?.path ?? DEFAULT_SERVICE_PATH,
      query: {
        devid: deviceId,
        timeout: this.requestTimeoutMs,
      },
    };

    this.transport =
      options?.transport ?? createEpsonTransport(protocol, { tcpClient: options?.tcpClient });
  }

  public async send(print: EpsonPrint, options?: EpsonSendOptions): Promise<EpsonPrintResponse> {
    let response: EpsonPrintResponse;

    try {
      response = await this.requestAndParse(print.toString(), options?.printJobId);
    } catch (error) {
      this.reportError(error);
      throw error;
    }

    this.processStatus(response.status, response.battery);
    this.onreceive?.(response);

    // Emit callback before throw to mirror Epson's event-first behavior.
    if (!response.success) {
      const error = new Error(response.code || 'PRINT_FAILED');
      this.reportError(error);
      throw error;
    }

    return response;
  }

  public async getStatus(print: EpsonPrint = new EpsonPrint()): Promise<EpsonPrinterStatus> {
    let response: EpsonPrintResponse;

    try {
      response = await this.requestAndParse(print.toString());
    } catch (error) {
      this.reportError(error);
      throw error;
    }

    this.processStatus(response.status, response.battery);

    return decodeEpsonStatus(response.status, response.battery, this.drawerOpenLevel);
  }

  public async getPrintJobStatus(printJobId: string): Promise<EpsonPrintResponse> {
    if (!printJobId) {
      const error = new Error('INVALID_PRINT_JOB_ID');
      this.reportError(error);
      throw error;
    }

    let response: EpsonPrintResponse;

    try {
      response = await this.requestAndParse(new EpsonPrint().toString(), printJobId);
    } catch (error) {
      this.reportError(error);
      throw error;
    }

    this.processStatus(response.status, response.battery);

    return response;
  }

  public startMonitor(options?: EpsonStatusMonitorOptions) {
    if (options?.intervalMs !== undefined) {
      this.monitorIntervalMs = Math.max(1000, options.intervalMs);
    }

    const statusPrint = options?.statusPrint ?? new EpsonPrint();

    this.stopMonitor();
    this.isMonitoring = true;

    const monitorTick = async () => {
      if (!this.isMonitoring) {
        return;
      }

      try {
        const response = await this.requestAndParse(statusPrint.toString());
        this.processStatus(response.status, response.battery);
      } catch (error) {
        this.processStatus(EpsonPrinter.ASB_NO_RESPONSE, 0);
        this.reportError(error);
      } finally {
        if (this.isMonitoring) {
          this.monitorTimer = setTimeout(() => {
            void monitorTick();
          }, this.monitorIntervalMs);
        }
      }
    };

    void monitorTick();
  }

  public stopMonitor() {
    this.isMonitoring = false;

    if (this.monitorTimer) {
      clearTimeout(this.monitorTimer);
      this.monitorTimer = undefined;
    }
  }

  public dispose() {
    this.stopMonitor();
  }

  private processStatus(nextStatus: number, nextBattery: number) {
    const previousStatus = this.status >>> 0;
    const previousBattery = this.battery;
    let status = Number.isFinite(nextStatus) ? nextStatus >>> 0 : 0;

    if (status === 0 || status === EpsonPrinter.ASB_NO_RESPONSE) {
      status = (previousStatus | EpsonPrinter.ASB_NO_RESPONSE) >>> 0;
    }

    const battery = Number.isFinite(nextBattery) ? nextBattery : 0;

    const diff = previousStatus === 0 ? 0xffffffff : (previousStatus ^ status) >>> 0;
    const batteryDiff = previousStatus === 0 ? ~0 : previousBattery ^ battery;

    this.status = status;
    this.battery = battery;
    this.hasStatusSnapshot = true;

    if (diff !== 0) {
      this.onstatuschange?.(status);
    }

    if (batteryDiff !== 0) {
      this.onbatterystatuschange?.(battery);
    }

    if (hasStatusFlag(diff, EpsonPrinter.ASB_NO_RESPONSE | EpsonPrinter.ASB_OFF_LINE)) {
      if (hasStatusFlag(status, EpsonPrinter.ASB_NO_RESPONSE)) {
        this.onpoweroff?.();
      } else if (hasStatusFlag(status, EpsonPrinter.ASB_OFF_LINE)) {
        this.onoffline?.();
      } else {
        this.ononline?.();
      }
    }

    if (hasStatusFlag(diff, EpsonPrinter.ASB_COVER_OPEN)) {
      if (!hasStatusFlag(status, EpsonPrinter.ASB_NO_RESPONSE)) {
        if (hasStatusFlag(status, EpsonPrinter.ASB_COVER_OPEN)) {
          this.oncoveropen?.();
        } else {
          this.oncoverok?.();
        }
      }
    }

    if (hasStatusFlag(diff, EpsonPrinter.ASB_RECEIPT_END | EpsonPrinter.ASB_RECEIPT_NEAR_END)) {
      if (!hasStatusFlag(status, EpsonPrinter.ASB_NO_RESPONSE)) {
        if (hasStatusFlag(status, EpsonPrinter.ASB_RECEIPT_END)) {
          this.onpaperend?.();
        } else if (hasStatusFlag(status, EpsonPrinter.ASB_RECEIPT_NEAR_END)) {
          this.onpapernearend?.();
        } else {
          this.onpaperok?.();
        }
      }
    }

    if (hasStatusFlag(diff, EpsonPrinter.ASB_DRAWER_KICK)) {
      if (!hasStatusFlag(status, EpsonPrinter.ASB_NO_RESPONSE)) {
        const signalHigh = hasStatusFlag(status, EpsonPrinter.ASB_DRAWER_KICK);
        const isDrawerOpen =
          this.drawerOpenLevel === EpsonPrinter.DRAWER_OPEN_LEVEL_HIGH ? signalHigh : !signalHigh;

        if (isDrawerOpen) {
          this.ondraweropen?.();
        } else {
          this.ondrawerclosed?.();
        }

        if (signalHigh) {
          this.onbatterylow?.();
        } else {
          this.onbatteryok?.();
        }
      }
    }

    if (
      hasStatusFlag(diff, EpsonPrinter.ASB_PRINT_SUCCESS) &&
      hasStatusFlag(status, EpsonPrinter.ASB_PRINT_SUCCESS)
    ) {
      this.onprintsuccess?.();
    }
  }

  private async requestAndParse(data: string, printJobId?: string): Promise<EpsonPrintResponse> {
    const xml = await this.request(data, printJobId);
    const response = parseResponseNode(xml);

    if (!response) {
      throw new Error('INVALID_RESPONSE');
    }

    const success = response.attributes.success === 'true' || response.attributes.success === '1';
    const rawCode = response.attributes.code ?? '';
    const code = rawCode === 'EX_ENPC_TIMEOUT' ? 'ERROR_DEVICE_BUSY' : rawCode;
    const status = Number.parseInt(response.attributes.status ?? '0', 10);
    const battery = Number.parseInt(response.attributes.battery ?? '0', 10);
    const responsePrintJobId = response.printJobId ?? response.attributes.printjobid;

    return {
      success,
      code,
      status: Number.isNaN(status) ? 0 : status,
      battery: Number.isNaN(battery) ? 0 : battery,
      printJobId: responsePrintJobId,
      printjobid: responsePrintJobId,
      raw: response,
    };
  }

  private request(data: string, printJobId?: string) {
    return this.transport.request({
      endpoint: this.endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'If-Modified-Since': 'Thu, 01 Jun 1970 00:00:00 GMT',
        SOAPAction: '""',
      },
      body: createSoapEnvelope(data, printJobId),
      timeoutMs: this.requestTimeoutMs,
    });
  }

  private reportError(error: unknown) {
    if (error instanceof Error) {
      this.onerror?.({
        status: 0,
        responseText: error.message,
        error,
      });
      return;
    }

    this.onerror?.({
      status: 0,
      responseText: 'UNKNOWN_ERROR',
      error: new Error('UNKNOWN_ERROR'),
    });
  }
}

type ParsedResponseNode = {
  attributes: Record<string, string>;
  printJobId?: string;
};

function parseResponseNode(xml: string): ParsedResponseNode | null {
  const responseTagMatch = xml.match(/<(?:[a-zA-Z0-9_.-]+:)?response\b([^>]*)\/?\s*>/i);

  if (!responseTagMatch) {
    return null;
  }

  const attributes: Record<string, string> = {};
  const attributesText = responseTagMatch[1] ?? '';
  const attributePattern = /([a-zA-Z_:][a-zA-Z0-9_:.\-]*)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(attributesText)) !== null) {
    attributes[match[1]] = decodeXmlEntity(match[2]);
  }

  const printJobIdMatch = xml.match(
    /<(?:[a-zA-Z0-9_.-]+:)?printjobid\b[^>]*>([^<]*)<\/(?:[a-zA-Z0-9_.-]+:)?printjobid>/i,
  );

  return {
    attributes,
    printJobId: printJobIdMatch ? decodeXmlEntity(printJobIdMatch[1]) : undefined,
  };
}

function decodeXmlEntity(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function createSoapEnvelope(data: string, printJobId?: string) {
  const header = printJobId
    ? `<s:Header><parameter xmlns="${EPSON_PRINT_PARAMETER_NAMESPACE}"><printjobid>${escapeXml(
        printJobId,
      )}</printjobid></parameter></s:Header>`
    : '';

  return `${EPSON_XML_ENVELOPE_PREFIX}${header}${EPSON_XML_BODY_PREFIX}${data}${EPSON_XML_BODY_SUFFIX}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getDefaultPort(protocol: EpsonConnectionProtocol) {
  if (protocol === 'https') {
    return 443;
  }

  if (protocol === 'tcp') {
    return 9100;
  }

  return 80;
}

function hasStatusFlag(value: number, flag: number) {
  return ((value >>> 0) & (flag >>> 0)) >>> 0 !== 0;
}

export function decodeEpsonStatus(
  status: number,
  battery: number,
  drawerOpenLevel: 0 | 1 = EpsonPrinter.DRAWER_OPEN_LEVEL_LOW,
): EpsonPrinterStatus {
  const normalizedStatus = Number.isFinite(status) ? status >>> 0 : 0;
  const normalizedBattery = Number.isFinite(battery) ? battery : 0;
  const signalHigh = hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_DRAWER_KICK);

  return {
    isResponsive: !hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_NO_RESPONSE),
    isPrintSuccess: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_PRINT_SUCCESS),
    drawerIsOpen:
      drawerOpenLevel === EpsonPrinter.DRAWER_OPEN_LEVEL_HIGH ? signalHigh : !signalHigh,
    coverIsOpen: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_COVER_OPEN),
    isOffline: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_OFF_LINE),
    paperNearEmpty: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_RECEIPT_NEAR_END),
    paperEmpty: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_RECEIPT_END),
    isPaperFeed: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_PAPER_FEED),
    isWaitingForOnline: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_WAIT_ON_LINE),
    isPanelSwitchPressed: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_PANEL_SWITCH),
    hasMechanicalError: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_MECHANICAL_ERR),
    hasAutoCutterError: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_AUTOCUTTER_ERR),
    hasUnrecoverableError: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_UNRECOVER_ERR),
    hasAutoRecoverableError: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_AUTORECOVER_ERR),
    isWaitingForRemoveLabel: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_WAIT_REMOVE_LABEL),
    isNoLabel: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_NO_LABEL),
    isSpoolerStopped: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_SPOOLER_IS_STOPPED),
    isBatteryOffline: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_BATTERY_OFFLINE),
    isBuzzerOn: hasStatusFlag(normalizedStatus, EpsonPrinter.ASB_BUZZER),
    statusCode: normalizedStatus,
    battery: normalizedBattery,
  };
}

export default EpsonPrinter;
