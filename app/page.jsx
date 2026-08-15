'use client';

import { useState, useRef } from 'react';
import HiprintButton from '@/components/HiprintButton';
import { ProductPanel, ChargerPanel, CustomerPanel } from '@/components/labels';

const LABEL_TYPES = [
  { key: 'product', label: '📦 产品标签' },
  { key: 'charger', label: '🔌 充电器标签' },
  { key: 'customer', label: '🧾 客户标签' },
  { key: 'company', label: '🏢 公司标签' },
];

export default function HomePage() {
  const [activeType, setActiveType] = useState('product');
  const productPanelRef = useRef(null);
  const customerPanelRef = useRef(null);

  // 当前面板的数据
  const [currentPrintData, setCurrentPrintData] = useState([]);
  const [currentTemplate, setCurrentTemplate] = useState({ panels: [] });
  const [paperInfo, setPaperInfo] = useState({ width: 100, height: 60, name: '标准' });

  const isProduct = activeType === 'product';
  const isCharger = activeType === 'charger';
  const isCustomer = activeType === 'customer';
  const isCompany = activeType === 'company';

  // 处理子组件数据变化
  const handleDataChange = (data) => {
    setCurrentPrintData(data.printData || []);
    setCurrentTemplate(data.template || { panels: [] });
    setPaperInfo({
      width: data.paperSize?.width || 100,
      height: data.paperSize?.height || 60,
      name: data.templateName || '标准',
    });
  };

  // 打印前分配序号（由子面板生成新的数据）
  // isRealPrint：true=直接打印时分配序号；false=预览时不消耗序号
  const handleBeforePrint = (isRealPrint = false) => {
    if (activeType === 'product' && productPanelRef.current?.allocateBarcodes) {
      const bundle = productPanelRef.current.allocateBarcodes();
      if (bundle?.printData) {
        setCurrentPrintData(bundle.printData);
        setCurrentTemplate(bundle.template || { panels: [] });
        return bundle;
      }
    }
    if (
      isRealPrint &&
      activeType === 'customer' &&
      customerPanelRef.current?.allocateSequences
    ) {
      const bundle = customerPanelRef.current.allocateSequences();
      if (bundle?.printData) {
        setCurrentPrintData(bundle.printData);
        setCurrentTemplate(bundle.template || { panels: [] });
        return bundle;
      }
    }
    return null;
  };

  return (
    <main
      className="p-8 max-w-6xl mx-auto font-sans"
      style={{
        width: '100%',
        maxWidth: '850px',
        minWidth: '300px'
      }}
    >
      <h1 className="text-2xl font-bold mb-6 text-center">
        🏷️ 蓝铭电子标签打印控制台
      </h1>

      {/* 标签类型选择 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {LABEL_TYPES.map((type) => (
          <button
            key={type.key}
            onClick={() => setActiveType(type.key)}
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

      {/* 核心内容区 */}
      <div className="border border-gray-200 p-6 rounded-xl bg-gray-50 shadow-sm space-y-5">

        {/* 产品面板 */}
        {isProduct && <ProductPanel ref={productPanelRef} onDataChange={handleDataChange} />}

        {/* 充电器面板 */}
        {isCharger && <ChargerPanel onDataChange={handleDataChange} />}

        {/* 客户标签 */}
        {isCustomer && (
          <CustomerPanel ref={customerPanelRef} onDataChange={handleDataChange} />
        )}

        {/* 公司标签 */}
        {isCompany && (
          <div className="text-center py-8 text-gray-500">
            🏢 公司标签开发中...
          </div>
        )}

        {/* 打印控制 */}
        <div className="flex items-center gap-4 text-sm border-t pt-4 flex-wrap">
          <span className="font-semibold text-gray-700">🖨️ 打印</span>
          <span className="text-gray-400 text-xs">
            生成 {currentPrintData.length} 个标签
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">
            📐 {paperInfo.width}×{paperInfo.height}mm
          </span>
          <span className="text-xs text-gray-400">
            ({paperInfo.name})
          </span>
        </div>

        {/* 打印按钮 */}
        <div className="flex items-center gap-3 border-t pt-4">
          <span className="font-semibold text-gray-700 text-sm">🖨️</span>
          <HiprintButton
            templateData={currentTemplate}
            printData={currentPrintData}
            buttonText="🔊 预览打印"
            onBeforePrint={handleBeforePrint}
          />
          <HiprintButton
            templateData={currentTemplate}
            printData={currentPrintData}
            buttonText="🖨️ 直接打印"
            silent={true}
            onBeforePrint={handleBeforePrint}
          />
        </div>
      </div>

      {/* 底部信息 */}
      <div className="mt-4 text-xs text-gray-400 border-t pt-3">
        当前标签类型: <strong>{activeType}</strong> ｜
        模板: <strong>{paperInfo.name}</strong> ｜
        纸张: <strong>{paperInfo.width}×{paperInfo.height}mm</strong> ｜
        打印张数: <strong>{currentPrintData.length}</strong>
      </div>
    </main>
  );
}
