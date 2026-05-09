import EpsonDeviceManager, {
  EpsonCommunicationLayer,
  EpsonDeviceConnectOptions,
  EpsonDeviceCreateOptions,
  EpsonManagedDevice,
} from './device-manager';
import {
  EscPosAlign,
  EscPosBuilder,
  EscPosCutMode,
  concatEscPosPayloads,
  createEscPosBuilder,
} from './escpos';
import EpsonPrint, { Epson } from './print';
import type {
  EpsonPrintResponse,
  EpsonPrinterErrorResponse,
  EpsonPrinterOptions,
  EpsonPrinterStatus,
  EpsonSendOptions,
  EpsonStatusMonitorOptions,
} from './printer';
import EpsonPrinter, { decodeEpsonStatus } from './printer';
import RawTcpPrinter, {
  RawTcpPrinterError,
  RawTcpPrinterOptions,
  RawTcpSendResult,
} from './raw-printer';
import type {
  EpsonConnectionProtocol,
  EpsonEndpoint,
  EpsonEndpointQuery,
  EpsonRawPayload,
  EpsonRawTcpClient,
  EpsonRawTcpSendRequest,
  EpsonRawTcpSendResponse,
  EpsonTcpClient,
  EpsonTcpClientRequest,
  EpsonTransport,
  EpsonTransportFactoryOptions,
  EpsonTransportRequest,
} from './transport';
import { buildEndpointUrl, createEpsonTransport, toQueryString } from './transport';

export default EpsonDeviceManager;
export {
  Epson,
  EpsonDeviceManager,
  EpsonPrint,
  EpsonPrinter,
  EscPosBuilder,
  RawTcpPrinter,
  buildEndpointUrl,
  concatEscPosPayloads,
  createEpsonTransport,
  createEscPosBuilder,
  decodeEpsonStatus,
  toQueryString,
};
export type {
  EpsonCommunicationLayer,
  EpsonConnectionProtocol,
  EpsonDeviceConnectOptions,
  EpsonDeviceCreateOptions,
  EpsonEndpoint,
  EpsonEndpointQuery,
  EpsonManagedDevice,
  EpsonPrintResponse,
  EpsonPrinterErrorResponse,
  EpsonPrinterOptions,
  EpsonPrinterStatus,
  EpsonRawPayload,
  EpsonRawTcpClient,
  EpsonRawTcpSendRequest,
  EpsonRawTcpSendResponse,
  EpsonSendOptions,
  EpsonStatusMonitorOptions,
  EpsonTcpClient,
  EpsonTcpClientRequest,
  EpsonTransport,
  EpsonTransportFactoryOptions,
  EpsonTransportRequest,
  EscPosAlign,
  EscPosCutMode,
  RawTcpPrinterError,
  RawTcpPrinterOptions,
  RawTcpSendResult,
};
