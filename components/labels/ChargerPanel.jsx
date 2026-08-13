'use client';

import { useState, useEffect } from 'react';
import chargersData from '@/data/chargers.json';
import chargerTemplatesConfig from '@/data/templates/charger-templates.json';
import chargerStandard from '@/data/templates/charger-standard.json';
import chargerCompact from '@/data/templates/charger-compact.json';

// 模板映射
const TEMPLATE_MAP = {
  'charger-standard.json': chargerStandard,
  'charger-compact.json': chargerCompact,
};

// 获取默认模板
const getDefaultTemplate = () => {
  const defaultConfig = chargerTemplatesConfig.templates.find(t => t.default);
  return defaultConfig || chargerTemplatesConfig.templates[0];
};

// 获取第一个型号
const getFirstModel = () => {
  const keys = Object.keys(chargersData);
  return keys.length > 0 ? keys[0] : 'CH-100W';
};

// 获取第一个颜色
const getFirstColor = (model) => {
  const charger = chargersData[model];
  return charger?.colors?.length > 0 ? charger.colors[0] : '';
};

// 自动获取当天的日期字符串
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ChargerPanel({ onDataChange }) {
  const firstModel = getFirstModel();

  // ===== 状态 =====
  const [model, setModel] = useState(firstModel);
  const [color, setColor] = useState(getFirstColor(firstModel));
  const [barcodeText, setBarcodeText] = useState(getTodayDateString());
  const [copies, setCopies] = useState(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState(getDefaultTemplate().id);

  // ===== 计算属性 =====
  const modelList = Object.keys(chargersData);
  const currentCharger = chargersData[model];

  const currentTemplateConfig = chargerTemplatesConfig.templates.find(
    t => t.id === selectedTemplateId
  ) || getDefaultTemplate();

  const currentTemplate = TEMPLATE_MAP[currentTemplateConfig.templateFile] || chargerStandard;

  const colorOptions = currentCharger?.colors || [];

  // ===== 当型号切换时，更新颜色 =====
  useEffect(() => {
    if (currentCharger?.colors?.length > 0) {
      setColor(currentCharger.colors[0]);
    }
  }, [model]);

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

    if (el.printElementType?.type === 'text' && el.options?.title) {
      el.options.title = replacePlaceholders(el.options.title, data, index);
    }

    if (el.printElementType?.type === 'barcode' && el.options?.testData) {
      el.options.testData = replacePlaceholders(el.options.testData, data, index);
    }

    return el;
  };

  // ===== 构建打印数据 =====
  const getPrintData = () => {
    const result = [];
    for (let i = 0; i < copies; i++) {
      result.push({
        model: model,
        color: color,
        inputVoltage: currentCharger?.inputVoltage || '',
        inputCurrent: currentCharger?.inputCurrent || '',
        outputVoltage: currentCharger?.outputVoltage || '',
        outputCurrent: currentCharger?.outputCurrent || '',
        power: currentCharger?.power || '',
        barcode: barcodeText || 'CH-001',
      });
    }
    return result;
  };

  // ===== 构建模板 =====
  const buildTemplate = () => {
    if (!currentTemplate || !currentTemplate.panels) {
      return { panels: [{ width: 60, height: 30, printElements: [] }] };
    }

    const printDataList = getPrintData();

    if (printDataList.length === 0) {
      return { panels: [{ width: 60, height: 30, printElements: [] }] };
    }

    const panels = printDataList.map((dataItem, index) => {
      const panelCopy = JSON.parse(JSON.stringify(currentTemplate.panels[0]));
      panelCopy.width = currentTemplateConfig.width;
      panelCopy.height = currentTemplateConfig.height;
      panelCopy.printElements = panelCopy.printElements.map((element) => {
        return renderElement(element, dataItem, index);
      });
      panelCopy.index = index;
      panelCopy.name = `${dataItem.model || 'Charger'}-${index + 1}`;
      return panelCopy;
    });

    return { panels };
  };

  // ===== 模板切换 =====
  const handleTemplateChange = (templateId) => {
    setSelectedTemplateId(templateId);
  };

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
  }, [model, color, barcodeText, copies, selectedTemplateId]);

  // ===== 渲染 =====
  return (
    <div>
      {/* 模板选择 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-700">📐 标签模板</h3>
          <span className="text-xs text-gray-400">
            当前: {currentTemplateConfig.name}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {chargerTemplatesConfig.templates.map((template) => (
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

      <h3 className="font-semibold text-gray-700 border-b pb-2 mb-3">
        🔌 充电器选择
      </h3>

      <div className="grid grid-cols-3 gap-4">
        {/* 型号 */}
        <div>
          <label className="block text-sm font-medium text-gray-600">型号</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white"
          >
            {modelList.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
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

        {/* 条码 */}
        <div>
          <label className="block text-sm font-medium text-gray-600">条形码</label>
          <input
            type="text"
            value={barcodeText}
            onChange={(e) => setBarcodeText(e.target.value)}
            placeholder="请输入条形码"
            className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white"
          />
        </div>
      </div>

      {/* 充电器信息展示 */}
      <div className="mt-3 text-xs text-gray-500 bg-white p-2 rounded border border-gray-200">
        <span>⚡输入: {currentCharger?.inputVoltage || '—'}</span>
        <span className="px-4">输出: {currentCharger?.outputVoltage || '—'}</span>
        <span>颜色: {color || '未选择'}</span>
      </div>

      {/* 份数控制 */}
      <div className="mt-3 flex items-center gap-3">
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
  );
}