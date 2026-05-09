import assert from 'assert';

import EpsonDeviceManager from '../device-manager';
import { concatEscPosPayloads, createEscPosBuilder } from '../escpos';
import EpsonPrint, { Epson } from '../print';
import EpsonPrinter, { decodeEpsonStatus } from '../printer';
import RawTcpPrinter from '../raw-printer';
import {
  EpsonRawTcpSendRequest,
  EpsonRawTcpSendResponse,
  EpsonTransportRequest,
} from '../transport';

function expectThrows(fn: () => unknown, expectedMessage: string) {
  let caught: unknown;

  try {
    fn();
  } catch (error) {
    caught = error;
  }

  if (!(caught instanceof Error)) {
    assert.fail(`Expected Error("${expectedMessage}") to be thrown`);
  }

  assert.strictEqual(caught.message, expectedMessage);
}

function runBuilderXmlParityAssertions() {
  const print = new EpsonPrint();

  print
    .addTextAlign(EpsonPrint.ALIGN_CENTER)
    .addTextFont(EpsonPrint.FONT_A)
    .addText('Hello Epson')
    .addFeedLine(2)
    .addBarcode('12345', EpsonPrint.BARCODE_CODE39, EpsonPrint.HRI_BELOW, EpsonPrint.FONT_B, 2, 64)
    .addSymbol(
      'https://epson.example',
      Epson.Symbol.QRCODE_MODEL_2,
      Epson.ErrorCorrection.LEVEL_M,
      4,
    )
    .addCut(EpsonPrint.CUT_FEED);

  const actual = print.toString();
  const expected =
    '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><text align="center"/><text font="font_a"/><text>Hello Epson</text><feed line="2"/><barcode type="code39" hri="below" font="font_b" width="2" height="64">12345</barcode><symbol type="qrcode_model_2" level="level_m" width="4">https://epson.example</symbol><cut type="feed"/></epos-print>';

  assert.strictEqual(actual, expected);
}

function runBuilderValidationAssertions() {
  const print = new EpsonPrint();

  expectThrows(() => print.addTextAlign('middle'), 'Parameter "align" is invalid');
  expectThrows(() => print.addTextRotate('not_bool'), 'Parameter "rotate" is invalid');
  expectThrows(() => print.addTextSize(0, 1), 'Parameter "width" is invalid');
  expectThrows(
    () => print.addBarcode('12345', EpsonPrint.BARCODE_CODE39, 'invalid_hri'),
    'Parameter "hri" is invalid',
  );
  expectThrows(() => print.addPulse('drawer_3'), 'Parameter "drawer" is invalid');
  expectThrows(
    () => print.addSymbol('data', Epson.Symbol.QRCODE_MODEL_2, 256),
    'Parameter "level" is invalid',
  );

  expectThrows(
    () => print.setImageOptions({ brightness: 0.05 }),
    'Property "brightness" is invalid',
  );
  expectThrows(
    () => print.setImageOptions({ halftone: 5 as 0 | 1 | 2 }),
    'Property "halftone" is invalid',
  );

  print.setImageOptions({
    brightness: 1,
    halftone: EpsonPrint.HALFTONE_DITHER,
  });

  expectThrows(
    () => print.addImage('iVBORw0KGgo=', 1, 1, EpsonPrint.COLOR_1, 'rgb24'),
    'Parameter "mode" is invalid',
  );
}

function runStatusDecodingAssertions() {
  const allSignalsStatus =
    EpsonPrinter.ASB_NO_RESPONSE |
    EpsonPrinter.ASB_DRAWER_KICK |
    EpsonPrinter.ASB_OFF_LINE |
    EpsonPrinter.ASB_COVER_OPEN |
    EpsonPrinter.ASB_RECEIPT_NEAR_END;

  const decodedLowLevel = decodeEpsonStatus(
    allSignalsStatus,
    7,
    EpsonPrinter.DRAWER_OPEN_LEVEL_LOW,
  );

  assert.strictEqual(decodedLowLevel.isResponsive, false);
  assert.strictEqual(decodedLowLevel.drawerIsOpen, false);
  assert.strictEqual(decodedLowLevel.coverIsOpen, true);
  assert.strictEqual(decodedLowLevel.isOffline, true);
  assert.strictEqual(decodedLowLevel.paperNearEmpty, true);
  assert.strictEqual(decodedLowLevel.paperEmpty, false);
  assert.strictEqual(decodedLowLevel.statusCode, allSignalsStatus);
  assert.strictEqual(decodedLowLevel.battery, 7);
  assert.strictEqual(decodedLowLevel.isPrintSuccess, false);
  assert.strictEqual(decodedLowLevel.hasAutoCutterError, false);

  const decodedHighLevel = decodeEpsonStatus(
    EpsonPrinter.ASB_DRAWER_KICK | EpsonPrinter.ASB_RECEIPT_END,
    1,
    EpsonPrinter.DRAWER_OPEN_LEVEL_HIGH,
  );

  assert.strictEqual(decodedHighLevel.drawerIsOpen, true);
  assert.strictEqual(decodedHighLevel.paperEmpty, true);
  assert.strictEqual(decodedHighLevel.paperNearEmpty, false);

  const decodedInvalid = decodeEpsonStatus(Number.NaN, Number.NaN);
  assert.strictEqual(decodedInvalid.statusCode, 0);
  assert.strictEqual(decodedInvalid.battery, 0);
  assert.strictEqual(decodedInvalid.isResponsive, true);
}

function runEscPosAssertions() {
  const payload = createEscPosBuilder()
    .initialize()
    .align('center')
    .line('E2E')
    .cut('partial', 2)
    .build();

  const expected = Uint8Array.from([
    0x1b,
    0x40,
    0x1b,
    0x61,
    0x01,
    0x45,
    0x32,
    0x45,
    0x1b,
    0x64,
    0x01,
    0x1d,
    0x56,
    0x01,
    0x02,
  ]);

  assert.deepStrictEqual(payload, expected);

  const merged = concatEscPosPayloads([0x1b, 0x40], 'A', Uint8Array.from([0x0a]));
  assert.deepStrictEqual(merged, Uint8Array.from([0x1b, 0x40, 0x41, 0x0a]));
}

async function runManagerEposXmlAssertions() {
  const requests: EpsonTransportRequest[] = [];

  const manager = new EpsonDeviceManager();
  const connectResult = manager.connect(
    '192.168.0.50',
    80,
    undefined,
    {
      layer: 'epos-xml',
      protocol: 'http',
      transport: {
        async request(request: EpsonTransportRequest): Promise<string> {
          requests.push(request);
          return '<response success="true" code="OK" status="2" battery="1" printjobid="job-1"/>';
        },
      },
    },
  );

  assert.strictEqual(connectResult, manager.RESULT_OK);
  assert.strictEqual(manager.isConnected(), true);

  const created = await new Promise<EpsonPrinter>((resolve, reject) => {
    manager.createDevice('local_printer', manager.DEVICE_TYPE_PRINTER, undefined, (device, result) => {
      if (!device || result !== manager.RESULT_OK || !(device instanceof EpsonPrinter)) {
        reject(new Error(`Failed to create EpsonPrinter: ${result}`));
        return;
      }

      resolve(device);
    });
  });

  const print = new EpsonPrint();
  print.addText('RN adapter path\n');

  const response = await created.send(print, { printJobId: 'job-1' });
  assert.strictEqual(response.success, true);
  assert.strictEqual(response.printJobId, 'job-1');
  assert.strictEqual(requests.length, 1);
  assert.strictEqual(requests[0].endpoint.protocol, 'http');
  assert.strictEqual(requests[0].endpoint.host, '192.168.0.50');

  manager.disconnect();
  assert.strictEqual(manager.isConnected(), false);
}

async function runManagerRawTcpAssertions() {
  const requests: EpsonRawTcpSendRequest[] = [];

  const rawTcpClient = {
    async send(request: EpsonRawTcpSendRequest): Promise<EpsonRawTcpSendResponse> {
      requests.push(request);
      return {
        code: 'OK',
        statusCode: 0,
      };
    },
  };

  const manager = new EpsonDeviceManager();

  const invalidRawConnectResult = manager.connect('192.168.0.50', 9100, undefined, {
    layer: 'raw-tcp',
    protocol: 'http',
    rawTcpClient,
  });
  assert.strictEqual(invalidRawConnectResult, manager.ERROR_PARAMETER);

  const connectResult = manager.connect('192.168.0.50', 9100, undefined, {
    layer: 'raw-tcp',
    protocol: 'tcp',
    rawTcpClient,
  });
  assert.strictEqual(connectResult, manager.RESULT_OK);

  const created = await new Promise<RawTcpPrinter>((resolve, reject) => {
    manager.createDevice(
      'raw_printer',
      manager.DEVICE_TYPE_PRINTER,
      { layer: 'raw-tcp' },
      (device, result) => {
        if (!device || result !== manager.RESULT_OK || !(device instanceof RawTcpPrinter)) {
          reject(new Error(`Failed to create RawTcpPrinter: ${result}`));
          return;
        }

        resolve(device);
      },
    );
  });

  const result = await created.sendRaw([0x1b, 0x40]);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.bytesSent, 2);
  assert.strictEqual(requests.length, 1);
  assert.strictEqual(requests[0].host, '192.168.0.50');
  assert.strictEqual(requests[0].port, 9100);
  assert.strictEqual(requests[0].data.byteLength, 2);
}

async function run() {
  runBuilderXmlParityAssertions();
  runBuilderValidationAssertions();
  runStatusDecodingAssertions();
  runEscPosAssertions();
  await runManagerEposXmlAssertions();
  await runManagerRawTcpAssertions();

  console.log('regression tests passed');
}

void run();
