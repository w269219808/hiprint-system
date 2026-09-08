'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';





export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // 在已有的 useState 后面加
const [printingTemplate, setPrintingTemplate] = useState(null); // 当前要打印的模板
const [printerList, setPrinterList] = useState([]);
const [selectedPrinter, setSelectedPrinter] = useState('');
const [copies, setCopies] = useState(1);
const [hiprintObj, setHiprintObj] = useState(null);

  // 加载模板列表
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates');
      const result = await res.json();
      if (result.success) {
        setTemplates(result.data);
      }
    } catch (error) {
      alert('加载失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

useEffect(() => {
  let isMounted = true;
  
  import('vue-plugin-hiprint').then((module) => {
    if (!isMounted) return;
    
    const targetHiprint = module.hiprint || module.default?.hiprint || window.hiprint;
    
    if (targetHiprint) {
      try {
        const defaultProvider = function () {
          this.addElementTypes = function (context) {
            context.addPrintElementTypes('default', []);
          };
        };
        
        targetHiprint.init({
          host: 'http://192.168.110.107:17521',
          token: 'hiprint',
          providers: [new defaultProvider()],
        });
        
        setHiprintObj(targetHiprint);
        
        // WebSocket 连接和事件监听
        const socket = targetHiprint.hiwebSocket?.socket;
        if (socket) {
          if (!socket.connected) {
            socket.connect();
          }
          
          socket.on('connect', () => {
            socket.emit('getClients');
          });
          
          // 监听打印机列表
          socket.on('printerList', (list) => {
            if (list && list.length > 0) {
              setPrinterList(list);
              if (!selectedPrinter) {
                const defaultPrinter = list.find(p => p.isDefault);
                setSelectedPrinter(defaultPrinter?.name || list[0].name);
              }
            }
          });
          
          // 备选：监听 clients
          socket.on('clients', (data) => {
            const allPrinters = [];
            const clientList = Array.isArray(data) ? data : Object.values(data || {});
            clientList.forEach(client => {
              if (client.printerList) {
                client.printerList.forEach(p => {
                  allPrinters.push({ ...p, clientId: client.clientId });
                });
              }
            });
            if (allPrinters.length > 0) {
              setPrinterList(allPrinters);
              if (!selectedPrinter) {
                const defaultPrinter = allPrinters.find(p => p.isDefault);
                setSelectedPrinter(defaultPrinter?.name || allPrinters[0].name);
              }
            }
          });
          
          if (socket.connected) {
            socket.emit('getClients');
          }
        }
      } catch (error) {
        console.error('hiprint 初始化失败:', error);
      }
    }
  }).catch(err => console.error('hiprint 加载失败:', err));
  
  return () => {
    isMounted = false;
  };
}, []);

  // 删除模板
  const deleteTemplate = async (id, name) => {
    if (!confirm(`删除 "${name}" ？`)) return;
    
    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        alert('删除成功！');
        loadTemplates();
      }
    } catch (error) {
      alert('删除失败：' + error.message);
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">

      {printingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">🖨️ 打印「{printingTemplate.name}」</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">打印机</label>
                <select
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  {printerList.map(p => (
                    <option key={p.name} value={p.name}>
                      {p.name} {p.isDefault ? '⭐' : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">份数</label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  if (!hiprintObj || !selectedPrinter) {
                    alert('打印组件或打印机未就绪');
                    return;
                  }
                  
                  try {
                    const template = new hiprintObj.PrintTemplate({ template: printingTemplate.data });
                    const printDataList = Array(copies).fill({});
                    
                    template.print2(printDataList, {
                      printer: selectedPrinter,
                      silent: true,
                      copies: copies,
                    });
                    
                    // 记录日志
                    await fetch('/api/print-log', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        printType: '自定义模板',
                        contentSummary: printingTemplate.name,
                        printerName: selectedPrinter,
                        copies: copies,
                        status: 'SUCCESS',
                      }),
                    });
                    
                    setPrintingTemplate(null);
                  } catch (error) {
                    alert('打印失败：' + error.message);
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                ✅ 确认打印
              </button>
              <button
                onClick={() => setPrintingTemplate(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 标题 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📋 模板列表</h1>
        <Link
          href="/desgin"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          ✨ 新建模板
        </Link>
      </div>

      {/* 加载中 */}
      {loading && (
        <div className="text-center py-8">加载中...</div>
      )}

      {/* 没有模板 */}
      {!loading && templates.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded">
          <p className="text-gray-500">还没有模板，去创建一个吧！</p>
          <Link
            href="/desgin"
            className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            创建模板 →
          </Link>
        </div>
      )}

      {/* 模板列表 */}
      {!loading && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div key={template.id} className="border rounded p-4 hover:shadow">
              <h3 className="font-semibold text-lg">{template.name}</h3>
              {/* ✅ 新增：显示纸张尺寸 */}
              {(() => {
                const panel = template.data?.panels?.[0];
                if (panel?.width && panel?.height) {
                  return (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                      📐 {panel.width}×{panel.height}mm
                    </span>
                  );
                }
                return null;
              })()}
              <p className="text-xs text-gray-400 mt-1">
                {new Date(template.createdAt).toLocaleString()}
              </p>
              
              <div className="flex gap-2 mt-3">
                {/* 打印当前自定义模板：空数据 [{}] 适合纯静态模板 */}
                <button
                  onClick={() => {
                    setPrintingTemplate(template);
                    setCopies(1);
                  }}
                  className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                >
                  🖨️ 打印
                </button>
                
                <Link
                  href={`/desgin?id=${template.id}`}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  ✏️ 编辑
                </Link>
                
                <button
                  onClick={() => deleteTemplate(template.id, template.name)}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  🗑️ 删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部 */}
      <div className="text-center mt-6">
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
          🏠 首页
        </Link>
      </div>
    </div>
  );
}
