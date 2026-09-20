'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';


  // ===== 获取模板纸张尺寸 =====
  const getPaperSize = (template) => {
    const panel = template?.panels?.[0] || {};
    if (!panel.width || !panel.height) {
      console.warn('⚠️ 模板缺少纸张尺寸，使用默认 60x30mm');
    }
    return {
      width: panel.width || 60,
      height: panel.height || 30,
    };
  };


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

          socket.on('clients', (data) => {
            const allPrinters = [];
            // 兼容 map（{clientId: {...}}）和数组（[{...}, {...}]）两种格式
            const entries = Array.isArray(data)
              ? data.map(c => [c.clientId, c])
              : Object.entries(data || {});

            for (const [id, client] of entries) {
              if (client?.printerList) {
                client.printerList.forEach(p => {
                  allPrinters.push({ ...p, clientId: p.clientId || id });
                });
              }
            }

            if (allPrinters.length > 0) {
              setPrinterList(allPrinters);
              setSelectedPrinter(prev => {
                if (prev) return prev;          // 已有选择，别覆盖
                const def = allPrinters.find(p => p.isDefault) || allPrinters[0];
                return def.name;
              });
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
    <div className="p-4 max-w-6xl md:mx-auto">

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
                    // const printDataList = Array(copies).fill({});
                    const { width: paperWidth, height: paperHeight } = getPaperSize(printingTemplate.data);

                    const paperName    = `laber_${paperWidth}x${paperHeight}`;
                    const widthMicron = Math.round(paperWidth * 1000);
                    const heightMicron = Math.round(paperHeight * 1000);

                    // 3) clientId —— 从选中的打印机对象里取，跟 HiprintButton 一致
                    const printerObj = printerList.find(p => p.name === selectedPrinter);
                    const clientId = printerObj?.clientId || printerObj?.server?.clientId || printerList[0]?.clientId;

                    if (!clientId) {
                      alert('⚠️ 未获取到客户端 clientId，请点刷新重试');
                      return;
                    }

                    // 4) 数据：只放 1 个 {}，份数交给 copies（或者数组长度=份数且 copies=数组长度，二选一）
                    const printDataList = [{}];

                    template.print2(printDataList, {
                      client: clientId, 
                      printer: selectedPrinter,
                      silent: true,
                      copies: copies,
                      type: 'pdf',    
                      paperName: paperName,
                      // PDF 页面尺寸必须等于标签纸尺寸（单位：微米，客户端会换算成 printToPDF 需要的英寸）；
                      // 不传时 Electron 会按默认 Letter 出 PDF，再以自定义纸张打印就会被驱动整体缩小。
                      pageSize: {
                        width: widthMicron,
                        height: heightMicron,
                      },
                      topOffset: 1.5,                 // 👈 单位 mm，偏多少填多少
                      ...(paperWidth > paperHeight && { orientation: 'landscape' }),// 👈 判断要不要旋转内容
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
      <div className="flex justify-between items-center mb-6 px-6">
        <h1 className="text-2xl font-bold">📋 模板列表</h1>
        <Link
          href="/desgin"
          className="hidden lg:block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
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
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                className="group bg-white border border-gray-100 rounded-xl p-4 hover:shadow-xl transition-all duration-200 cursor-default"
              >
                {/* 顶部：左侧是【名称 + ID】，右侧是悬停显示的图标 */}
                <div className="flex justify-between items-start">
                  <div>
                    {/* ✅ 补回名称，放大字体 */}
                    <h3 className="font-bold text-xl text-gray-800 mb-1">{template.name}</h3>
                    {/* ID 作为小字辅助展示 */}
                    <span className="text-xs text-gray-400 font-mono">ID: {template.id}</span>
                  </div>
                  
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => deleteTemplate(template.id, template.name)}
                      className="hidden lg:block p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="删除模板"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                    <Link 
                      href={`/desgin?id=${template.id}`}
                      className="hidden lg:block p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      title="编辑模板"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                    </Link>
                  </div>
                </div>

                {/* 中间行：尺寸标签 与 打印按钮 */}
                <div className="flex justify-between items-center mt-5">
                  {/* 尺寸标签 */}
                  {(() => {
                    const panel = template.data?.panels?.[0];
                    if (panel?.width && panel?.height) {
                      return (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-gray-600 text-sm font-medium rounded-lg">
                          📐 {panel.width}×{panel.height}mm
                        </span>
                      );
                    }
                    return null;
                  })()}

                  {/* 打印按钮 */}
                  <button
                    onClick={() => {
                      setPrintingTemplate(template);
                      setCopies(1);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                    </svg>
                    打印
                  </button>
                </div>
                
                {/* 底部：创建时间 */}
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-400 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    {new Date(template.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
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
