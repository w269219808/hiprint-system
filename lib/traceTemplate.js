// src/lib/traceTemplate.js
import traceTemplate from '@/data/templates/trace-standard.json';

export const TRACE_PAPER_CONFIG = {
  name: '3列连排标准追溯码标签',
  preview: '3连排标签 (94x10mm)',
  width: 94,
  height: 10,
};

export function formatShowCode(code) {
  if (!code || typeof code !== 'string' || code.length < 14) return code;
  return `${code.slice(0, 4)} ${code.slice(4, 8)} ${code.slice(8, 14)} ${code.slice(14)}`;
}

function replacePlaceholders(value, data) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{([^}]+)\}\}/g, (_, field) => (
    data[field] !== undefined ? String(data[field]) : ''
  ));
}

function getCodeField(element) {
  const values = [
    element?.options?.title,
    element?.options?.testData,
  ].filter((value) => typeof value === 'string');

  for (const value of values) {
    const match = value.match(/\{\{(?:show)?code([1-3])\}\}/i);
    if (match) return `code${match[1]}`;
  }
  return null;
}

// 模板里的字段名已经明确对应第 1/2/3 列，不能再用元素 x 坐标猜列号。
function renderElement(element, data) {
  const el = JSON.parse(JSON.stringify(element));

  if (el.printElementType?.type === 'barcode') {
    el.options.testData = replacePlaceholders(el.options.testData, data);
    if (el.options.text !== undefined) {
      el.options.text = replacePlaceholders(el.options.text, data);
    }
  }

  if (el.printElementType?.type === 'text') {
    el.options.title = replacePlaceholders(el.options.title || '', data);
  }

  return el;
}

export function buildPrintDataFromCodes(codes = [], copiesPerCode = 1) {
  const expanded = [];
  codes.forEach((code) => {
    const showCode = formatShowCode(code);
    for (let i = 0; i < Math.max(1, copiesPerCode); i++) {
      expanded.push({ code, showCode });
    }
  });

  const result = [];
  for (let i = 0; i < expanded.length; i += 3) {
    result.push({
      code1: expanded[i]?.code || '',
      showCode1: expanded[i]?.showCode || '',
      code2: expanded[i + 1]?.code || '',
      showCode2: expanded[i + 1]?.showCode || '',
      code3: expanded[i + 2]?.code || '',
      showCode3: expanded[i + 2]?.showCode || '',
    });
  }
  return result;
}

export function buildTraceTemplate(printDataList, paperConfig = TRACE_PAPER_CONFIG) {
  if (!traceTemplate?.panels?.length) {
    return { panels: [{ width: paperConfig.width, height: paperConfig.height, printElements: [] }] };
  }

  const panels = printDataList.map((dataItem, index) => {
    const panelCopy = JSON.parse(JSON.stringify(traceTemplate.panels[0]));
    panelCopy.width = paperConfig.width;
    panelCopy.height = paperConfig.height;

    panelCopy.printElements = panelCopy.printElements
      .filter((el) => {
        const codeField = getCodeField(el);
        return !codeField || Boolean(dataItem[codeField]);
      })
      .map((el) => renderElement(el, dataItem));

    panelCopy.index = index;
    panelCopy.name = `Row-${index + 1}`;
    return panelCopy;
  });

  return { panels };
}
