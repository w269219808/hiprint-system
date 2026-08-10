'use client';

import React, { useState, useEffect, useRef } from 'react';

// 将容器 ID 常量定义在组件外部，彻底避免重复声明
const CONTAINER_ID = 'hiprint-printTemplate';
const SETTING_CONTAINER_ID = 'PrintElementOptionSetting';
const PROVIDER_CONTAINER_ID = 'left-provider-container';

export default function HiprintDesigner({ templateData, onSave }) {
  const [isReady, setIsReady] = useState(false);
  const hiprintTemplateRef = useRef(null);

  // 纸张尺寸状态 (单位: mm)
  const [paperWidth, setPaperWidth] = useState(60);
  const [paperHeight, setPaperHeight] = useState(40);

  // 切换纸张尺寸 (宽, 高)
  const handleSetPaper = (w, h) => {
    setPaperWidth(w);
    setPaperHeight(h);
    if (hiprintTemplateRef.current) {
      hiprintTemplateRef.current.setPaper(w, h);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // 1. 全局挂载 JQuery
    if (typeof window !== 'undefined') {
      try {
        const jquery = require('jquery');
        window.$ = jquery;
        window.jQuery = jquery;
      } catch (e) {
        console.warn('JQuery loading warning:', e);
      }
    }

    // 2. 动态导入 vue-plugin-hiprint
    import('vue-plugin-hiprint')
      .then((module) => {
        if (!isMounted) return;

        const hiprint = module.hiprint || window.hiprint;
        const defaultElementTypeProvider = module.defaultElementTypeProvider;

        if (!hiprint) return;

        // 3. 实例化 Provider 并初始化
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

        // 4. 构建左侧拖拽面板
        const providerContainer = document.getElementById(PROVIDER_CONTAINER_ID);
        if (providerContainer) {
          providerContainer.innerHTML = '';
          try {
            hiprint.PrintElementTypeManager.build(`#${PROVIDER_CONTAINER_ID}`, 'defaultModule');
          } catch (err) {
            console.error('Build left provider failed:', err);
          }
        }

        // 5. 清空画布与属性面板节点
        const container = document.getElementById(CONTAINER_ID);
        if (container) container.innerHTML = '';
        const settingContainer = document.getElementById(SETTING_CONTAINER_ID);
        if (settingContainer) settingContainer.innerHTML = '';

        // 6. 解析模板数据
        const validTemplate =
          templateData && templateData.panels
            ? templateData
            : { panels: [{ width: 60, height: 40, printElements: [] }] };

        // 7. 初始化 PrintTemplate
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

  const handleExportJson = () => {
    if (hiprintTemplateRef.current) {
      const json = hiprintTemplateRef.current.getJson();
      if (onSave) onSave(json);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 p-4 border rounded-lg bg-gray-100 min-h-[700px]">
      {/* 顶部工具栏：纸张设置 + 导出按钮 */}
      <div className="flex justify-between items-center bg-white p-3 rounded shadow-sm flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <h3 className="font-bold text-gray-800 text-lg">🏷️ 标签可视化设计器</h3>

          {/* 快捷纸张尺寸 */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 font-medium mr-1">纸张尺寸:</span>
            <button
              onClick={() => handleSetPaper(60, 40)}
              className="px-2.5 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 border rounded transition-colors"
            >
              60 × 40 mm
            </button>
            <button
              onClick={() => handleSetPaper(100, 100)}
              className="px-2.5 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 border rounded transition-colors"
            >
              100 × 100 mm
            </button>
            <button
              onClick={() => handleSetPaper(100, 150)}
              className="px-2.5 py-1 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 border rounded transition-colors"
            >
              100 × 150 mm
            </button>
          </div>

          {/* 自定义宽高输入 */}
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

      {/* 设计器主体区 */}
      <div className="flex gap-4 border rounded bg-white p-4 flex-1 overflow-hidden">
        {/* 左侧：常用拖拽元素 */}
        <div className="w-48 shrink-0 border-r pr-3 overflow-auto">
          <div className="text-xs font-bold text-gray-500 mb-2">📦 常用元素</div>
          <div id={PROVIDER_CONTAINER_ID} className="ep-draggable-item-container space-y-1" />
        </div>

        {/* 中间：画布区域 */}
        <div className="flex-1 overflow-auto flex flex-col items-center bg-gray-100 p-6 rounded min-h-[500px]">
          <div id={CONTAINER_ID} className="bg-white shadow-xl" />
        </div>

        {/* 右侧：属性设置 */}
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