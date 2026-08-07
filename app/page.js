'use client';

import { useState } from 'react';
import defaultTemplates from '../data/templates.json';
import HiprintButton from '../HiprintButton';

// 标签类型选项
const LABEL_TYPES = [
  { key: 'product', label: '📦 产品标签' },
  { key: 'carton', label: '📋 外箱标签' },
  { key: 'customer', label: '👤 装箱号标签' },
  { key: 'company', label: '🏢 公司标签' },
];

export default function HomePage() {
  // 当前选中的标签类型
  const [activeType, setActiveType] = useState('product');

  // 纸张设置（根据类型切换时重置）
  const [paperSettings, setPaperSettings] = useState({
    width: defaultTemplates[activeType]?.defaultWidth || 60,
    height: defaultTemplates[activeType]?.defaultHeight || 40,
  });

  // 数据列表（支持追加多组）
  const [dataList, setDataList] = useState([{}]);

  // 打印份数
  const [printCopies, setPrintCopies] = useState(1);

  // 当前模板配置
  const template = defaultTemplates[activeType];
  const fields = template?.fields || [];

  // 切换标签类型时重置纸张和数据
  const handleTypeChange = (typeKey) => {
    setActiveType(typeKey);
    const t = defaultTemplates[typeKey];
    setPaperSettings({
      width: t?.defaultWidth || 60,
      height: t?.defaultHeight || 40,
    });
    setDataList([{}]);
  };

  // 更新单条数据
  const updateDataItem = (index, key, value) => {
    const newList = [...dataList];
    newList[index] = { ...newList[index], [key]: value };
    setDataList(newList);
  };

  // 追加数据组
  const addDataItem = () => {
    setDataList([...dataList, {}]);
  };

  // 删除数据组
  const removeDataItem = (index) => {
    if (dataList.length <= 1) return;
    setDataList(dataList.filter((_, i) => i !== index));
  };

  // 生成打印数据（展开所有数据 × 打印份数）
  const getPrintData = () => {
    const result = [];
    dataList.forEach(item => {
      for (let i = 0; i < printCopies; i++) {
        result.push({ ...item });
      }
    });
    return result;
  };

  // 构建hiprint模板
  const buildTemplate = () => {
    const fieldsConfig = fields.map(f => ({
      field: f.key,
      label: f.label,
      width: 100 / fields.length,
    }));

    return {
      panels: [
        {
          width: Number(paperSettings.width),
          height: Number(paperSettings.height),
          elements: fieldsConfig.map((f, idx) => ({
            type: 'text',
            field: f.field,
            label: f.label,
            options: {
              left: 5 + idx * 20,
              top: 10 + (idx % 2) * 20,
              width: 50,
              height: 18,
              fontSize: 10,
            },
          })),
        },
      ],
    };
  };

  return (
    <main className="p-8 max-w-2xl mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-6 text-center">🏷️ 蓝铭电子标签打印控制台</h1>

      {/* 标签类型切换 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {LABEL_TYPES.map((type) => (
          <button
            key={type.key}
            onClick={() => handleTypeChange(type.key)}
            className={`px-4 py-2 rounded-lg border transition-all ${
              activeType === type.key
                ? 'bg-[#2563eb] text-white border-blue-600 shadow-md'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <div className="border border-gray-200 p-6 rounded-xl bg-gray-50 shadow-sm space-y-5">
        {/* 纸张设定 */}
        <div>
          <h3 className="font-semibold text-gray-700 border-b pb-2 mb-3">
            📐 纸张设定
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600">宽度 (mm)</label>
              <input
                type="number"
                value={paperSettings.width}
                onChange={(e) => setPaperSettings({ ...paperSettings, width: Number(e.target.value) })}
                className="mt-1 w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">高度 (mm)</label>
              <input
                type="number"
                value={paperSettings.height}
                onChange={(e) => setPaperSettings({ ...paperSettings, height: Number(e.target.value) })}
                className="mt-1 w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* 内容编辑 - 支持追加 */}
        <div>
          <div className="flex items-center justify-between border-b pb-2 mb-3">
            <h3 className="font-semibold text-gray-700">✏️ 内容编辑</h3>
            <button
              onClick={addDataItem}
              className="text-sm bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition"
            >
              ＋ 追加一组
            </button>
          </div>

          {dataList.map((item, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-4 mb-3 bg-white relative"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-medium text-gray-500">
                  第 {index + 1} 组
                </span>
                <button
                  onClick={() => removeDataItem(index)}
                  className="text-red-500 hover:text-red-700 text-sm"
                  disabled={dataList.length <= 1}
                >
                  ✕ 删除
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-600">
                      {field.label}
                    </label>
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={item[field.key] || ''}
                      onChange={(e) => updateDataItem(index, field.key, e.target.value)}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 打印设置 */}
        <div className="border-t pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600">打印份数</label>
              <input
                type="number"
                min="1"
                value={printCopies}
                onChange={(e) => setPrintCopies(Number(e.target.value))}
                className="mt-1 w-20 p-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">选择打印机</label>
              <select className="mt-1 p-2 border border-gray-300 rounded-md bg-white">
                <option>默认打印机</option>
                <option>打印机 1</option>
                <option>打印机 2</option>
              </select>
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

      {/* 数据预览 */}
      <div className="mt-4 text-xs text-gray-400 border-t pt-3">
        当前标签类型: <strong>{template?.name}</strong> ｜
        数据组数: {dataList.length} ｜
        总打印张数: {getPrintData().length}
      </div>
    </main>
  );
}