import * as utils from '../utils';

const REGEX_FONT = /^(font_[a-e]|special_[ab])$/;
const REGEX_ALIGN = /^(left|center|right)$/;
const REGEX_COLOR = /^(none|color_[1-4])$/;
const REGEX_FEED = /^(peeling|cutting|current_tof|next_tof)$/;
const REGEX_MODE = /^(mono|gray16)$/;
const REGEX_BARCODE =
  /^(upc_[ae]|[ej]an13|[ej]an8|code(39|93|128|128_auto)|itf|codabar|gs1_128|gs1_databar_(omnidirectional|truncated|limited|expanded))$/;
const REGEX_HRI = /^(none|above|below|both)$/;
const REGEX_SYMBOL =
  /^(pdf417_(standard|truncated)|qrcode_(model_[12]|micro)|maxicode_mode_[2-6]|gs1_databar_(stacked(_omnidirectional)?|expanded_stacked)|azteccode_(fullrange|compact)|datamatrix_(square|rectangle_(8|12|16)))$/;
const REGEX_LEVEL = /^(level_[0-8lmqh]|default)$/;
const REGEX_LINE = /^(thin|medium|thick)(_double)?$/;
const REGEX_DIRECTION = /^(left_to_right|bottom_to_top|right_to_left|top_to_bottom)$/;
const REGEX_CUT = /^(no_feed|feed|reserve|no_feed_fullcut|feed_fullcut|reserve_fullcut)$/;
const REGEX_DRAWER = /^drawer_[12]$/;
const REGEX_PULSE = /^pulse_[1-5]00$/;
const REGEX_PATTERN = /^(none|pattern_(10|[0-9a-e])|error|paper_end)$/;
const REGEX_LAYOUT = /^(receipt|label)(_bm)?$/;

export type EposImageOptions = {
  halftone?: 0 | 1 | 2;
  brightness?: number;
};

export class EposBuilderV227 {
  protected message = '';
  protected halftone = 0;
  protected brightness = 1;
  protected force = false;

  public setXmlString(xml: string) {
    this.message = xml;
    return this;
  }

  public getXmlString() {
    return this.message;
  }

  public clear() {
    this.message = '';
    return this;
  }

  public setForce(force: boolean) {
    this.force = force;
    return this;
  }

  public getForce() {
    return this.force;
  }

  public setImageOptions(options: EposImageOptions) {
    if (options.halftone !== undefined) {
      if (!Number.isInteger(options.halftone) || options.halftone < 0 || options.halftone > 2) {
        throw new Error('Property "halftone" is invalid');
      }

      this.halftone = options.halftone;
    }

    if (options.brightness !== undefined) {
      const brightness = Number(options.brightness);

      if (Number.isNaN(brightness) || brightness < 0.1 || brightness > 10) {
        throw new Error('Property "brightness" is invalid');
      }

      this.brightness = brightness;
    }

    return this;
  }

  public getImageOptions() {
    return {
      halftone: this.halftone,
      brightness: this.brightness,
    };
  }

  public addText(data: string) {
    this.addRow('text', utils.escapeMarkup(data));
    return this;
  }

  public addTextLang(lang: string) {
    this.message += '<text lang="' + lang + '"/>';
    return this;
  }

  public addTextAlign(align: string) {
    utils.getEnumAttr('align', align, REGEX_ALIGN);

    this.addRow('text', null, {
      align,
    });
    return this;
  }

  public addTextRotate(rotate: boolean | string) {
    this.message += '<text' + utils.getBoolAttr('rotate', rotate) + '/>';
    return this;
  }

  public addTextLineSpace(linespc: number | string) {
    const value = this.toNumber('linespc', linespc);
    utils.getUByteAttr('linespc', value);

    this.addRow('text', null, {
      linespc: value,
    });
    return this;
  }

  public addTextFont(font: string) {
    utils.getEnumAttr('font', font, REGEX_FONT);

    this.addRow('text', null, {
      font,
    });
    return this;
  }

  public addTextSmooth(smooth: boolean | string) {
    this.message += '<text' + utils.getBoolAttr('smooth', smooth) + '/>';
    return this;
  }

  public addTextDouble(dw: boolean | string, dh?: boolean | string) {
    var s = '';

    if (dw !== undefined) {
      s += utils.getBoolAttr('dw', dw);
    }

    if (dh !== undefined) {
      s += utils.getBoolAttr('dh', dh);
    }

    this.message += '<text' + s + '/>';
    return this;
  }

  public addTextSize(width: number | string, height: number | string) {
    const parsedWidth = this.toNumber('width', width);
    const parsedHeight = this.toNumber('height', height);

    utils.getIntAttr('width', parsedWidth, 1, 8);
    utils.getIntAttr('height', parsedHeight, 1, 8);

    this.addRow('text', null, {
      width: parsedWidth,
      height: parsedHeight,
    });
    return this;
  }

  public addTextStyle(reverse: boolean, ul: boolean, em: boolean, color: string) {
    utils.getEnumAttr('color', color, REGEX_COLOR);

    this.addRow('text', null, {
      reverse,
      ul,
      em,
      color,
    });
    return this;
  }

  public addTextPosition(x: number | string) {
    const value = this.toNumber('x', x);
    utils.getUShortAttr('x', value);

    this.addRow('text', null, {
      x: value,
    });
    return this;
  }

  public addTextVPosition(y: number | string) {
    const value = this.toNumber('y', y);
    utils.getUShortAttr('y', value);

    this.addRow('text', null, {
      y: value,
    });
    return this;
  }

  public addSymbol(
    data: string,
    type: string,
    level?: number | string,
    width?: number | string,
    height?: number | string,
    size?: number | string,
  ) {
    utils.getEnumAttr('type', type, REGEX_SYMBOL);

    let parsedWidth: number | undefined;
    let parsedHeight: number | undefined;
    let parsedSize: number | undefined;

    if (level !== undefined) {
      utils.getEnumIntAttr('level', level as unknown as number, REGEX_LEVEL, 0, 255);
    }

    if (width !== undefined) {
      parsedWidth = this.toNumber('width', width);
      utils.getUByteAttr('width', parsedWidth);
    }

    if (height !== undefined) {
      parsedHeight = this.toNumber('height', height);
      utils.getUByteAttr('height', parsedHeight);
    }

    if (size !== undefined) {
      parsedSize = this.toNumber('size', size);
      utils.getUShortAttr('size', parsedSize);
    }

    this.addRow('symbol', utils.escapeControl(utils.escapeMarkup(data)), {
      type,
      level,
      width: parsedWidth,
      height: parsedHeight,
      size: parsedSize,
    });
    return this;
  }

  public addFeedUnit(unit: number | string) {
    const value = this.toNumber('unit', unit);
    utils.getUByteAttr('unit', value);

    this.addRow('feed', null, {
      unit: value,
    });
    return this;
  }

  public addFeedLine(line: number | string) {
    const value = this.toNumber('line', line);
    utils.getUByteAttr('line', value);

    this.addRow('feed', null, {
      line: value,
    });
    return this;
  }

  public addFeed() {
    this.message += '<feed/>';
    return this;
  }

  public addFeedPosition(pos: string) {
    utils.getEnumAttr('pos', pos, REGEX_FEED);

    this.addRow('feed', null, {
      pos,
    });
    return this;
  }

  public addImage(
    base64ImageData: string,
    width: number | string,
    height: number | string,
    color?: string,
    mode?: string,
  ) {
    const parsedWidth = this.toNumber('width', width);
    const parsedHeight = this.toNumber('height', height);

    utils.getUShortAttr('width', parsedWidth);
    utils.getUShortAttr('height', parsedHeight);

    if (color !== undefined) {
      utils.getEnumAttr('color', color, REGEX_COLOR);
    }

    if (mode !== undefined) {
      utils.getEnumAttr('mode', mode, REGEX_MODE);
    }

    if (Number.isNaN(this.halftone) || this.halftone < 0 || this.halftone > 2) {
      throw new Error('Property "halftone" is invalid');
    }

    if (Number.isNaN(this.brightness) || this.brightness < 0.1 || this.brightness > 10) {
      throw new Error('Property "brightness" is invalid');
    }

    this.addRow('image', base64ImageData, {
      height: parsedHeight,
      width: parsedWidth,
      color,
      mode,
    });
    return this;
  }

  public addLogo(key1: number | string, key2: number | string) {
    const parsedKey1 = this.toNumber('key1', key1);
    const parsedKey2 = this.toNumber('key2', key2);

    utils.getUByteAttr('key1', parsedKey1);
    utils.getUByteAttr('key2', parsedKey2);

    this.addRow('logo', null, {
      key1: parsedKey1,
      key2: parsedKey2,
    });
    return this;
  }

  public addBarcode(
    data: string,
    type: string,
    hri?: string,
    font?: string,
    width?: number | string,
    height?: number | string,
  ) {
    utils.getEnumAttr('type', type, REGEX_BARCODE);

    let parsedWidth: number | undefined;
    let parsedHeight: number | undefined;

    if (hri !== undefined) {
      utils.getEnumAttr('hri', hri, REGEX_HRI);
    }

    if (font !== undefined) {
      utils.getEnumAttr('font', font, REGEX_FONT);
    }

    if (width !== undefined) {
      parsedWidth = this.toNumber('width', width);
      utils.getUByteAttr('width', parsedWidth);
    }

    if (height !== undefined) {
      parsedHeight = this.toNumber('height', height);
      utils.getUByteAttr('height', parsedHeight);
    }

    this.addRow('barcode', utils.escapeControl(utils.escapeMarkup(data)), {
      type,
      hri,
      font,
      width: parsedWidth,
      height: parsedHeight,
    });
    return this;
  }

  public addHLine(x1: number | string, x2: number | string, style?: string) {
    const parsedX1 = this.toNumber('x1', x1);
    const parsedX2 = this.toNumber('x2', x2);

    utils.getUShortAttr('x1', parsedX1);
    utils.getUShortAttr('x2', parsedX2);

    if (style !== undefined) {
      utils.getEnumAttr('style', style, REGEX_LINE);
    }

    this.addRow('hline', null, {
      x1: parsedX1,
      x2: parsedX2,
      style,
    });
    return this;
  }

  public addVLineBegin(x: number | string, style?: string) {
    const parsedX = this.toNumber('x', x);

    utils.getUShortAttr('x', parsedX);

    if (style !== undefined) {
      utils.getEnumAttr('style', style, REGEX_LINE);
    }

    this.addRow('vline-begin', null, {
      x: parsedX,
      style,
    });
    return this;
  }

  public addVLineEnd(x: number | string, style?: string) {
    const parsedX = this.toNumber('x', x);

    utils.getUShortAttr('x', parsedX);

    if (style !== undefined) {
      utils.getEnumAttr('style', style, REGEX_LINE);
    }

    this.addRow('vline-end', null, {
      x: parsedX,
      style,
    });
    return this;
  }

  public addRotateBegin() {
    this.message += '<rotate-begin/>';
    return this;
  }

  public addRotateEnd() {
    this.message += '<rotate-end/>';
    return this;
  }

  public addPageBegin() {
    this.message += '<page>';
    return this;
  }

  public addPageEnd() {
    this.message += '</page>';
    return this;
  }

  public addPageArea(x: number | string, y: number | string, width: number | string, height: number | string) {
    const parsedX = this.toNumber('x', x);
    const parsedY = this.toNumber('y', y);
    const parsedWidth = this.toNumber('width', width);
    const parsedHeight = this.toNumber('height', height);

    utils.getUShortAttr('x', parsedX);
    utils.getUShortAttr('y', parsedY);
    utils.getUShortAttr('width', parsedWidth);
    utils.getUShortAttr('height', parsedHeight);

    this.addRow('area', null, {
      x: parsedX,
      y: parsedY,
      width: parsedWidth,
      height: parsedHeight,
    });
    return this;
  }

  public addPageDirection(dir: string) {
    utils.getEnumAttr('dir', dir, REGEX_DIRECTION);

    this.addRow('direction', null, {
      dir,
    });
    return this;
  }

  public addPagePosition(x: number | string, y: number | string) {
    const parsedX = this.toNumber('x', x);
    const parsedY = this.toNumber('y', y);

    utils.getUShortAttr('x', parsedX);
    utils.getUShortAttr('y', parsedY);

    this.addRow('position', null, {
      x: parsedX,
      y: parsedY,
    });
    return this;
  }

  public addPageLine(
    x1: number | string,
    y1: number | string,
    x2: number | string,
    y2: number | string,
    style?: string,
  ) {
    const parsedX1 = this.toNumber('x1', x1);
    const parsedY1 = this.toNumber('y1', y1);
    const parsedX2 = this.toNumber('x2', x2);
    const parsedY2 = this.toNumber('y2', y2);

    utils.getUShortAttr('x1', parsedX1);
    utils.getUShortAttr('y1', parsedY1);
    utils.getUShortAttr('x2', parsedX2);
    utils.getUShortAttr('y2', parsedY2);

    if (style !== undefined) {
      utils.getEnumAttr('style', style, REGEX_LINE);
    }

    this.addRow('line', null, {
      x1: parsedX1,
      y1: parsedY1,
      x2: parsedX2,
      y2: parsedY2,
      style,
    });
    return this;
  }

  public addPageRectangle(
    x1: number | string,
    y1: number | string,
    x2: number | string,
    y2: number | string,
    style?: string,
  ) {
    const parsedX1 = this.toNumber('x1', x1);
    const parsedY1 = this.toNumber('y1', y1);
    const parsedX2 = this.toNumber('x2', x2);
    const parsedY2 = this.toNumber('y2', y2);

    utils.getUShortAttr('x1', parsedX1);
    utils.getUShortAttr('y1', parsedY1);
    utils.getUShortAttr('x2', parsedX2);
    utils.getUShortAttr('y2', parsedY2);

    if (style !== undefined) {
      utils.getEnumAttr('style', style, REGEX_LINE);
    }

    this.addRow('rectangle', null, {
      x1: parsedX1,
      y1: parsedY1,
      x2: parsedX2,
      y2: parsedY2,
      style,
    });
    return this;
  }

  public addLayout(
    type: string,
    width?: number | string,
    height?: number | string,
    marginTop?: number | string,
    marginBottom?: number | string,
    offsetCut?: number | string,
    offsetLabel?: number | string,
  ) {
    utils.getEnumAttr('type', type, REGEX_LAYOUT);

    let parsedWidth: number | undefined;
    let parsedHeight: number | undefined;
    let parsedMarginTop: number | undefined;
    let parsedMarginBottom: number | undefined;
    let parsedOffsetCut: number | undefined;
    let parsedOffsetLabel: number | undefined;

    if (width !== undefined) {
      parsedWidth = this.toNumber('width', width);
      utils.getUShortAttr('width', parsedWidth);
    }

    if (height !== undefined) {
      parsedHeight = this.toNumber('height', height);
      utils.getUShortAttr('height', parsedHeight);
    }

    if (marginTop !== undefined) {
      parsedMarginTop = this.toNumber('margin-top', marginTop);
      utils.getShortAttr('margin-top', parsedMarginTop);
    }

    if (marginBottom !== undefined) {
      parsedMarginBottom = this.toNumber('margin-bottom', marginBottom);
      utils.getShortAttr('margin-bottom', parsedMarginBottom);
    }

    if (offsetCut !== undefined) {
      parsedOffsetCut = this.toNumber('offset-cut', offsetCut);
      utils.getShortAttr('offset-cut', parsedOffsetCut);
    }

    if (offsetLabel !== undefined) {
      parsedOffsetLabel = this.toNumber('offset-label', offsetLabel);
      utils.getShortAttr('offset-label', parsedOffsetLabel);
    }

    this.addRow('layout', null, {
      type,
      width: parsedWidth,
      height: parsedHeight,
      'margin-top': parsedMarginTop,
      'margin-bottom': parsedMarginBottom,
      'offset-cut': parsedOffsetCut,
      'offset-label': parsedOffsetLabel,
    });
    return this;
  }

  public addCut(type?: string) {
    if (type !== undefined) {
      utils.getEnumAttr('type', type, REGEX_CUT);
    }

    this.addRow('cut', null, { type });
    return this;
  }

  public addSound(pattern?: string, repeat?: number | string, cycle?: number | string) {
    let parsedRepeat: number | undefined;
    let parsedCycle: number | undefined;

    if (pattern !== undefined) {
      utils.getEnumAttr('pattern', pattern, REGEX_PATTERN);
    }

    if (repeat !== undefined) {
      parsedRepeat = this.toNumber('repeat', repeat);
      utils.getUByteAttr('repeat', parsedRepeat);
    }

    if (cycle !== undefined) {
      parsedCycle = this.toNumber('cycle', cycle);
      utils.getUShortAttr('cycle', parsedCycle);
    }

    this.addRow('sound', null, {
      pattern,
      repeat: parsedRepeat,
      cycle: parsedCycle,
    });
    return this;
  }

  public addRecovery() {
    this.addRow('recovery');
    return this;
  }

  public addReset() {
    this.addRow('reset');
    return this;
  }

  public addCommand(data: string) {
    this.message += '<command>' + utils.toHexBinary(data) + '</command>';
    return this;
  }

  public addPulse(drawer?: string, pulse?: string) {
    if (drawer !== undefined) {
      utils.getEnumAttr('drawer', drawer, REGEX_DRAWER);
    }

    if (pulse !== undefined) {
      utils.getEnumAttr('time', pulse, REGEX_PULSE);
    }

    this.addRow('pulse', null, {
      drawer,
      time: pulse,
    });
    return this;
  }

  public toString() {
    var s = '';

    if (this.force) {
      s += ' force="true"';
    }

    return (
      '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"' +
      s +
      '>' +
      this.message +
      '</epos-print>'
    );
  }

  protected addRow(
    field: string,
    value?: string | null,
    fields?: Record<string, string | number | boolean | undefined>,
  ) {
    this.message += `<${field}`;

    if (fields) {
      for (const [key, fieldValue] of Object.entries(fields)) {
        if (fieldValue === undefined || fieldValue === null) {
          continue;
        }

        this.message += ` ${key}="${fieldValue}"`;
      }
    }

    if (!value) {
      this.message += '/>';
    } else {
      this.message += `>${value}</${field}>`;
    }
  }

  private toNumber(name: string, value: number | string) {
    const parsed = Number(value);

    if (Number.isNaN(parsed)) {
      throw new Error(`Parameter "${name}" is invalid`);
    }

    return parsed;
  }
}
