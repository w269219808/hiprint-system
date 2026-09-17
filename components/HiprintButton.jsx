'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PrinterConfigModal from './PrinterConfigModal';

// ===== 中转服务地址 =====
const TRANSIT_HOST = process.env.NEXT_PUBLIC_TRANSIT_HOST || 'http://192.168.110.107:17521';


export default function HiprintButton({
  templateData,
  printData,
  buttonText = '预览/导出标签',
  silent = false,
  printerName = '',
  onBeforePrint,
  labelType = '标签',
}) {
  const [hiprintObj, setHiprintObj] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [printerList, setPrinterList] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [isClientReady, setIsClientReady] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // 默认不开启 PDF打印 模式
  const [usePDF, setUsePDF] = useState(false);  

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [printerConfigs, setPrinterConfigs] = useState({});
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // ✅ 用户是否手动选择过打印机（避免自动匹配覆盖用户选择）
  const userSelectedRef = useRef(false);
  // ✅ 刷新按钮的兜底定时器
  const refreshTimerRef = useRef(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // ===== 3. 加载配置 =====
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const res = await fetch('/api/printer-configs');
        const data = await res.json();
        const configMap = {};
        data.forEach(item => {
          const key = item.paperSize || item.paper_size;
          const value = item.printerName || item.printer_name;
          if (key && value) {
            configMap[key] = value;
          }
        });
        setPrinterConfigs(configMap);
        setIsConfigLoaded(true);
        console.log('📋 加载打印机配置:', configMap);
      } catch (error) {
        console.warn('加载打印机配置失败:', error);
        setIsConfigLoaded(true);
      }
    };

    loadConfigs();
  }, []);


  // ✅ 自动匹配：仅当用户未手动选择时执行，避免覆盖用户选择
  useEffect(() => {
    if (!isConfigLoaded) return;
    if (!templateData) return;
    if (printerList.length === 0) return;
    if (userSelectedRef.current) return;   // 🛡️ 用户已手动选择 → 不再覆盖

    const panel = templateData?.panels?.[0] || {};
    const sizeKey = `${panel.width}x${panel.height}`;
    const matchedPrinter = printerConfigs[sizeKey];

    console.log('🔍 自动匹配检查:', { sizeKey, matchedPrinter });

    if (matchedPrinter) {
      const exists = printerList.some(p => p.name === matchedPrinter);
      if (exists && selectedPrinter !== matchedPrinter) {
        setSelectedPrinter(matchedPrinter);
        console.log(`✅ 自动匹配: ${sizeKey} → ${matchedPrinter}`);
      }
    }
  }, [isConfigLoaded, templateData, printerList, printerConfigs, selectedPrinter]);


  // ===== 4. 保存配置 =====
  const handleSaveConfigs = async (configs) => {
    try {
      const payload = Object.entries(configs).map(([paperSize, printerName]) => ({
        paperSize,
        printerName,
      }));

      await fetch('/api/printer-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setPrinterConfigs(configs);
      alert('✅ 配置保存成功！');
    } catch (error) {
      alert('❌ 保存失败：' + error.message);
    }
  };

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

  // ===== 构建日志摘要 =====
  const buildLogSummary = (dataList) => {
    const list = Array.isArray(dataList) ? dataList : dataList ? [dataList] : [];
    const first = list[0] || {};
    const barcodes = [
      ...new Set(
        list
          .map((d) => d.barcode || d.labelText || d.sequence)
          .filter(Boolean)
      ),
    ];
    return {
      copies: list.length,
      model: first.model,
      color: first.color,
      capacity: first.capacity,
      lang: first.lang,
      customerCode: first.customerCode,
      productCode: first.productCode,
      barcodes: barcodes.length > 6 ? [barcodes[0], barcodes[barcodes.length - 1]] : barcodes,
    };
  };

  // ===== 上报打印日志 =====
  const sendPrintLog = async ({ dataList, status = 'SUCCESS', mode = '打印', errorMessage }) => {
    try {
      const summary = buildLogSummary(dataList);
      if (errorMessage) summary.error = errorMessage;
      await fetch('/api/print-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printType: `${labelType} ${mode}`,
          contentSummary: summary,
          printerName: selectedPrinter || printerName || '',
          copies: summary.copies,
          status,
        }),
      });
    } catch (error) {
      console.error('写入打印日志失败:', error);
    }
  };

  // ===== 1. 初始化 Hiprint =====
  useEffect(() => {
    let isMounted = true;
    let socketRef = null;
    const handlers = {};

    import('vue-plugin-hiprint').then((module) => {
      if (!isMounted) return;

      const targetHiprint = module.hiprint || module.default?.hiprint || window.hiprint;
      if (!targetHiprint) return;

      try {
        const defaultProvider = function () {
          this.addElementTypes = function (context) {
            context.addPrintElementTypes('default', []);
          };
        };

        targetHiprint.init({
          host: TRANSIT_HOST,
          token: 'hiprint',
          providers: [new defaultProvider()],
        });
        console.log('✅ Hiprint 已连接到中转服务:', TRANSIT_HOST);

        const socket = targetHiprint.hiwebSocket?.socket;
        if (socket) {
          socketRef = socket;

          if (!socket.connected) {
            console.log('🔄 WebSocket 未连接，手动连接...');
            socket.connect();
          }

          handlers.connect = () => {
            if (!isMounted) return;
            console.log('✅ WebSocket 已连接');
            setIsLoading(true);
            socket.emit('getClients');
          };

          handlers.printerList = (list) => {
            if (!isMounted) return;
            if (list && list.length > 0) {
              setPrinterList(list);
              setIsClientReady(true);
              setIsLoading(false);
              clearRefreshTimer();   // ✅ 收到列表立即清除刷新兜底定时器

              // ✅ 只在用户未手动选择时才应用默认项
              if (!userSelectedRef.current) {
                const defaultPrinter = list.find((p) => p.isDefault);
                if (defaultPrinter) setSelectedPrinter(defaultPrinter.name);
                else setSelectedPrinter(list[0].name);
              }
            }
          };

          handlers.clients = (data) => {
            if (!isMounted) return;
            const allPrinters = [];
            for (const id in data) {
              if (data[id].printerList) {
                allPrinters.push(
                  ...data[id].printerList.map((printer) => ({
                    ...printer,
                    clientId: printer.clientId || id,
                  }))
                );
              }
            }
            if (allPrinters.length > 0) {
              setPrinterList(allPrinters);
              setIsClientReady(true);
              setIsLoading(false);
              clearRefreshTimer();   // ✅ 同上

              if (!userSelectedRef.current) {
                const defaultPrinter = allPrinters.find((p) => p.isDefault);
                if (defaultPrinter) setSelectedPrinter(defaultPrinter.name);
                else setSelectedPrinter(allPrinters[0].name);
              }
            }
          };

          handlers.disconnect = () => {
            if (!isMounted) return;
            console.warn('⚠️ WebSocket 断开连接');
            setIsClientReady(false);
            setIsLoading(false);
          };

          handlers.connect_error = (err) => {
            if (!isMounted) return;
            console.error('❌ WebSocket 连接错误:', err);
            setIsLoading(false);
          };

          socket.on('connect', handlers.connect);
          socket.on('printerList', handlers.printerList);
          socket.on('clients', handlers.clients);
          socket.on('disconnect', handlers.disconnect);
          socket.on('connect_error', handlers.connect_error);

          if (socket.connected) {
            console.log('✅ Socket 已连接，直接请求');
            socket.emit('getClients');
          }
        } else {
          console.warn('⚠️ 未找到 WebSocket 实例，使用轮询方式');
          let retryCount = 0;
          const maxRetries = 10;
          const pollInterval = setInterval(() => {
            if (!isMounted) { clearInterval(pollInterval); return; }
            try {
              const template = new targetHiprint.PrintTemplate({ template: { panels: [] } });
              const list = template.getPrinterList();
              if (list && list.length > 0) {
                setPrinterList(list);
                setIsClientReady(true);
                setIsLoading(false);
                const defaultPrinter = list.find((p) => p.isDefault);
                if (!userSelectedRef.current) {
                  if (defaultPrinter) setSelectedPrinter(defaultPrinter.name);
                  else setSelectedPrinter(list[0].name);
                }
                clearInterval(pollInterval);
              } else {
                retryCount++;
                if (retryCount >= maxRetries) {
                  clearInterval(pollInterval);
                  setIsLoading(false);
                  console.warn('⚠️ 轮询获取打印机列表超时');
                }
              }
            } catch (e) {
              retryCount++;
              if (retryCount >= maxRetries) {
                clearInterval(pollInterval);
                setIsLoading(false);
              }
            }
          }, 1000);
        }
      } catch (e) {
        console.warn('hiprint init bypassed:', e);
      }

      if (isMounted) {
        setHiprintObj(targetHiprint);
        setIsReady(true);
      }
    });

    return () => {
      isMounted = false;
      clearRefreshTimer();
      // ✅ 彻底清理 socket 监听，防止重复绑定与内存泄漏
      if (socketRef) {
        try {
          socketRef.off('connect', handlers.connect);
          socketRef.off('printerList', handlers.printerList);
          socketRef.off('clients', handlers.clients);
          socketRef.off('disconnect', handlers.disconnect);
          socketRef.off('connect_error', handlers.connect_error);
        } catch (e) {
          // ignore
        }
      }
    };
  }, [clearRefreshTimer]);

  // ===== 2. 刷新打印机列表 =====
  const refreshPrinterList = () => {
    if (!hiprintObj) {
      alert('⚠️ Hiprint 未初始化');
      return;
    }
    const socket = hiprintObj.hiwebSocket?.socket;
    if (socket && socket.connected) {
      setIsLoading(true);
      socket.emit('getClients');
      // ✅ 收到列表时会 clear；超时 5s 兜底
      clearRefreshTimer();
      refreshTimerRef.current = setTimeout(() => {
        setIsLoading(false);
        refreshTimerRef.current = null;
      }, 5000);
    } else {
      alert('⚠️ WebSocket 未连接，请检查中转服务');
    }
  };

  // ===== 3. 获取预览 HTML =====
  const getPreviewHtml = (dataList, template) => {
    if (!hiprintObj || !template) return null;
    const holder = document.getElementById('hiprint-hidden-holder');
    if (!holder) return null;
    holder.innerHTML = '';

    const customTemplate = new hiprintObj.PrintTemplate({ template });
    customTemplate.design('#hiprint-hidden-holder');

    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const hasMultiplePanels = template?.panels && template.panels.length > 1;
          const finalDataList = hasMultiplePanels ? [{}] : dataList;
          const $htmlElements = customTemplate.getHtml(finalDataList);
          let htmlContent = '';
          $htmlElements.each((index, element) => {
            htmlContent += element.outerHTML;
          });
          // console.log('🔍 自动生成的HTML:', htmlContent); 
          resolve(htmlContent);
        }, 50);
      });
    });
  };

  // ===== 抽取公共：调用 onBeforePrint（带异常保护） =====
  const prepareDataAndTemplate = async (isSilentFlag) => {
    let dataList = Array.isArray(printData) ? printData : [printData];
    let template = templateData;

    if (onBeforePrint) {
      try {
        const bundle = await onBeforePrint(isSilentFlag);
        if (bundle) {
          dataList = Array.isArray(bundle.printData) ? bundle.printData : [bundle.printData];
          template = bundle.template || templateData;
        }
      } catch (e) {
        console.error('❌ onBeforePrint 执行失败:', e);
        throw new Error('打印前数据处理失败：' + e.message);
      }
    }
    return { dataList, template };
  };

  // ===== 4. 普通预览 =====
  const handlePreview = async () => {
    if (!hiprintObj || !templateData || !printData) {
      return alert('打印组件未就绪或缺失模板/数据！');
    }

    let dataList, template;
    try {
      ({ dataList, template } = await prepareDataAndTemplate(false));
    } catch (e) {
      return alert(e.message);
    }

    try {
      const htmlContent = await getPreviewHtml(dataList, template);
      if (!htmlContent) return alert('生成预览失败！');

      const win = window.open('', '_blank');
      if (!win) return alert('打开预览失败，请允许浏览器弹出窗口！');

      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>标签打印预览</title>
            <link rel="stylesheet" type="text/css" href="/print-lock.css" />
            <style>
              body {
                background-color: #525659;
                margin: 0;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
              }
              .hiprint-printPaper {
                background: #ffffff !important;
                margin-bottom: 20px !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              }
              @media print {
                body {
                  background: none !important;
                  padding: 0 !important;
                  display: block !important;
                }
                .hiprint-printPaper {
                  box-shadow: none !important;
                  margin: 0 !important;
                }
              }
            </style>
          </head>
          <body>
            ${htmlContent}
            <script>
              window.onload = function() {
                setTimeout(() => {
                  window.print();
                }, 300);
              };
            <\/script>
          </body>
        </html>
      `);

      win.document.close();
      sendPrintLog({ dataList, mode: '预览' });
    } catch (error) {
      console.error('❌ 生成预览失败:', error);
      sendPrintLog({ dataList, status: 'FAILED', mode: '预览', errorMessage: error.message });
      alert('生成打印预览失败，请查看浏览器开发者工具控制台。');
    }
  };



  // ===== 5. 静默打印 =====
  const handleSilentPrint = async () => {
    if (!hiprintObj || !templateData || !printData) {
      return alert('打印组件未就绪或缺失模板/数据！');
    }

    if (!isClientReady || printerList.length === 0) {
      return alert(
        '⚠️ 未检测到打印机！\n\n请确保：\n' +
        '1. Windows 系统已安装打印机\n' +
        '2. electron-hiprint 客户端已启动并连接中转服务\n' +
        '3. 点击"刷新"按钮获取打印机列表'
      );
    }

    const printer = selectedPrinter || printerName;
    if (!printer) {
      return alert('⚠️ 请选择一台打印机！');
    }

    let dataList, template;
    try {
      ({ dataList, template } = await prepareDataAndTemplate(true));
    } catch (e) {
      return alert(e.message);
    }
    // 🔀 根据用户开关判断使用哪种模式
    if (!usePDF) {
      try {
        console.log('🖨️ 尝试 print2 打印...');

        const customTemplate = new hiprintObj.PrintTemplate({ template });
        const hasMultiplePanels = template?.panels && template.panels.length > 1;
        const finalDataList = hasMultiplePanels ? [{}] : dataList;
        const selectedPrinterObj = printerList.find(p => p.name === (selectedPrinter || printerName));
        const clientId = selectedPrinterObj?.clientId || selectedPrinterObj?.server?.clientId || printerList[0]?.clientId;

        console.log('clientId:', clientId);

        customTemplate.print2(finalDataList, {
          ...(clientId && { client: clientId }),
          printer: printer,
          silent: true,
          copies: finalDataList.length,
        });
        setTimeout(() => {
          sendPrintLog({ dataList, mode: '打印(已下发)' });
        }, 800);

      } catch (error) {
        alert('print2 打印失败：' + error.message);
        sendPrintLog({
          dataList,
          status: 'FAILED',
          mode: 'print2 模式',
          errorMessage: error.message,
        });
      }
    } else {
      // ===== PDF 打印 =====
      try {
        console.log('🖨️ 尝试 PDF 打印...');

        const { width: paperWidth, height: paperHeight } = getPaperSize(template);
        const paperName = 'laber_' + paperWidth + 'x' + paperHeight;
        console.log('📦 paperName:', paperName);
        const customTemplate = new hiprintObj.PrintTemplate({ template });

        const hasMultiplePanels = template?.panels && template.panels.length > 1;
        const finalDataList = hasMultiplePanels ? [{}] : dataList;
        const selectedPrinterObj = printerList.find(p => p.name === (selectedPrinter || printerName));
        const clientId = selectedPrinterObj?.clientId || selectedPrinterObj?.server?.clientId || printerList[0]?.clientId;

        customTemplate.print2(finalDataList, {
          ...(clientId && { client: clientId }),
          printer: printer,
          silent: true,
          copies: finalDataList.length,
          type: 'pdf',                      // 👈 加上这一行，客户端才会走 PDF 打印路径
          paperName:paperName,
          ...(paperWidth > paperHeight && { orientation: 'landscape' }),// 👈 判断要不要旋转内容
        });
        setTimeout(() => {
          sendPrintLog({ dataList, mode: '打印(已下发)' });
        }, 800);
      }catch (error) {
        alert('print2 打印失败：' + error.message);
        sendPrintLog({
          dataList,
          status: 'FAILED',
          mode: 'print2 模式',
          errorMessage: error.message,
        });
      }
    }
  };

  // ===== 8. 主入口 =====
  const handlePrint = () => {
    if (silent) {
      setShowConfirm(true);
    } else {
      handlePreview();
    }
  };

  return (
    <>
      <div
        id="hiprint-hidden-holder"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          visibility: 'hidden',
        }}
      />

      {silent ? (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs text-gray-600 font-medium whitespace-nowrap">
            打印机:
          </label>
          <select
            value={selectedPrinter}
            onChange={(e) => {
              userSelectedRef.current = true;   // ✅ 标记为用户手动选择
              setSelectedPrinter(e.target.value);
            }}
            className="text-xs p-1.5 border border-gray-300 rounded-md bg-white min-w-[150px]"
            disabled={!isClientReady}
          >
            <option value="">请选择打印机</option>
            {printerList.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} {p.isDefault ? '⭐' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={refreshPrinterList}
            className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
            disabled={!isReady || isLoading}
          >
            {isLoading ? '⏳ 获取中...' : '🔄 刷新'}
          </button>
          <span
            className={`text-xs ${isClientReady ? 'text-green-600' : 'text-red-500'} whitespace-nowrap`}
          >
            {isLoading ? '⏳ 获取中...' : isClientReady ? '✅ 已连接' : '❌ 未连接'}
          </span>
          <button
            onClick={handlePrint}
            disabled={!isReady || !isClientReady}
            className={`px-4 py-2 rounded text-white text-sm font-medium transition-colors ${
              isReady && isClientReady
                ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {!isReady ? '⏳ 加载中...' : isLoading ? '⏳ 获取中...' : !isClientReady ? '⚠️ 未连接' : buttonText}
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="打印机配置"
          >
            ⚙️
          </button>
            <div className="flex items-center gap-3 flex-wrap">
            <label
              className="flex items-center gap-1.5 text-xs cursor-pointer select-none text-gray-700 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-md border border-gray-300 transition-colors"
              title="打勾使用PDF（精准走纸），不打勾使用默认HTML渲染"
            >
              <input
                type="checkbox"
                checked={usePDF}
                onChange={(e) => setUsePDF(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span className="font-medium">PDF 模式</span>
            </label>
          </div>
        </div>
      ) : (
        <button
          onClick={handlePrint}
          disabled={!isReady}
          className={`px-4 py-2 rounded text-white text-sm font-medium transition-colors ${
            isReady
              ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {!isReady ? '⏳ 加载中...' : buttonText}
        </button>
      )}
      <PrinterConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        printerList={printerList}
        existingConfigs={printerConfigs}
        onSave={handleSaveConfigs}
      />

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">🖨️ 确认打印</h3>
            <p className="text-sm text-gray-600 mb-4">
              即将打印{' '}
              <strong>{Array.isArray(printData) ? printData.length : 1}</strong> 张标签
              <br />
              打印机: <strong>{selectedPrinter || printerName || '未选择'}</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  handleSilentPrint();
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                ✅ 确认打印
              </button>
            </div>
            <button
              onClick={() => {
                setShowConfirm(false);
                handlePreview();
              }}
              className="mt-2 w-full text-xs text-blue-500 hover:text-blue-700 underline text-center"
            >
              👁️ 先预览再打印
            </button>
          </div>
        </div>
      )}
    </>
  );
}