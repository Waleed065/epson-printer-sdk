# @baemingo/epson-printer-sdk

> React Native-safe Epson printer SDK with selectable ePOS XML and raw TCP layers.

## Printer Prerequisites

- The printer must expose Epson ePOS-Print service (`/cgi-bin/epos/service.cgi`)
- The printer must support firmware/API level compatible with Epson ePOS-Print XML v2.x+
- Epson ePOS-Print service must be enabled on the device

## Install

Using npm:

```sh
npm install --save @baemingo/epson-printer-sdk
```

or using yarn:

```sh
yarn add @baemingo/epson-printer-sdk
```

## What this library is (and is not)

- This package builds and sends pre-encoded Epson XML commands.
- It is not a browser-JS raster/canvas parity layer.
- It is designed to run in React Native and other non-browser runtimes.

## Connection support

- Layer selection:
  - `epos-xml` (default): Epson ePOS XML over HTTP/HTTPS/TCP adapter.
  - `raw-tcp`: Direct TCP byte transport for RN socket adapters.
- HTTP: built-in transport support.
- HTTPS: built-in transport support.
- TCP: supported via adapter injection (`tcpClient`) so RN apps can plug in their own socket implementation.

## Publish

1. Change version number in package.json
2. `yarn build`
3. `cp package.json dist/`
4. `cd dist`
5. `npm publish`

## Usage

```ts
import EpsonDeviceManager, { EpsonPrint, Epson } from '@baemingo/epson-printer-sdk';

const manager = new EpsonDeviceManager();

manager.connect(
  '192.168.0.1',
  80,
  (result) => {
    if (result !== manager.RESULT_OK) {
      throw new Error(`CONNECT_FAILED: ${result}`);
    }
  },
  {
    layer: 'epos-xml',
    protocol: 'http',
  },
);

manager.createDevice(
  'local_printer',
  manager.DEVICE_TYPE_PRINTER,
  { timeout: 10000 },
  async (printer, result) => {
    if (!printer || result !== manager.RESULT_OK) {
      throw new Error(`CREATE_DEVICE_FAILED: ${result}`);
    }

    const print = new EpsonPrint();
    print.addText('Hello, world!\n');
    print.addSymbol('1234', Epson.Symbol.QRCODE_MODEL_1, EpsonPrint.LEVEL_M, 5);
    print.addCut(EpsonPrint.CUT_FEED);

    try {
      const response = await printer.send(print);
      console.log('printed with status', response.status);
    } catch (e) {
      console.error('print failed', e);
    }
  },
);
```

## Direct printer usage

```ts
import { EpsonPrinter, EpsonPrint } from '@baemingo/epson-printer-sdk';

const printer = new EpsonPrinter('192.168.0.1', {
  protocol: 'http',
  timeout: 10000,
  deviceId: 'local_printer',
});

const print = new EpsonPrint();
print.addText('Direct print\n');
await printer.send(print);
```

## TCP usage (adapter model)

```ts
import EpsonDeviceManager from '@baemingo/epson-printer-sdk';
import type { EpsonTcpClientRequest } from '@baemingo/epson-printer-sdk';

const tcpClient = {
  async request(request: EpsonTcpClientRequest): Promise<string> {
    // Implement using your RN socket layer (for example react-native-tcp-socket).
    // Must return raw XML response text.
    throw new Error('Not implemented');
  },
};

const manager = new EpsonDeviceManager();
manager.connect('192.168.0.50', 9100, undefined, {
  layer: 'epos-xml',
  protocol: 'tcp',
  tcpClient,
});
```

## Raw TCP layer usage

```ts
import EpsonDeviceManager, {
  RawTcpPrinter,
  type EpsonRawTcpSendRequest,
} from '@baemingo/epson-printer-sdk';

const rawTcpClient = {
  async send(request: EpsonRawTcpSendRequest) {
    // Implement with RN sockets: connect -> write request.data -> optionally read response.
    return {
      code: 'OK',
      statusCode: 0,
    };
  },
};

const manager = new EpsonDeviceManager();

manager.connect('192.168.0.50', 9100, undefined, {
  layer: 'raw-tcp',
  protocol: 'tcp',
  rawTcpClient,
});

manager.createDevice(
  'raw_printer',
  manager.DEVICE_TYPE_PRINTER,
  { layer: 'raw-tcp' },
  async (device, result) => {
    if (!device || result !== manager.RESULT_OK || !(device instanceof RawTcpPrinter)) {
      return;
    }

    // Example bytes: ESC @ (initialize)
    await device.sendRaw(new Uint8Array([0x1b, 0x40]));
    await device.sendRaw([0x1d, 0x56, 0x00]);
    await device.sendRaw('raw text payload');
  },
);
```

## ESC/POS helper utility (optional)

```ts
import { RawTcpPrinter, createEscPosBuilder } from '@baemingo/epson-printer-sdk';

const builder = createEscPosBuilder()
  .initialize()
  .align('center')
  .bold(true)
  .line('My Store')
  .bold(false)
  .align('left')
  .line('Item A      5.00')
  .line('Item B      3.00')
  .feed(1)
  .line('Total       8.00')
  .feed(2)
  .cut('partial');

const payload = builder.build();

// send through RawTcpPrinter
const printer = new RawTcpPrinter('192.168.0.50', {
  port: 9100,
  rawTcpClient,
});

await printer.sendRaw(payload);
```

## Production features included

- Device manager flow: `connect`, `createDevice`, `deleteDevice`, `disconnect`
- Explicit user-selected communication layer (`epos-xml` default, `raw-tcp` optional)
- Protocol-aware transport selection with injectable transport
- Request timeout controls
- Print-job aware send and status polling (`printJobId`, `getPrintJobStatus`)
- Expanded status bit decoding and monitor callbacks
- React Native-safe XML response parsing (no browser-only XML parser dependency)
- Raw TCP printer path with `sendRaw(data)` for direct byte/string payloads
- Optional ESC/POS byte builder utility for common receipt commands
- Epson v2.27-compatible manager constants for device types, ports, and error/result codes
- Epson-style create options handling (`boolean` maps to `crypto`, object supports `crypto` and `buffer`)
- Response payload parity fields (`printJobId` and `printjobid`)
- Epson-style error-event payload (`onerror` receives `{ status, responseText }`)

## Monitoring example

```ts
import { EpsonPrinter, EpsonPrint } from '@baemingo/epson-printer-sdk';

const printer = new EpsonPrinter('192.168.0.1', { timeout: 10000, protocol: 'http' });

printer.onstatuschange = (status) => {
  console.log('status changed:', status);
};

printer.onpapernearend = () => {
  console.log('paper near end');
};

printer.startMonitor({ intervalMs: 3000 });

const print = new EpsonPrint();
print.addText('Hello monitor mode\n');
await printer.send(print);

printer.stopMonitor();
```
