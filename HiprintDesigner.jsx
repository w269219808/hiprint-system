'use client';

import React, { useState, useEffect, useRef } from 'react';

// 常量配置
const CONTAINER_ID = 'hiprint-printTemplate';
const SETTING_CONTAINER_ID = 'PrintElementOptionSetting';
const PROVIDER_CONTAINER_ID = 'left-provider-container';

export default function HiprintDesigner({ templateData, onSave }) {
  const [isReady, setIsReady] = useState(false);
  const hiprintTemplateRef = useRef(null);

  // 纸张尺寸状态 (单位: mm)
  const [paperWidth, setPaperWidth] = useState(60);
  const [paperHeight, setPaperHeight] = useState(40);

  // 导入导出 JSON 文本框内容
  const [jsonText, setJsonText] = useState('');

  // 1. 切换纸张尺寸 (宽, 高)
  const handleSetPaper = (w, h) => {
    setPaperWidth(w);
    setPaperHeight(h);
    if (hiprintTemplateRef.current) {
      hiprintTemplateRef.current.setPaper(w, h);
    }
  };

  // 2. 导出 JSON 并自动回显到输入框
  const handleExportJson = () => {
    if (hiprintTemplateRef.current) {
      const json = hiprintTemplateRef.current.getJson();
      const formattedJson = JSON.stringify(json, null, 2);
      setJsonText(formattedJson); // 回显到文本框

      if (onSave) onSave(json);
    }
  };

  // 3. 解析文本框里的 JSON 并更新到画布
  const handleUpdateJson = () => {
    if (!jsonText.trim()) {
      alert('请先粘贴 JSON 模板数据！');
      return;
    }

    try {
      const parsedJson = JSON.parse(jsonText);

      // 清空画布与右侧属性面板
      const container = document.getElementById(CONTAINER_ID);
      if (container) container.innerHTML = '';
      const settingContainer = document.getElementById(SETTING_CONTAINER_ID);
      if (settingContainer) settingContainer.innerHTML = '';

      // 重新实例化并渲染设计器
      if (typeof window !== 'undefined' && window.hiprint) {
        const template = new window.hiprint.PrintTemplate({
          template: parsedJson,
          settingContainer: `#${SETTING_CONTAINER_ID}`,
          history: true,
        });

        template.design(`#${CONTAINER_ID}`);
        hiprintTemplateRef.current = template;
        alert('✅ 模板更新成功！');
      }
    } catch (err) {
      console.error(err);
      alert('❌ JSON 格式有误，请检查粘贴的内容是否完整！');
    }
  };

  useEffect(() => {
    let isMounted = true;

    // 全局挂载 JQuery
    if (typeof window !== 'undefined') {
      try {
        const jquery = require('jquery');
        window.$ = jquery;
        window.jQuery = jquery;
      } catch (e) {
        console.warn('JQuery loading warning:', e);
      }
    }

    import('vue-plugin-hiprint')
      .then((module) => {
        if (!isMounted) return;

        const hiprint = module.hiprint || window.hiprint;
        const defaultElementTypeProvider = module.defaultElementTypeProvider;

        if (!hiprint) return;

        // 挂载 hiprint 到全局方便后续重新加载
        window.hiprint = hiprint;

        // 初始化 Provider
        try {
          if (defaultElementTypeProvider) {
            let provider;
            try {
              provider = new defaultElementTypeProvider();
            } catch (e) {
              provider = defaultElementTypeProvider();
            }
            hiprint.init({
              providers: [provider],
            });
          } else {
            hiprint.init();
          }
        } catch (e) {
          console.warn('hiprint init warning:', e);
        }

        // 构建左侧拖拽面板
        const providerContainer = document.getElementById(PROVIDER_CONTAINER_ID);
        if (providerContainer) {
          providerContainer.innerHTML = '';
          try {
            hiprint.PrintElementTypeManager.build(`#${PROVIDER_CONTAINER_ID}`, 'defaultModule');
          } catch (err) {
            console.error('Build left provider failed:', err);
          }
        }

        // 清空容器
        const container = document.getElementById(CONTAINER_ID);
        if (container) container.innerHTML = '';
        const settingContainer = document.getElementById(SETTING_CONTAINER_ID);
        if (settingContainer) settingContainer.innerHTML = '';

        // 解析初始模板数据
        const validTemplate =
          templateData && templateData.panels
            ? templateData
            : { panels: [{ width: 60, height: 40, printElements: [] }] };

        // 默认也同步一份到 textarea
        setJsonText(JSON.stringify(validTemplate, null, 2));

        // 实例化设计器
        const template = new hiprint.PrintTemplate({
          template: validTemplate,
          settingContainer: `#${SETTING_CONTAINER_ID}`,
          history: true,
        });

        template.design(`#${CONTAINER_ID}`);

        hiprintTemplateRef.current = template;
        setIsReady(true);
      })
      .catch((err) => {
        console.error('❌ 导入失败:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="w-full flex flex-col gap-4 p-4 border rounded-lg bg-gray-100 min-h-[700px]">
      {/* 1. 顶部工具栏：尺寸控制 + 导出 */}
      <div className="flex justify-between items-center bg-white p-3 rounded shadow-sm flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <h3 className="font-bold text-gray-800 text-lg">🏷️ 标签可视化设计器</h3>

          {/* 快捷纸张尺寸 */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 font-medium mr-1">纸张尺寸:</span>
            <button
              onClick={() => handleSetPaper(60, 30)}
              className="px-2.5 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 border rounded transition-colors"
            >
              60 × 30 mm
            </button>
            <button
              onClick={() => handleSetPaper(80, 40)}
              className="px-2.5 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 border rounded transition-colors"
            >
              80 × 40 mm
            </button>
            <button
              onClick={() => handleSetPaper(100, 150)}
              className="px-2.5 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 border rounded transition-colors"
            >
              100 × 150 mm
            </button>
          </div>

          {/* 自定义宽高 */}
          <div className="flex items-center gap-1.5 text-xs border-l pl-3">
            <span className="text-gray-500 font-medium">自定义(mm):</span>
            <input
              type="number"
              value={paperWidth}
              onChange={(e) => setPaperWidth(Number(e.target.value))}
              className="w-14 px-1.5 py-1 border rounded text-center"
              placeholder="宽"
            />
            <span className="text-gray-400">×</span>
            <input
              type="number"
              value={paperHeight}
              onChange={(e) => setPaperHeight(Number(e.target.value))}
              className="w-14 px-1.5 py-1 border rounded text-center"
              placeholder="高"
            />
            <button
              onClick={() => handleSetPaper(paperWidth, paperHeight)}
              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              应用
            </button>
          </div>
        </div>

        <button
          onClick={handleExportJson}
          disabled={!isReady}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
        >
          💾 导出 JSON
        </button>
      </div>

      {/* 2. 图片对应的【模板导入导出】条 */}
      <div className="flex items-center gap-3 bg-white p-3 rounded shadow-sm border border-gray-200">
        <span className="text-sm font-medium text-gray-700 shrink-0">模板导入导出:</span>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder="复制json模板到此后 点击右侧更新"
          className="flex-1 h-14 p-2 text-xs font-mono border border-gray-300 rounded resize-y focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all"
        />
        <button
          onClick={handleUpdateJson}
          className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors shrink-0 shadow-sm"
        >
          更新json模板
        </button>
      </div>

      {/* 3. 设计器主体 */}
      <div className="flex gap-4 border rounded bg-white p-4 flex-1 overflow-hidden">
        {/* 左侧：元素库 */}
        <div className="w-48 shrink-0 border-r pr-3 overflow-auto">
          <div className="text-xs font-bold text-gray-500 mb-2">📦 常用元素</div>
          <div id={PROVIDER_CONTAINER_ID} className="ep-draggable-item-container space-y-1" />
        </div>

        {/* 中间：画布 */}
        <div className="flex-1 overflow-auto flex flex-col items-center bg-gray-100 p-6 rounded min-h-[500px]">
          <div id={CONTAINER_ID} className="bg-white shadow-xl" />
        </div>

        {/* 右侧：属性编辑栏 */}
        <div className="w-72 shrink-0 overflow-auto pl-3 border-l">
          <div className="text-xs font-bold text-gray-500 mb-2 border-b pb-1">⚙️ 属性设置</div>
          <div id={SETTING_CONTAINER_ID} className="hiprint-option-setting" />
        </div>
      </div>

      <div className="text-xs text-gray-400 text-center">
        状态: {isReady ? '✅ 可视化拖拽设计器已就绪' : '⏳ 设计器初始化中...'}
      </div>
    </div>
  );
}