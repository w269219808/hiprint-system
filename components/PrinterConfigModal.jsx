'use client';

import React, { useState, useEffect } from 'react';

const ALL_PAPER_SIZES = ['60x30', '80x40', '60x40', '100x80', '40x30', '30x60'];

export default function PrinterConfigModal({
  isOpen,
  onClose,
  printerList,
  onSave,
  existingConfigs = {},
  onRefresh,  // ← 新增
}) {
  const [configs, setConfigs] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // ✅ 弹窗打开时，从数据库实时加载
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      // 如果有 onRefresh，调用它加载最新数据
      if (onRefresh) {
        onRefresh().then(data => {
          setConfigs(data);
          setIsLoading(false);
        }).catch(() => setIsLoading(false));
      } else {
        // 降级：用 existingConfigs
        setConfigs(existingConfigs);
        setIsLoading(false);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">🖨️ 打印机配置</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          配置不同纸张尺寸对应的打印机，打印时系统将自动匹配
        </p>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-3">
              {ALL_PAPER_SIZES.map((sizeKey) => (
                <div key={sizeKey} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium">{sizeKey}</div>
                  <div className="flex-1">
                    <select
                      value={configs[sizeKey] || ''}
                      onChange={(e) => {
                        setConfigs({
                          ...configs,
                          [sizeKey]: e.target.value,
                        });
                      }}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">请选择打印机</option>
                      {printerList.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} {p.isDefault ? '⭐' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-4 pt-4 border-t">
          <button
            onClick={() => {
              onSave(configs);
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            💾 保存配置
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}