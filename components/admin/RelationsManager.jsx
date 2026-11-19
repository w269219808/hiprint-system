'use client';

import { useState, useEffect } from 'react';

export default function RelationsManager() {
  const [models, setModels] = useState([]);
  const [capacities, setCapacities] = useState([]);
  const [colors, setColors] = useState([]);

  // 当前后台正在配置的型号
  const [selectedModelCode, setSelectedModelCode] = useState('');

  // 选中的容量编码数组与颜色编码数组
  const [checkedCapacities, setCheckedCapacities] = useState([]);
  const [checkedColors, setCheckedColors] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 1. 加载所有字典数据和当前的配置
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [mapRes, relRes] = await Promise.all([
        fetch('/api/admin/code-mappings').then((r) => r.json()),
        fetch('/api/admin/product-relations').then((r) => r.json()),
      ]);

      if (mapRes.success && Array.isArray(mapRes.data)) {
        const m = mapRes.data.filter((i) => i.category === 'model');
        const cap = mapRes.data.filter((i) => i.category === 'capacity');
        const col = mapRes.data.filter((i) => i.category === 'color');

        setModels(m);
        setCapacities(cap);
        setColors(col);

        // 默认选中第一个型号
        const firstModelCode = m[0]?.code || '';
        if (firstModelCode && !selectedModelCode) {
          setSelectedModelCode(firstModelCode);
          applyModelRelation(firstModelCode, relRes.data || []);
        } else if (selectedModelCode) {
          applyModelRelation(selectedModelCode, relRes.data || []);
        }
      }
    } catch (err) {
      alert('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // 根据选中的型号加载其绑定的勾选项
  const applyModelRelation = (mCode, relList) => {
    const rel = relList.find((r) => r.modelCode === mCode);
    if (rel) {
      setCheckedCapacities(rel.capacityCodes ? rel.capacityCodes.split(',').map((c) => c.trim()) : []);
      setCheckedColors(rel.colorCodes ? rel.colorCodes.split(',').map((c) => c.trim()) : []);
    } else {
      // 未配置过时默认清空（或全选）
      setCheckedCapacities([]);
      setCheckedColors([]);
    }
  };

  // 切换切换配置的型号
  const handleModelChange = async (e) => {
    const newModelCode = e.target.value;
    setSelectedModelCode(newModelCode);
    const relRes = await fetch('/api/admin/product-relations').then((r) => r.json());
    applyModelRelation(newModelCode, relRes.data || []);
  };

  // 切换容量复选框
  const toggleCapacity = (code) => {
    setCheckedCapacities((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  // 切换颜色复选框
  const toggleColor = (code) => {
    setCheckedColors((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  // 保存规则到后端
  const handleSave = async () => {
    if (!selectedModelCode) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/product-relations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelCode: selectedModelCode,
          capacityCodes: checkedCapacities,
          colorCodes: checkedColors,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('🎉 绑定关系保存成功！打印页面将自动更新选择列表。');
      } else {
        alert(`保存失败: ${data.message}`);
      }
    } catch (err) {
      alert('保存发生错误');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 text-center text-gray-500">正在加载映射规则...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
        🔗 型号与容量/颜色绑定配置
      </h2>

      {/* 1. 选择型号 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          请选择要设置绑定关系的型号：
        </label>
        <select
          value={selectedModelCode}
          onChange={handleModelChange}
          className="w-full md:w-80 p-2.5 border border-gray-300 rounded-md bg-white font-medium text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {models.map((m) => (
            <option key={m.id} value={m.code}>
              {m.name} (编码: {m.code})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 2. 勾选可用容量 */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold text-gray-700 mb-3 flex justify-between items-center">
            <span>🔋 该型号允许的容量</span>
            <span className="text-xs text-gray-400">已选 {checkedCapacities.length} 个</span>
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {capacities.map((cap) => (
              <label
                key={cap.id}
                className="flex items-center gap-3 p-2 rounded bg-white border border-gray-200 hover:bg-blue-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checkedCapacities.includes(cap.code)}
                  onChange={() => toggleCapacity(cap.code)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700 font-medium">
                  {cap.name} <span className="text-gray-400 text-xs">({cap.code})</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 3. 勾选可用颜色 */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold text-gray-700 mb-3 flex justify-between items-center">
            <span>🎨 该型号允许的颜色</span>
            <span className="text-xs text-gray-400">已选 {checkedColors.length} 个</span>
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {colors.map((col) => (
              <label
                key={col.id}
                className="flex items-center gap-3 p-2 rounded bg-white border border-gray-200 hover:bg-blue-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checkedColors.includes(col.code)}
                  onChange={() => toggleColor(col.code)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700 font-medium">
                  {col.name} <span className="text-gray-400 text-xs">({col.code})</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 4. 保存按钮 */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shadow-md transition-all"
        >
          {saving ? '保存中...' : '💾 保存绑定关系'}
        </button>
      </div>
    </div>
  );
}