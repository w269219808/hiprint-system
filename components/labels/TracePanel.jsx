'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import traceTemplate from '@/data/templates/trace-standard.json';

const TracePanel = forwardRef(function TracePanel({ onDataChange }, ref) {
  // ===== 1. 字典与关系数据状态 =====
  const [mappings, setMappings] = useState({
    model: [],
    capacity: [],
    color: [],
    customer: [],
  });
  // 储存后台设置的型号绑定关系列表
  const [relations, setRelations] = useState([]);

  // ===== 2. 当前选中的表单状态 =====
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedCapacity, setSelectedCapacity] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // 数量控制
  const [uniqueCodeCount, setUniqueCodeCount] = useState(3);
  const [copiesPerCode, setCopiesPerCode] = useState(1);

  const [loading, setLoading] = useState(true);



  const [nextSeq, setNextSeq] = useState('001');
  // 🔍 实时获取今天该规则下的最新序号，用于预览显示“下一个将要生成的号”
  useEffect(() => {
    const fetchLatestCounter = async () => {
      try {
        const now = new Date();
        const yy = String(now.getFullYear());
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateStr = `${yy}${mm}${dd}`; // 对应后端的日期格式

        const res = await fetch(`/api/barcode-counter?date=${dateStr}`);
        const result = await res.json();
        
        // 假设后端返回当前的 count 是多少（比如已用到 9）
        // 那么下一个预览的号就是 count + 1（即 10 -> 010）
        const currentCount = result.count || result.data?.count || 0;
        const nextNumber = currentCount + 1;
        setNextSeq(String(nextNumber).padStart(3, '0'));
      } catch (e) {
        console.error('获取当前序号失败:', e);
      }
    };

    fetchLatestCounter();
  }, [selectedModel, selectedCapacity, selectedColor, selectedCustomer]);

  // 纸张配置
  const templateConfig = {
    name: '3列连排标准追溯码标签',
    preview: '3连排标签 (94x10mm)',
    width: 94,
    height: 10,
  };

  const currentTemplate = traceTemplate;

  // ===== 3. 初始化：同时加载“映射字典”与“后台绑定关系” =====
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [mapRes, relRes] = await Promise.all([
          fetch('/api/admin/code-mappings').then((r) => r.json()),
          fetch('/api/admin/product-relations').then((r) => r.json()),
        ]);

        // 1. 处理基础字典
        if (mapRes.success && Array.isArray(mapRes.data)) {
          const grouped = {
            model: mapRes.data.filter((item) => item.category === 'model'),
            capacity: mapRes.data.filter((item) => item.category === 'capacity'),
            color: mapRes.data.filter((item) => item.category === 'color'),
            customer: mapRes.data.filter((item) => item.category === 'customer'),
          };
          setMappings(grouped);

          if (grouped.model.length > 0) setSelectedModel(grouped.model[0]);
          if (grouped.customer.length > 0) setSelectedCustomer(grouped.customer[0]);
        }

        // 2. 处理后台型号绑定关系
        if (relRes.success && Array.isArray(relRes.data)) {
          setRelations(relRes.data);
        }
      } catch (err) {
        console.error('加载追溯码数据失败:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ===== 4. 核心：根据当前选中的型号，动态计算可用的容量与颜色 =====
  const currentRelation = relations.find((r) => r.modelCode === selectedModel?.code);

  // 动态过滤容量（终极安全版）
  const filteredCapacities = mappings.capacity.filter((item) => {
    // 1. 如果根本没有加载到任何后台绑定关系，或者当前型号没配关系，直接放行显示全量
    if (relations.length === 0 || !currentRelation || !currentRelation.capacityCodes) return true;
    const allowedCodes = currentRelation.capacityCodes.split(',').map((c) => c.trim());
    return allowedCodes.includes(item.code);
  });

  // 动态过滤颜色（终极安全版）
  const filteredColors = mappings.color.filter((item) => {
    if (relations.length === 0 || !currentRelation || !currentRelation.colorCodes) return true;
    const allowedCodes = currentRelation.colorCodes.split(',').map((c) => c.trim());
    return allowedCodes.includes(item.code);
  });

  // ===== 5. 级联重置：当型号切换时，如果原本选中的容量/颜色不在新列表中，重置为第一个 =====
  useEffect(() => {
    if (filteredCapacities.length > 0) {
      const exists = filteredCapacities.some((item) => item.id === selectedCapacity?.id);
      if (!exists) {
        setSelectedCapacity(filteredCapacities[0]);
      }
    } else {
      setSelectedCapacity(null);
    }

    if (filteredColors.length > 0) {
      const exists = filteredColors.some((item) => item.id === selectedColor?.id);
      if (!exists) {
        setSelectedColor(filteredColors[0]);
      }
    } else {
      setSelectedColor(null);
    }
  }, [selectedModel, relations]);

  // ===== 6. 辅助工具函数 =====
  const formatShowCode = (code) => {
    if (!code || typeof code !== 'string' || code.length < 14) return code;
    return `${code.slice(0, 4)} ${code.slice(4, 8)} ${code.slice(8, 14)} ${code.slice(14)}`;
  };

  // 生成追溯码预览
  const getPreviewTraceCode = () => {
    const mCode = selectedModel?.code || '00';
    const capCode = selectedCapacity?.code || '00';
    const colCode = selectedColor?.code || '00';
    const cusCode = selectedCustomer?.code || '00';

    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    // return `${mCode}${capCode}${colCode}${cusCode}${yy}${mm}${dd}${nextSeq}`;
    return `${mCode}${colCode}${capCode}${cusCode}${yy}${mm}${dd}${nextSeq}`;
  };

  const previewTraceCode = getPreviewTraceCode();

  // // ===== 7. 构建 3合1 打印数据（带模拟递增） =====
  // const getPrintData = (realCodesList = []) => {
  //   const expandedList = [];

  //   let baseCodes = realCodesList;
  //   if (!baseCodes || baseCodes.length === 0) {
  //     baseCodes = [];
  //     const mCode = selectedModel?.code || '00';
  //     const capCode = selectedCapacity?.code || '00';
  //     const colCode = selectedColor?.code || '00';
  //     const cusCode = selectedCustomer?.code || '00';

  //     const now = new Date();
  //     const yy = String(now.getFullYear()).slice(-2);
  //     const mm = String(now.getMonth() + 1).padStart(2, '0');
  //     const dd = String(now.getDate()).padStart(2, '0');
  //     const dateStr = `${yy}${mm}${dd}`;

  //     const countToGen = Number(uniqueCodeCount) || 1;
  //     for (let i = 0; i < countToGen; i++) {
  //       const seq = String(i + 1).padStart(3, '0');
  //       baseCodes.push(`${mCode}${capCode}${colCode}${cusCode}${dateStr}${seq}`);
  //     }
  //   }

  //   const repeatTimes = Number(copiesPerCode) || 1;
  //   baseCodes.forEach((code) => {
  //     const formattedShow = formatShowCode(code);
  //     for (let i = 0; i < repeatTimes; i++) {
  //       expandedList.push({ code, showCode: formattedShow });
  //     }
  //   });

  //   const result = [];
  //   for (let i = 0; i < expandedList.length; i += 3) {
  //     result.push({
  //       code1: expandedList[i]?.code || '',
  //       showCode1: expandedList[i]?.showCode || '',
  //       code2: expandedList[i + 1]?.code || '',
  //       showCode2: expandedList[i + 1]?.showCode || '',
  //       code3: expandedList[i + 2]?.code || '',
  //       showCode3: expandedList[i + 2]?.showCode || '',
  //     });
  //   }
  //   return result;
  // };
  // ===== 7. 构建 3合1 打印数据（带模拟递增） =====
  const getPrintData = (realCodesList = []) => {
    const expandedList = [];

    let baseCodes = realCodesList;
    if (!baseCodes || baseCodes.length === 0) {
      baseCodes = [];
      const mCode = selectedModel?.code || '00';
      const capCode = selectedCapacity?.code || '00';
      const colCode = selectedColor?.code || '00';
      const cusCode = selectedCustomer?.code || '00';

      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const dateStr = `${yy}${mm}${dd}`;

      const countToGen = Number(uniqueCodeCount) || 1;
      
      // 🔑 核心修改：预览时，以当前查出来的 nextSeq（转成数字）作为起始编号往后排！
      const startSeqNum = parseInt(nextSeq, 10) || 1;

      for (let i = 0; i < countToGen; i++) {
        const seqNum = startSeqNum + i;
        const seq = String(seqNum).padStart(3, '0');
        // baseCodes.push(`${mCode}${capCode}${colCode}${cusCode}${dateStr}${seq}`);
        baseCodes.push(`${mCode}${colCode}${capCode}${cusCode}${dateStr}${seq}`);
        
      }
    }

    const repeatTimes = Number(copiesPerCode) || 1;
    baseCodes.forEach((code) => {
      const formattedShow = formatShowCode(code);
      for (let i = 0; i < repeatTimes; i++) {
        expandedList.push({ code, showCode: formattedShow });
      }
    });

    const result = [];
    for (let i = 0; i < expandedList.length; i += 3) {
      result.push({
        code1: expandedList[i]?.code || '',
        showCode1: expandedList[i]?.showCode || '',
        code2: expandedList[i + 1]?.code || '',
        showCode2: expandedList[i + 1]?.showCode || '',
        code3: expandedList[i + 2]?.code || '',
        showCode3: expandedList[i + 2]?.showCode || '',
      });
    }
    return result;
  };

  const replacePlaceholders = (text, data) => {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (_, field) => (data[field] !== undefined ? String(data[field]) : ''));
  };

  const renderElement = (element, data) => {
    const el = JSON.parse(JSON.stringify(element));
    
    // 1. 文本组件：替换 {{showCode1}} 等
    if (el.printElementType?.type === 'text' && el.options?.title) {
      el.options.title = replacePlaceholders(el.options.title, data);
    }
    
    // 2. 条码组件：让 testData 中的 {{code1}} 能够正确被替换为真实追溯码
    if (el.printElementType?.type === 'barcode' && el.options?.testData) {
      el.options.testData = replacePlaceholders(el.options.testData, data);
    }
    
    return el;
  };

  const buildTemplate = (printDataListOverride) => {
    if (!currentTemplate || !currentTemplate.panels) {
      return { panels: [{ width: 94, height: 10, printElements: [] }] };
    }
    const printDataList = printDataListOverride || getPrintData();
    const panels = printDataList.map((dataItem, index) => {
      const panelCopy = JSON.parse(JSON.stringify(currentTemplate.panels[0]));
      panelCopy.width = templateConfig.width;
      panelCopy.height = templateConfig.height;
      panelCopy.printElements = panelCopy.printElements.map((el) => renderElement(el, dataItem));
      panelCopy.index = index;
      panelCopy.name = `Row-${index + 1}`;
      return panelCopy;
    });
    return { panels };
  };

// ===== 追溯码面板专属：批量申请与防重接口 =====
  useImperativeHandle(ref, () => ({
    allocateBarcodes: async (totalCount) => {
      const countToRequest = Math.max(1, Number(totalCount) || Number(uniqueCodeCount) || 1);

      try {
        const currentUsername = typeof window !== 'undefined' ? localStorage.getItem('username') || 'admin' : 'admin';
        
        // 🔑 追溯码必须请求这个后端接口（它会写入 trace_codes 明细表）
        const res = await fetch('/api/print/generate-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelCode: selectedModel?.code || '00',
            capacityCode: selectedCapacity?.code || '00',
            colorCode: selectedColor?.code || '00',
            customerCode: selectedCustomer?.code || '00',
            count: countToRequest,
            printedBy: currentUsername,
            labelType: 'trace' // 标识为追溯码
          }),
        });
        
        const result = await res.json();
        console.log('📦 追溯码接口返回结果:', result);

        if (result.success && result.data?.codes) {
          const generatedCodes = result.data.codes.map((item) => item.traceCode);
          const printDataList = getPrintData(generatedCodes);
          const template = buildTemplate(printDataList);
          
          // 正常返回给主面板打印
          return { printData: printDataList, template };
        } else {
          alert(`生成追溯码失败: ${result.message || '未知错误'}`);
          return null; // 返回 null 会触发子面板未返回有效打印数据
        }
      } catch (err) {
        console.error('❌ 请求批量申请追溯码接口异常:', err);
        alert('请求批量申请追溯码接口失败: ' + err.message);
        return null;
      }
    },
  }));

// ===== 9. 数据变动通知父组件（终极完善版） =====
  useEffect(() => {
    const totalCount = (Number(uniqueCodeCount) || 1) * (Number(copiesPerCode) || 1);
    
    // 获取当前登录用户名
    const currentUsername = typeof window !== 'undefined' ? localStorage.getItem('username') || 'admin' : 'admin';

    // 1. 先生成标准的排版数据数组
    const printList = getPrintData();

    // 2. 🔑 关键绝招：把统计参数直接挂载到数组对象本身上，防止在传递时丢失！
    printList.totalCount = Number(uniqueCodeCount) || 1;
    printList.copiesPerCode = Number(copiesPerCode) || 1;
    printList.username = currentUsername;
    printList.model = selectedModel?.name;
    printList.capacity = selectedCapacity?.name;
    printList.color = selectedColor?.name;
    printList.customer = selectedCustomer?.name;

    onDataChange?.({
      printData: printList, // 带着自定义属性的数组
      template: buildTemplate(printList),
      copies: totalCount,
      paperSize: { width: templateConfig.width, height: templateConfig.height },
      templateName: templateConfig.name,
    });
  }, [selectedModel, selectedCapacity, selectedColor, selectedCustomer, uniqueCodeCount, copiesPerCode, relations]);

  if (loading) {
    return <div className="p-4 text-center text-gray-500 text-sm">正在加载追溯码规则配置...</div>;
  }

  return (
    <div className="w-full">
      {/* 纸张卡片 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-700">📐 纸张尺寸 (3列连排)</h3>
          <span className="text-xs text-gray-400">当前: {templateConfig.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full text-sm bg-blue-600 text-white shadow-md font-medium">
            {templateConfig.preview} ⭐
          </div>
          <span className="text-xs text-gray-400">（单行 3 个小标签，总宽 94mm × 高 10mm）</span>
        </div>
      </div>

      {/* 四大要素下拉（已实现级联绑定过滤） */}
      <div>
        <h3 className="font-semibold text-gray-700 border-b border-gray-300 pb-2 mb-3">
          🎯 追溯码要素选择
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
          {/* 1. 型号 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">型号</label>
            <select
              value={selectedModel?.id || ''}
              onChange={(e) =>
                setSelectedModel(mappings.model.find((item) => String(item.id) === e.target.value))
              }
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              {mappings.model.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
          </div>

          {/* 2. 颜色（根据型号动态过滤） */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">颜色</label>
            <select
              value={selectedColor?.id || ''}
              onChange={(e) =>
                setSelectedColor(filteredColors.find((item) => String(item.id) === e.target.value))
              }
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              {filteredColors.length > 0 ? (
                filteredColors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code})
                  </option>
                ))
              ) : (
                <option value="">暂无匹配颜色</option>
              )}
            </select>
          </div>

          {/* 3. 容量（根据型号动态过滤） */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">容量</label>
            <select
              value={selectedCapacity?.id || ''}
              onChange={(e) =>
                setSelectedCapacity(filteredCapacities.find((item) => String(item.id) === e.target.value))
              }
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              {filteredCapacities.length > 0 ? (
                filteredCapacities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code})
                  </option>
                ))
              ) : (
                <option value="">暂无匹配容量</option>
              )}
            </select>
          </div>

          {/* 4. 客户 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">客户</label>
            <select
              value={selectedCustomer?.id || ''}
              onChange={(e) =>
                setSelectedCustomer(mappings.customer.find((item) => String(item.id) === e.target.value))
              }
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              {mappings.customer.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 17位码预览 */}
        <div className="my-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            17位追溯码预览 (Code128):
          </label>
          <input
            type="text"
            value={previewTraceCode}
            readOnly
            className="w-full px-2.5 py-1.5 border border-gray-300 bg-gray-50 rounded text-sm font-mono text-blue-600 font-bold focus:outline-none"
          />
        </div>

        {/* 移动端友好型数量加减器（带点击全选） */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200 relative z-10">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              🔢 不同追溯码数量 (个)
            </label>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setUniqueCodeCount((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                className="w-10 h-10 bg-white border border-gray-300 rounded-l-md font-bold text-gray-600 hover:bg-gray-100 text-lg flex items-center justify-center touch-manipulation"
              >
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={uniqueCodeCount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value;
                  setUniqueCodeCount(val === '' ? '' : Math.max(1, Number(val)));
                }}
                onBlur={() => {
                  if (uniqueCodeCount === '' || isNaN(uniqueCodeCount)) setUniqueCodeCount(1);
                }}
                className="w-full h-10 border-t border-b border-gray-300 bg-white text-center text-sm font-semibold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setUniqueCodeCount((prev) => (Number(prev) || 0) + 1)}
                className="w-10 h-10 bg-white border border-gray-300 rounded-r-md font-bold text-gray-600 hover:bg-gray-100 text-lg flex items-center justify-center touch-manipulation"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              🔁 每个码重复打印份数 (份)
            </label>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setCopiesPerCode((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                className="w-10 h-10 bg-white border border-gray-300 rounded-l-md font-bold text-gray-600 hover:bg-gray-100 text-lg flex items-center justify-center touch-manipulation"
              >
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={copiesPerCode}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value;
                  setCopiesPerCode(val === '' ? '' : Math.max(1, Number(val)));
                }}
                onBlur={() => {
                  if (copiesPerCode === '' || isNaN(copiesPerCode)) setCopiesPerCode(1);
                }}
                className="w-full h-10 border-t border-b border-gray-300 bg-white text-center text-sm font-semibold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCopiesPerCode((prev) => (Number(prev) || 0) + 1)}
                className="w-10 h-10 bg-white border border-gray-300 rounded-r-md font-bold text-gray-600 hover:bg-gray-100 text-lg flex items-center justify-center touch-manipulation"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2 text-xs text-blue-600 font-medium">
          💡 提示：申请 {uniqueCodeCount || 1} 个不同追溯码，每个打 {copiesPerCode || 1} 份，共计 {(Number(uniqueCodeCount) || 1) * (Number(copiesPerCode) || 1)} 枚标签（排版为 {Math.ceil(((Number(uniqueCodeCount) || 1) * (Number(copiesPerCode) || 1)) / 3)} 行 3 列连排）。
        </div>
      </div>
    </div>
  );
});

export default TracePanel;