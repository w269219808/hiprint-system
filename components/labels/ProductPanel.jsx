'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import productsData from '@/data/products.json';
import productTemplatesConfig from '@/data/templates/product-templates.json';
import standardTemplate from '@/data/templates/product-standard.json';
import largeTemplate from '@/data/templates/product-large.json';
import smallTemplate from '@/data/templates/product-small.json';
import wideTemplate from '@/data/templates/product-wide.json';
import { colorTranslation } from '@/data/colors';
import { getNextBarcode, getPreviewBarcodes, allocateBarcodes } from '@/lib/barcodeCounter';

// 模板映射
const TEMPLATE_MAP = {
  'product-standard.json': standardTemplate,
  'product-large.json': largeTemplate,
  'product-small.json': smallTemplate,
  'product-wide.json': wideTemplate,
};

// 获取默认模板
const getDefaultTemplate = () => {
  const defaultConfig = productTemplatesConfig.templates.find(t => t.default);
  return defaultConfig || productTemplatesConfig.templates[0];
};

const ProductPanel = forwardRef(function ProductPanel({ onDataChange }, ref) {
  // ===== 状态 =====
  // 初始为空字符串：避免服务端渲染时读取 localStorage/日期导致 hydration 不一致，
  // 真实条形码在挂载后通过 useEffect 填充
  const [barcodeText, setBarcodeText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(getDefaultTemplate().id);
  const [model, setModel] = useState('DL3500');
  const [selectedCapacity, setSelectedCapacity] = useState('');
  const [color, setColor] = useState('');
  const [lang, setLang] = useState('中文');
  const [copies, setCopies] = useState(1);

  // ===== 计算属性 =====
  const modelList = Object.keys(productsData);
  const currentProduct = productsData[model];
  const isMultiCapacity = currentProduct?.isMultiCapacity === true;

  const currentTemplateConfig = productTemplatesConfig.templates.find(
    t => t.id === selectedTemplateId
  ) || getDefaultTemplate();

  const currentTemplate = TEMPLATE_MAP[currentTemplateConfig.templateFile] || standardTemplate;

  const capacityOptions = isMultiCapacity
    ? (currentProduct?.capacities || []).map((c) => c.label)
    : [];

  const getColorOptions = () => {
    if (!currentProduct) return [];
    if (isMultiCapacity) {
      const matched = (currentProduct.capacities || []).find(
        (c) => c.label === selectedCapacity
      );
      return matched?.colors || [];
    }
    return currentProduct.colors || [];
  };

  const getDisplayCapacity = () => {
    if (!currentProduct) return '';
    if (isMultiCapacity) {
      return selectedCapacity || '请选择容量';
    }
    return currentProduct.capacity || '';
  };

  const colorOptions = getColorOptions();

  // ===== 产品逻辑 =====
  const applyModelDefaults = (targetModel) => {
    const product = productsData[targetModel];
    if (!product) return;

    if (product.isMultiCapacity) {
      const firstCap = product.capacities?.[0]?.label || '';
      setSelectedCapacity(firstCap);
      const matchedColors = product.capacities?.find((c) => c.label === firstCap)?.colors || [];
      setColor(matchedColors[0] || '');
    } else {
      setSelectedCapacity(product.capacity || '');
      setColor(product.colors?.[0] || '');
    }
  };

  const handleModelChange = (newModel) => {
    setModel(newModel);
    applyModelDefaults(newModel);
  };

  const handleCapacityChange = (newCapacity) => {
    setSelectedCapacity(newCapacity);
    const matched = (currentProduct?.capacities || []).find(
      (c) => c.label === newCapacity
    );
    const colors = matched?.colors || [];
    setColor(colors[0] || '');
  };

  const handleTemplateChange = (templateId) => {
    const config = productTemplatesConfig.templates.find(t => t.id === templateId);
    if (config) {
      setSelectedTemplateId(templateId);
    }
  };

  // ===== 占位符替换 =====
  const replacePlaceholders = (text, data, index) => {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (match, field) => {
      if (field === 'index') return String(index + 1);
      const value = data[field];
      return value !== undefined && value !== null ? String(value) : match;
    });
  };

  // ===== 渲染元素 =====
  const renderElement = (element, data, index) => {
    const el = JSON.parse(JSON.stringify(element));
    const isEnglish = data?.lang === '英文';

    if (el.printElementType?.type === 'text' && el.options?.title) {
      let title = el.options.title;
      title = replacePlaceholders(title, data, index);

      if (title.includes('颜色：') || title.includes('Color:')) {
        const colorValue = data?.color || '';
        const translatedColor = isEnglish
          ? (colorTranslation['英文'][colorValue] || colorValue)
          : colorValue;
        title = isEnglish ? `Color: ${translatedColor}` : `颜色：${translatedColor}`;
      }
      if (title === '电量显示版' || title.includes('电量显示版')) {
        title = isEnglish ? 'Power Display' : '电量显示版';
      }
      el.options.title = title;
    }

    if (el.printElementType?.type === 'barcode' && el.options?.testData) {
      el.options.testData = replacePlaceholders(el.options.testData, data, index);
    }
    return el;
  };

  // ===== 构建打印数据 =====
  // barcodeList 传值时使用指定条形码（打印时分配），否则生成不消耗序号的预览条形码
  const getPrintData = (barcodeList) => {
    const result = [];
    const voltage = currentProduct?.voltage || '14.8V';
    const capacityStr = getDisplayCapacity();
    const specText = `${voltage} - ${capacityStr}`;
    const barcodeCodes = barcodeList || getPreviewBarcodes(copies);

    for (let i = 0; i < copies; i++) {
      result.push({
        model: model,
        color: color,
        capacity: specText,
        voltage: voltage,
        barcode: (barcodeCodes[i] ?? barcodeText) || '202608140',
        lang: lang,
      });
    }
    return result;
  };

  // ===== 构建模板 =====
  const buildTemplate = (printDataListOverride) => {
    if (!currentTemplate || !currentTemplate.panels) {
      return { panels: [{ width: 100, height: 60, printElements: [] }] };
    }

    const printDataList = printDataListOverride || getPrintData();

    if (printDataList.length === 0) {
      return { panels: [{ width: 100, height: 60, printElements: [] }] };
    }

    const panels = printDataList.map((dataItem, index) => {
      const panelCopy = JSON.parse(JSON.stringify(currentTemplate.panels[0]));
      panelCopy.width = currentTemplateConfig.width;
      panelCopy.height = currentTemplateConfig.height;
      panelCopy.printElements = panelCopy.printElements.map((element) => {
        return renderElement(element, dataItem, index);
      });
      panelCopy.index = index;
      panelCopy.name = `${dataItem.model || 'Label'}-${index + 1}`;
      return panelCopy;
    });

    return { panels };
  };

  // ===== 打印时分配条形码序号 =====
  useImperativeHandle(ref, () => ({
    allocateBarcodes: (count) => {
      // 未传数量时以面板当前“打印份数”为准
      const n = Math.max(
        1,
        Number.isFinite(Number(count)) ? Math.floor(Number(count)) : Math.max(1, copies)
      );
      const { codes, next } = allocateBarcodes(n);
      setBarcodeText(next);
      const printDataList = getPrintData(codes);
      const template = buildTemplate(printDataList);
      return { printData: printDataList, template };
    },
  }));

  // ===== 初始化 =====
  useEffect(() => {
    setBarcodeText(getNextBarcode());
    applyModelDefaults(model);
  }, []);

  // ===== 数据变化时通知父组件 =====
  useEffect(() => {
    onDataChange?.({
      printData: getPrintData(),
      template: buildTemplate(),
      copies: copies,
      paperSize: {
        width: currentTemplateConfig.width,
        height: currentTemplateConfig.height
      },
      templateName: currentTemplateConfig.name,
    });
  }, [model, selectedCapacity, color, lang, barcodeText, copies, selectedTemplateId]);

  // ===== 渲染 =====
  return (
    <div>
      {/* 模板选择区 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-700">📐 标签模板</h3>
          <span className="text-xs text-gray-400">
            当前: {currentTemplateConfig.name}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {productTemplatesConfig.templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateChange(template.id)}
              className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                selectedTemplateId === template.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {template.preview}
              {template.default && (
                <span className="ml-1 text-[10px] opacity-70">⭐</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 产品选择 */}
      <div>
        <h3 className="font-semibold text-gray-700 border-b pb-2 mb-3">
          🎯 产品选择
        </h3>

        <div className="grid grid-cols-4 gap-4">
          {/* 型号 */}
          <div>
            <label className="block text-sm font-medium text-gray-600">型号</label>
            <select
              value={model}
              onChange={(e) => handleModelChange(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white"
            >
              {modelList.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* 语言 */}
          <div>
            <label className="block text-sm font-medium text-gray-600">标签语言</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white"
            >
              <option value="中文">中文</option>
              <option value="英文">English</option>
            </select>
            <span className="text-xs text-gray-400 block mt-1">控制打印标签的语言</span>
          </div>

          {/* 容量 */}
          <div>
            <label className="block text-sm font-medium text-gray-600">
              容量 {isMultiCapacity && <span className="text-xs text-blue-500">（可切换）</span>}
            </label>
            {isMultiCapacity ? (
              <select
                value={selectedCapacity}
                onChange={(e) => handleCapacityChange(e.target.value)}
                className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white"
              >
                {capacityOptions.map((cap) => (
                  <option key={cap} value={cap}>{cap}</option>
                ))}
              </select>
            ) : (
              <div className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700">
                {getDisplayCapacity() || '—'}
              </div>
            )}
          </div>

          {/* 颜色 */}
          <div>
            <label className="block text-sm font-medium text-gray-600">颜色</label>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white"
            >
              {colorOptions.length > 0 ? (
                colorOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))
              ) : (
                <option value="">暂无颜色</option>
              )}
            </select>
          </div>
        </div>

        {/* 条形码 */}
        <div className="my-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            条形码内容 (Code128):
          </label>
          <input
            type="text"
            value={barcodeText}
            readOnly
            placeholder="自动生成（如：202608140）"
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-xs text-gray-400 block mt-1">
            格式：日期(YYYYMMDD) + 序号，每天从 0 开始，每打印一张自动 +1
          </span>
        </div>

        {/* 摘要 */}
        <div className="mt-3 text-xs text-gray-500 bg-white p-2 rounded border border-gray-200">
          预览数据: Model: {model} ｜ 标签语言: {lang} ｜ {getDisplayCapacity()} ｜ {color} ｜ 条形码: {barcodeText}
        </div>

        {/* 份数 */}
        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm text-gray-600">打印份数</label>
          <input
            type="number"
            min="1"
            value={copies}
            onChange={(e) => setCopies(Number(e.target.value))}
            className="w-16 p-1.5 border border-gray-300 rounded-md text-center"
          />
          <span className="text-xs text-gray-400">生成 {getPrintData().length} 个标签</span>
        </div>
      </div>
    </div>
  );
});

export default ProductPanel;
