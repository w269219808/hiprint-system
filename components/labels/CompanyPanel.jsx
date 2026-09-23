'use client';

import { useState, useEffect } from 'react';
import companyLmStandard from '@/data/templates/company-lm-standard.json';
import companyLmLarge from '@/data/templates/company-lm-large.json';
import companyDyStandard from '@/data/templates/company-dy-standard.json';
import companyDyLarge from '@/data/templates/company-dy-large.json';

// 模板映射：公司 + 纸张尺寸 -> 模板 JSON
const TEMPLATE_MAP = {
  lm: {
    standard: companyLmStandard,
    large: companyLmLarge,
  },
  dy: {
    standard: companyDyStandard,
    large: companyDyLarge,
  },
};

// 公司配置
const COMPANIES = [
  { id: 'lm', name: 'LM 公司' },
  { id: 'dy', name: 'DY 公司' },
];

// 纸张配置
const PAPER_SIZES = [
  { id: 'standard', name: '60 × 30', width: 60, height: 30 },
  { id: 'large', name: '80 × 40', width: 80, height: 40 },
];


export default function CompanyPanel({ onDataChange }) {

  // ===== 状态 =====
  const [companyId, setCompanyId] = useState(COMPANIES[0].id);
  const [paperId, setPaperId] = useState(PAPER_SIZES[0].id);

  const [copies, setCopies] = useState(1);

  // ===== 计算属性 =====
  const currentCompany = COMPANIES.find(c => c.id === companyId) || COMPANIES[0];
  const currentPaper = PAPER_SIZES.find(p => p.id === paperId) || PAPER_SIZES[0];
  const currentTemplate = TEMPLATE_MAP[companyId]?.[paperId] || companyLmStandard;

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
        index: i + 1,
        company: currentCompany.name,
        paper: currentPaper.name,
      });
    }
    return result;
  };

  // ===== 构建模板 =====
  const buildTemplate = () => {

    const templatePanels = currentTemplate?.panels;

    if (!templatePanels || templatePanels.length === 0) {
      return { panels: [{ width: currentPaper.width, height: currentPaper.height, printElements: [] }] };
    }

    const printDataList = getPrintData();

    if (printDataList.length === 0) {
      return { panels: [{ width: currentPaper.width, height: currentPaper.height, printElements: [] }] };
    }

    const panels = printDataList.map((dataItem, index) => {
      const panelCopy = JSON.parse(JSON.stringify(templatePanels[0]));
      panelCopy.width = currentPaper.width;
      panelCopy.height = currentPaper.height;
      panelCopy.printElements = panelCopy.printElements.map((element) => {
        return renderElement(element, dataItem, index);
      });
      panelCopy.index = index;
      panelCopy.name = `${currentCompany.name}-${index + 1}`;
      return panelCopy;
    });

    return { panels };
  };

  // ===== 数据变化时通知父组件 =====
  useEffect(() => {
    onDataChange?.({
      printData: getPrintData(),   // ← 加这行
      template: buildTemplate(),
      copies: copies,
      paperSize: {
        width: currentPaper.width,
        height: currentPaper.height,
      },
      templateName: `${currentCompany.name} / ${currentPaper.name}`,
    });
  }, [companyId, paperId, copies]);

  // ===== 渲染 =====
  return (
    <div className="w-full min-w-0">
      {/* 公司和纸张：PC 一行两列，移动端上下两排 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* 公司选择 */}
        <div>
          <h3 className="font-semibold text-gray-700 mb-2">🏢 公司</h3>
          <div className="flex flex-wrap gap-2">
            {COMPANIES.map((company) => (
              <button
                key={company.id}
                onClick={() => setCompanyId(company.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  companyId === company.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {company.name}
              </button>
            ))}
          </div>
        </div>

        {/* 纸张选择 */}
        <div>
          <h3 className="font-semibold text-gray-700 mb-2">📐 纸张尺寸</h3>
          <div className="flex flex-wrap gap-2">
            {PAPER_SIZES.map((paper) => (
              <button
                key={paper.id}
                onClick={() => setPaperId(paper.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  paperId === paper.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {paper.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <h3 className="font-semibold text-gray-700 border-b pb-2 mb-3">
        🏷️ 标签内容
      </h3>

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
        <span className="text-xs text-gray-400">
          生成 {getPrintData().length} 个标签
        </span>
      </div>
    </div>
  );
}