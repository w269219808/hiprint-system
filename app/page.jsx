'use client';

import { useState, useEffect } from 'react';
import defaultTemplates from '../data/templates.json';
import HiprintButton from '../HiprintButton';

const LABEL_TYPES = [
  { key: 'product', label: '📦 产品标签' },
  { key: 'carton', label: '📋 外箱标签' },
  { key: 'customer', label: '👤 装箱号标签' },
  { key: 'company', label: '🏢 公司标签' },
];

// 型号列表（从 productData 里提取）
const getModelList = () => {
  const data = defaultTemplates.product?.productData || {};
  return Object.keys(data);
};

// 自动获取当天的日期字符串（格式如：2026-08-08）
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`; // 如果不需要短横线，可以改成 `${year}${month}${day}`
};

export default function HomePage() {
  const [activeType, setActiveType] = useState('product');
// 默认填入当天日期
  const [barcodeText, setBarcodeText] = useState(getTodayDateString());
  const [isSpecial, setIsSpecial] = useState(false);

  // ===== 产品选择 =====
  const [model, setModel] = useState('DL3500');
  const [selectedCapacity, setSelectedCapacity] = useState('');
  const [color, setColor] = useState('');
  const [lang, setLang] = useState('中文');

  // ===== 纸张 =====
  const [paperWidth, setPaperWidth] = useState(60);
  const [paperHeight, setPaperHeight] = useState(40);

  // ===== 打印份数 =====
  const [copies, setCopies] = useState(1);

  // 根据语言 + 特殊开关 决定用哪个模板 key
  const getTemplateKey = () => {
    if (isSpecial) return 'special';
    return lang === '中文' ? 'zh' : 'en';
  };

  // 获取产品数据
  const productData = defaultTemplates.product?.productData || {};
  const currentProduct = productData[model];

  // 判断是否是 DN1700NS 这种多容量型号
  const isMultiCapacity = currentProduct?.isMultiCapacity === true;

  // 获取容量列表（如果是多容量型号）
  const capacityOptions = isMultiCapacity
    ? (currentProduct?.capacities || []).map((c) => c.label)
    : [];

  // 获取当前选中的容量对应的颜色列表
  const getColorOptions = () => {
    if (!currentProduct) return [];

    if (isMultiCapacity) {
      const matched = (currentProduct.capacities || []).find(
        (c) => c.label === selectedCapacity
      );
      return matched?.colors || [];
    } else {
      return currentProduct.colors || [];
    }
  };

  // 当前容量显示
  const getDisplayCapacity = () => {
    if (!currentProduct) return '';
    if (isMultiCapacity) {
      return selectedCapacity || '请选择容量';
    }
    return currentProduct.capacity || '';
  };

  // 可用的颜色列表
  const colorOptions = getColorOptions();

  // 切换型号时的处理
  const handleModelChange = (newModel) => {
    setModel(newModel);
    const product = productData[newModel];

    if (product?.isMultiCapacity) {
      const firstCapacity = product.capacities?.[0]?.label || '';
      setSelectedCapacity(firstCapacity);
      const firstColors = product.capacities?.find((c) => c.label === firstCapacity)?.colors || [];
      setColor(firstColors[0] || '');
    } else {
      const colors = product?.colors || [];
      setColor(colors[0] || '');
    }
  };

  // 切换容量时的处理（仅多容量型号）
  const handleCapacityChange = (newCapacity) => {
    setSelectedCapacity(newCapacity);
    const matched = (currentProduct?.capacities || []).find((c) => c.label === newCapacity);
    const colors = matched?.colors || [];
    setColor(colors[0] || '');
  };

  const handleTypeChange = (typeKey) => {
    setActiveType(typeKey);
    const t = defaultTemplates[typeKey];
    setPaperWidth(t?.defaultWidth || 60);
    setPaperHeight(t?.defaultHeight || 40);
  };

  // 构建打印数据列表
  const getPrintData = () => {
    const result = [];
    const displayCapacity = getDisplayCapacity();
    const templateKey = getTemplateKey();

    for (let i = 0; i < copies; i++) {
      result.push({
        templateId: templateKey,
        model: model,
        capacity: displayCapacity,
        color: color,
        lang: lang,
        barcode: barcodeText || '20260808', // 👈 引入条形码变量（若为空则使用默认值）
        // 特殊标签使用的字段映射
        specs: model === 'GN20F' ? '14.8V-20Ah(20000mAh)' : displayCapacity,
        brand: isSpecial ? 'MAG CRUISR' : 'SEAFISHERMAN',
      });
    }
    return result;
  };

  // 核心修复：根据当前配置，正确注入 templates.json 中的 printElements
  const buildTemplate = () => {
    const currentTypeObj = defaultTemplates[activeType];
    const templateKey = getTemplateKey();

    // 从 JSON 树中提取对应模板
    const rawTemplate =
      currentTypeObj?.templates?.[templateKey] ||
      currentTypeObj?.templates?.['zh'];

    if (rawTemplate && rawTemplate.panels) {
      return {
        panels: rawTemplate.panels.map((panel) => ({
          ...panel,
          width: paperWidth,
          height: paperHeight,
        })),
      };
    }

    // 默认空面板兜底
    return {
      panels: [
        {
          width: paperWidth,
          height: paperHeight,
          printElements: [],
        },
      ],
    };
  };

  const isProduct = activeType === 'product';
  const modelList = getModelList();

  // 核心修复：将原来的 useMemo 调整为规范的 useEffect，防止组件加载时 set 状态报警
  useEffect(() => {
    const firstModel = modelList[0] || 'DL3500';
    if (firstModel !== model) {
      setModel(firstModel);
      const product = productData[firstModel];
      if (product?.isMultiCapacity) {
        const firstCap = product.capacities?.[0]?.label || '';
        setSelectedCapacity(firstCap);
        const colors = product.capacities?.find((c) => c.label === firstCap)?.colors || [];
        setColor(colors[0] || '');
      } else {
        const colors = product?.colors || [];
        setColor(colors[0] || '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="p-8 max-w-4xl mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-6 text-center">
        🏷️ 蓝铭电子标签打印控制台
      </h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {LABEL_TYPES.map((type) => (
          <button
            key={type.key}
            onClick={() => handleTypeChange(type.key)}
            className={`px-4 py-2 rounded-lg border transition-all ${
              activeType === type.key
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <div className="border border-gray-200 p-6 rounded-xl bg-gray-50 shadow-sm space-y-5">
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
                  容量 {isMultiCapacity && <span className="text-xs text-gray-400">（请选择）</span>}
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
                    {currentProduct?.capacity || '—'}
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

            {/* 在你的表单组件中添加 */}
              <div className="my-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  条形码内容 (Code128):
                </label>
                <input
                  type="text"
                  value={barcodeText}
                  onChange={(e) => setBarcodeText(e.target.value)}
                  placeholder="请输入条形码数字/字符（如：20251018）"
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

            <div className="mt-3 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSpecial}
                  onChange={(e) => setIsSpecial(e.target.checked)}
                />
                特殊标签（MAG CRUISR 款）
              </label>
              {isSpecial && (
                <span className="text-xs text-orange-500">
                  ⚠️ 将使用特殊布局（第一排英文 + 底部中文）
                </span>
              )}
            </div>

            {/* 当前选择摘要 */}
            <div className="mt-3 text-xs text-gray-400 bg-white p-2 rounded border border-gray-200">
              当前: {model} ｜ {lang} ｜ {getDisplayCapacity()} ｜ {color}
            </div>
          </div>
        )}

        {/* 纸张设定 */}
        <div>
          <h3 className="font-semibold text-gray-700 border-b pb-2 mb-3">📐 纸张设定</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600">宽度 (mm)</label>
              <input
                type="number"
                value={paperWidth}
                onChange={(e) => setPaperWidth(Number(e.target.value))}
                className="mt-1 w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">高度 (mm)</label>
              <input
                type="number"
                value={paperHeight}
                onChange={(e) => setPaperHeight(Number(e.target.value))}
                className="mt-1 w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* 打印设置 */}
        <div className="border-t pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600">打印份数</label>
              <input
                type="number"
                min="1"
                value={copies}
                onChange={(e) => setCopies(Number(e.target.value))}
                className="mt-1 w-20 p-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* 打印按钮 */}
        <div className="border-t pt-4">
          <HiprintButton
            templateData={buildTemplate()}
            printData={getPrintData()}
            label={`🔊 静默打印 (${getPrintData().length} 张)`}
          />
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-400 border-t pt-3">
        当前标签: <strong>{defaultTemplates[activeType]?.name || '未知'}</strong> ｜
        {isProduct && (
          <>
            型号: <strong>{model}</strong> ｜
            容量: <strong>{getDisplayCapacity()}</strong> ｜
            颜色: <strong>{color}</strong> ｜
            语言: <strong>{lang}</strong> ｜
          </>
        )}
        打印张数: <strong>{getPrintData().length}</strong>
      </div>
    </main>
  );
}