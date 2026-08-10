'use client';

import { useState, useEffect } from 'react';
import HiprintButton from '@/HiprintButton';

// 导入数据
import productsData from '@/data/products.json';
// 导入模板配置
import productTemplatesConfig from '@/data/templates/product-templates.json';
// 导入各个模板
import standardTemplate from '@/data/templates/product-standard.json';
import largeTemplate from '@/data/templates/product-large.json';
import smallTemplate from '@/data/templates/product-small.json';
import wideTemplate from '@/data/templates/product-wide.json';


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

// 自动获取当天的日期字符串
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function HomePage() {
  // ===== 状态 =====
  const [activeType, setActiveType] = useState('product');
  const [barcodeText, setBarcodeText] = useState(getTodayDateString());
  const [isSpecial, setIsSpecial] = useState(false);

  // ===== 模板选择 =====
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    getDefaultTemplate().id
  );

  // 获取当前选中的模板配置
  const currentTemplateConfig = productTemplatesConfig.templates.find(
    t => t.id === selectedTemplateId
  ) || getDefaultTemplate();

  // 获取当前模板的 JSON
  const currentTemplate = TEMPLATE_MAP[currentTemplateConfig.templateFile] || standardTemplate;

  // ===== 产品相关 =====
  const modelList = Object.keys(productsData);
  const [model, setModel] = useState(modelList[0] || 'DL3500');
  const [selectedCapacity, setSelectedCapacity] = useState('');
  const [color, setColor] = useState('');
  const [lang, setLang] = useState('中文');

  // ===== 纸张设定（由模板自动控制） =====
  const [paperWidth, setPaperWidth] = useState(currentTemplateConfig.width);
  const [paperHeight, setPaperHeight] = useState(currentTemplateConfig.height);

  // ===== 打印份数 =====
  const [copies, setCopies] = useState(1);

  // 当前选中的产品对象
  const currentProduct = productsData[model];
  const isMultiCapacity = currentProduct?.isMultiCapacity === true;

  // 获取可选项
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

  // 初始化和切换型号的逻辑
  const applyModelDefaults = (targetModel) => {
    const product = productsData[targetModel];
    if (!product) return;

    if (product.isMultiCapacity) {
      const firstCap = product.capacities?.[0]?.label || '';
      setSelectedCapacity(firstCap);
      const matchedColors =
        product.capacities?.find((c) => c.label === firstCap)?.colors || [];
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

  // ===== 切换模板 =====
  const handleTemplateChange = (templateId) => {
    const config = productTemplatesConfig.templates.find(t => t.id === templateId);
    if (config) {
      setSelectedTemplateId(templateId);
      setPaperWidth(config.width);
      setPaperHeight(config.height);
    }
  };

  // 1. 构建打印数据
  const getPrintData = () => {
    const result = [];
    const voltage = currentProduct?.voltage || '14.8V';
    const capacityStr = getDisplayCapacity();
    const specText = `${voltage} - ${capacityStr}`;

    for (let i = 0; i < copies; i++) {
      result.push({
        model: model,
        color: color,
        capacity: specText,
        voltage: voltage,
        barcode: barcodeText || '2026-0808',
      });
    }
    return result;
  };

  // 2. 核心：动态生成模板结构
  const buildTemplate = () => {
    if (!currentTemplate || !currentTemplate.panels) {
      return { panels: [{ width: paperWidth, height: paperHeight, printElements: [] }] };
    }

    const printDataList = getPrintData();

    if (printDataList.length === 0) {
      return { panels: [{ width: paperWidth, height: paperHeight, printElements: [] }] };
    }

    const panels = printDataList.map((dataItem, index) => {
      const panelCopy = JSON.parse(JSON.stringify(currentTemplate.panels[0]));

      panelCopy.width = paperWidth;
      panelCopy.height = paperHeight;

      panelCopy.printElements = panelCopy.printElements.map((element) => {
        return renderElement(element, dataItem, index);
      });

      panelCopy.index = index;
      panelCopy.name = `${dataItem.model || '标签'}-${index + 1}`;

      return panelCopy;
    });

    return { panels };
  };

  // ===== 元素渲染函数 =====
  const renderElement = (element, data, index) => {
    const el = JSON.parse(JSON.stringify(element));

    if (el.printElementType?.type === 'text' && el.options?.title) {
      el.options.title = replacePlaceholders(el.options.title, data, index);
    }

    if (el.printElementType?.type === 'barcode' && el.options?.testData) {
      el.options.testData = replacePlaceholders(el.options.testData, data, index);
    }

    return el;
  };

  // ===== 占位符替换函数 =====
  const replacePlaceholders = (text, data, index) => {
    if (!text || typeof text !== 'string') return text;

    return text.replace(/\{\{([^}]+)\}\}/g, (match, field) => {
      if (field === 'index') return String(index + 1);
      const value = data[field];
      return value !== undefined && value !== null ? String(value) : match;
    });
  };

  // 组件首次挂载时初始化
  useEffect(() => {
    applyModelDefaults(model);
  }, []);

  // 当模板切换时更新纸张尺寸
  useEffect(() => {
    setPaperWidth(currentTemplateConfig.width);
    setPaperHeight(currentTemplateConfig.height);
  }, [selectedTemplateId]);

  const isProduct = activeType === 'product';

  return (
    <main className="p-8 max-w-6xl mx-auto font-sans"
      style={{
        width: '100%',
        maxWidth: '800px',
        minWidth: '300px'
      }}>
      <h1 className="text-2xl font-bold mb-6 text-center">
        🏷️ 蓝铭电子标签打印控制台
      </h1>

      {/* 标签类型选择 */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveType('product')}
          className={`px-4 py-2 rounded-lg border transition-all ${
            activeType === 'product'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          📦 产品标签
        </button>
        <button
          onClick={() => setActiveType('carton')}
          className={`px-4 py-2 rounded-lg border transition-all ${
            activeType === 'carton'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          📋 外箱标签
        </button>
      </div>
      {/* 模板选择区 */}
      <div className="border border-gray-200 p-6 rounded-xl bg-gray-50 shadow-sm space-y-5">
        <div>
          <div className="flex items-center justify-between mb-3">
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

        {/* 产品选择区 */}
        {isProduct && (
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
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* 中英文 */}
              <div>
                <label className="block text-sm font-medium text-gray-600">中英文</label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white"
                >
                  <option value="中文">中文</option>
                  <option value="英文">英文</option>
                </select>
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
                      <option key={cap} value={cap}>
                        {cap}
                      </option>
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
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))
                  ) : (
                    <option value="">暂无颜色</option>
                  )}
                </select>
              </div>
            </div>

            {/* 条形码设置 */}
            <div className="my-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                条形码内容 (Code128):
              </label>
              <input
                type="text"
                value={barcodeText}
                onChange={(e) => setBarcodeText(e.target.value)}
                placeholder="请输入条形码字符（如：2026-0808）"
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {/* 当前选择摘要 */}
            <div className="mt-3 text-xs text-gray-500 bg-white p-2 rounded border border-gray-200">
              预览数据: Model: {model} ｜ {lang} ｜ {getDisplayCapacity()} ｜ {color} ｜ 条形码: {barcodeText}
            </div>
          </div>
        )}

        {/* 打印份数 & 纸张尺寸 */}
        <div className="flex items-center gap-4 text-sm border-t pt-4 flex-wrap">
          <span className="font-semibold text-gray-700">🖨️ 打印</span>
          <label className="text-gray-600">份数</label>
          <input
            type="number"
            min="1"
            value={copies}
            onChange={(e) => setCopies(Number(e.target.value))}
            className="w-16 p-1.5 border border-gray-300 rounded-md text-center"
          />
          <span className="text-gray-400 text-xs">生成 {getPrintData().length} 个标签</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">📐 {paperWidth}×{paperHeight}mm</span>
          <span className="text-xs text-gray-400">(切换模板自动调整)</span>
        </div>

        {/* 打印执行按钮 */}
        {/* 打印执行按钮 */}
        <div className="flex items-center gap-3 border-t pt-4">
          <span className="font-semibold text-gray-700 text-sm">🖨️</span>
          <HiprintButton
            templateData={buildTemplate()}
            printData={getPrintData()}
            buttonText="🔊 预览打印"
          />
          <HiprintButton
            templateData={buildTemplate()}
            printData={getPrintData()}
            buttonText="🖨️ 直接打印"
            silent={true}
          />
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-400 border-t pt-3">
        当前标签类型: <strong>{activeType}</strong> ｜
        模板: <strong>{currentTemplateConfig.name}</strong> ｜
        纸张: <strong>{paperWidth}×{paperHeight}mm</strong> ｜
        打印张数: <strong>{getPrintData().length}</strong>
      </div>
    </main>
  );
}