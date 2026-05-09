# Changelog

## 09/05/2026 Unreleased

- Start v2.27 migration implementation for LAN mode
- Add internal v2.27 core builder module (`src/core/epos-builder-v227.ts`)
- Refactor `EpsonPrint` to extend the internal core builder with direct v2.27 positional signatures
- Add page and layout print APIs:
  - `addPageBegin`, `addPageEnd`, `addPageArea`, `addPageDirection`, `addPagePosition`, `addPageLine`, `addPageRectangle`, `addLayout`
- Port strict Epson v2.27 parameter validation into the internal builder
- Remove compatibility shim layer for old call signatures and aliases (`addQRCode`, options-object `addSymbol`, `kickOutDrawer`, `recover`, `reset`)
- Add symbol constants on `EpsonPrint` for Epson sample parity
- Fix malformed XML output in `addFeedUnit`
- Add LAN status monitor and event callback model on `EpsonPrinter`:
  - `startMonitor`, `stopMonitor`, `dispose`
  - `onreceive`, `onstatuschange`, `ononline`, `onoffline`, `onpoweroff`, `oncoveropen`, `oncoverok`, `onpaperok`, `onpapernearend`, `onpaperend`, `ondraweropen`, `ondrawerclosed`, `onbatterystatuschange`
- Export new TS types from index:
  - `EpsonPrintResponse`, `EpsonPrinterStatus`, `EpsonPrinterOptions`, `EpsonStatusMonitorOptions`
- Export `decodeEpsonStatus` helper and add XML/status regression tests (`src/tests/regression.ts`)
- Add RN-safe transport abstraction (`src/transport.ts`) with protocol-aware request routing
- Add real device-manager layer (`src/device-manager.ts`) with `connect/createDevice/deleteDevice/disconnect`
- Make device-manager-first exports the package default while retaining direct `EpsonPrinter` access
- Add built-in HTTP/HTTPS transport and TCP adapter support through injectable `tcpClient`
- Add print job support (`printJobId` header on send and `getPrintJobStatus`)
- Expand status bit coverage and decoded status shape for production operations
- Add error callback hook (`onerror`) and request timeout enforcement through transport layer
- Update README to explicitly document XML-builder scope (not browser raster parity) and connection model
- Align `EpsonDeviceManager` constants with Epson v2.27 names (device type, ports, and open/close/not-open error codes)
- Align `createDevice` option parsing with Epson behavior (`boolean` as crypto flag, object `crypto`/`buffer`)
- Align `connect` behavior with Epson flow (disconnect before reconnect and ePOS port-based protocol inference)
- Align printer status event semantics with Epson v2.27 (`status==0` no-response merge and no-response gating for cover/paper/drawer callbacks)
- Normalize Epson timeout code mapping (`EX_ENPC_TIMEOUT` -> `ERROR_DEVICE_BUSY`)
- Add response field parity alias (`printjobid`) alongside `printJobId`
- Align `onerror` callback payload shape to Epson style (`{ status, responseText }`)
- Add explicit communication layer selection (`epos-xml` default, `raw-tcp` optional) on manager connect/create flows
- Add raw TCP byte client contracts and `RawTcpPrinter.sendRaw(data)` for React Native direct socket payloads
- Add manager raw layer device factory path returning raw printer instances when `layer` is `raw-tcp`
- Export raw layer types and raw printer class from package entrypoint
- Add optional ESC/POS byte utility module (`EscPosBuilder`) for common raw TCP receipt commands

## 31/03/2023 0.9.11

- Bugfix for Symbols

## 21/03/2023 0.9.10

- Add separate QR code API

## 21/03/2023 0.9.9

- Add support for Symbols / QR Codes

## 21/03/2023 0.9.8

- Updated compiled export

## 20/03/2023 0.9.7

- Initial release
