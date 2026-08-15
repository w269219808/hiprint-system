'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import customersData from '@/data/customers.json';
import customerTemplate from '@/data/templates/customer-standard.json';
import {
  getNextSequence,
  allocateSequences as allocateCustomerSequences,
} from '@/lib/customerSequence';

// 客户标签模板配置（目前只有一个 60×30mm 模板）
const CUSTOMER_TEMPLATE_CONFIG = {
  id: 'customer-standard-60x30',
  name: '客户标签 60×30mm',
  width: 60,
  height: 30,
};

const CustomerPanel = forwardRef(function CustomerPanel({ onDataChange }, ref) {
  // ===== 状态 =====
  // 初始值与 localStorage 无关，避免服务端渲染不一致；
  // 真实的下一条序号在挂载后通过 useEffect 读取
  const [customerCode, setCustomerCode] = useState(customersData[0]?.code || 'TYY');
  const [productCode, setProductCode] = useState('LM26004018');
  const [copies, setCopies] = useState(1);
  const [nextSequence, setNextSequence] = useState('01');

  // 基于状态的下一条序号生成预览序列（不访问 localStorage，避免水合不一致）
  const getPreviewSequencesFromState = () => {
    const start = parseInt(nextSequence, 10) || 1;
    return Array.from({ length: Math.max(0, copies) }, (_, i) =>
      String(start + i).padStart(2, '0')
    );
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

    if (el.printElementType?.type === 'text' && el.options?.title) {
      // 去掉字段绑定：本项目用 {{占位符}} 提供数据，
      // 避免 hiprint 按“标题：字段值”渲染导致多出冒号
      delete el.options.field;
      el.options.title = replacePlaceholders(el.options.title, data, index);
    }

    return el;
  };

  // ===== 构建打印数据 =====
  // sequenceList 传值时使用指定序号（打印时分配），否则生成不消耗序号的预览序号
  const getPrintData = (sequenceList) => {
    const result = [];
    const sequences = sequenceList || getPreviewSequencesFromState();

    for (let i = 0; i < copies; i++) {
      const sequence = sequences[i] || '01';
      result.push({
        customerCode: customerCode,
        sequence: sequence,
        productCode: productCode,
        labelText: `${customerCode}-${sequence}`,
      });
    }
    return result;
  };

  // ===== 构建模板 =====
  const buildTemplate = (printDataListOverride) => {
    if (!customerTemplate || !customerTemplate.panels) {
      return { panels: [{ width: 60, height: 30, printElements: [] }] };
    }

    const printDataList = printDataListOverride || getPrintData();

    if (printDataList.length === 0) {
      return { panels: [{ width: 60, height: 30, printElements: [] }] };
    }

    const panels = printDataList.map((dataItem, index) => {
      const panelCopy = JSON.parse(JSON.stringify(customerTemplate.panels[0]));
      panelCopy.width = CUSTOMER_TEMPLATE_CONFIG.width;
      panelCopy.height = CUSTOMER_TEMPLATE_CONFIG.height;
      panelCopy.printElements = panelCopy.printElements.map((element) => {
        return renderElement(element, dataItem, index);
      });
      panelCopy.index = index;
      panelCopy.name = `${dataItem.customerCode}-${dataItem.sequence}`;
      return panelCopy;
    });

    return { panels };
  };

  // ===== 打印时分配序号 =====
  useImperativeHandle(ref, () => ({
    allocateSequences: (count) => {
      // 未传数量时以面板当前“打印份数”为准
      const n = Math.max(
        1,
        Number.isFinite(Number(count)) ? Math.floor(Number(count)) : Math.max(1, copies)
      );
      const { codes, next } = allocateCustomerSequences(customerCode, n);
      setNextSequence(next);
      const printDataList = getPrintData(codes);
      const template = buildTemplate(printDataList);
      return { printData: printDataList, template };
    },
  }));

  // ===== 切换客户时刷新下一条序号 =====
  useEffect(() => {
    setNextSequence(getNextSequence(customerCode));
  }, [customerCode]);

  // ===== 数据变化时通知父组件 =====
  useEffect(() => {
    onDataChange?.({
      printData: getPrintData(),
      template: buildTemplate(),
      copies: copies,
      paperSize: {
        width: CUSTOMER_TEMPLATE_CONFIG.width,
        height: CUSTOMER_TEMPLATE_CONFIG.height
      },
      templateName: CUSTOMER_TEMPLATE_CONFIG.name,
    });
  }, [customerCode, productCode, copies, nextSequence]);

  // ===== 渲染 =====
  return (
    <div>
      {/* 客户选择（平铺） */}
      <div className="mb-4">
        <h3 className="font-semibold text-gray-700 border-b pb-2 mb-2">
          🏷️ 客户选择
        </h3>
        <p className="text-xs text-gray-400 mb-2">
          平铺选择：点击客户代号即可切换
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {customersData.map((customer) => (
            <button
              key={customer.code}
              onClick={() => setCustomerCode(customer.code)}
              className={`px-3 py-2.5 rounded-lg border transition-all text-center ${
                customerCode === customer.code
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="block font-bold">{customer.code}</span>
              {customer.name && (
                <span className={`block text-[10px] ${customerCode === customer.code ? 'text-blue-100' : 'text-gray-400'}`}>
                  {customer.name}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* 产品代码 */}
        <div>
          <label className="block text-sm font-medium text-gray-600">产品代码</label>
          <input
            type="text"
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            placeholder="如：LM26004018"
            className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white"
          />
        </div>

        {/* 打印序号 */}
        <div>
          <label className="block text-sm font-medium text-gray-600">打印序号</label>
          <div className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 text-center font-bold">
            {nextSequence}
          </div>
          <span className="text-xs text-gray-400 block mt-1">
            每打印一次自动 +1
          </span>
        </div>

        {/* 份数 */}
        <div>
          <label className="block text-sm font-medium text-gray-600">打印份数</label>
          <input
            type="number"
            min="1"
            value={copies}
            onChange={(e) => setCopies(Number(e.target.value))}
            className="mt-1 w-full p-2 border border-gray-300 rounded-md text-center"
          />
        </div>
      </div>

      {/* 摘要 */}
      <div className="mt-3 text-xs text-gray-500 bg-white p-2 rounded border border-gray-200">
        预览数据: 客户: {customerCode} ｜ 序号: {getPreviewSequencesFromState().join('、')} ｜
        产品代码: {productCode} ｜ 生成 {getPrintData().length} 个标签
      </div>
    </div>
  );
});

export default CustomerPanel;
