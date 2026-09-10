'use client';

import React, { useState, useEffect } from 'react';
import PrinterConfigModal from './PrinterConfigModal';

// ===== 中转服务地址 =====
const TRANSIT_HOST = 'http://192.168.110.107:17521';


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

  // 2. 添加状态
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [printerConfigs, setPrinterConfigs] = useState({});

  // 在 useState 后面加上这个
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // 3. 加载配置 - 改成这样
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
        setIsConfigLoaded(true);  // ✅ 标记加载完成
        console.log('📋 加载打印机配置:', configMap);
      } catch (error) {
        console.warn('加载打印机配置失败:', error);
        setIsConfigLoaded(true);
      }
    };
    
    loadConfigs();
  }, []);


  // ✅ 自动匹配：配置加载完成后执行
  useEffect(() => {
    if (!isConfigLoaded) return;
    if (!templateData) return;
    if (printerList.length === 0) return;
    
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



  // 4. 保存配置
  const handleSaveConfigs = async (configs) => {
    try {
    const payload = Object.entries(configs).map(([paperSize, printerName]) => ({
      paperSize,    // ← 改成驼峰
      printerName,  // ← 改成驼峰
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
    return {
      width: panel.width || 60,
      height: panel.height || 30,
    };
  };

  // ===== 构建日志摘要（存 content_summary） =====
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

  // ===== 上报打印日志（失败不影响打印主流程） =====
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
            host: TRANSIT_HOST,
            token: 'hiprint',
            providers: [new defaultProvider()],
          });
          console.log('✅ Hiprint 已连接到中转服务:', TRANSIT_HOST);

          // ===== WebSocket 连接和事件监听（只绑定一次） =====
          const socket = targetHiprint.hiwebSocket?.socket;
          if (socket) {
            // 如果未连接，手动连接
            if (!socket.connected) {
              console.log('🔄 WebSocket 未连接，手动连接...');
              socket.connect();
            }

            // 监听连接成功
            socket.on('connect', () => {
              console.log('✅ WebSocket 已连接');
              setIsLoading(true);
              socket.emit('getClients');
            });

            // 监听打印机列表（主要）
            socket.on('printerList', (list) => {
              // console.log('🖨️ 收到 printerList:', list);
              if (list && list.length > 0) {
                setPrinterList(list);
                setIsClientReady(true);
                setIsLoading(false);
                const defaultPrinter = list.find((p) => p.isDefault);
                if (defaultPrinter) setSelectedPrinter(defaultPrinter.name);
                else if (list.length > 0) setSelectedPrinter(list[0].name);
              }
            });

            // 监听 clients（备选）
            socket.on('clients', (data) => {
              // console.log('📡 收到 clients:', data);
              const allPrinters = [];
              for (const id in data) {
                if (data[id].printerList) {
                  allPrinters.push(
                    ...data[id].printerList.map((printer) => ({
                      ...printer,
                      // clients 的外层 key 才是 clientId，展开时补到每台打印机上
                      clientId: printer.clientId || id,
                    }))
                  );
                }
              }
              if (allPrinters.length > 0) {
                setPrinterList(allPrinters);
                setIsClientReady(true);
                setIsLoading(false);
                const defaultPrinter = allPrinters.find((p) => p.isDefault);
                if (defaultPrinter) setSelectedPrinter(defaultPrinter.name);
                else if (allPrinters.length > 0) setSelectedPrinter(allPrinters[0].name);
              }
            });

            // 连接断开
            socket.on('disconnect', () => {
              console.warn('⚠️ WebSocket 断开连接');
              setIsClientReady(false);
              setIsLoading(false);
            });

            // 连接错误
            socket.on('connect_error', (err) => {
              console.error('❌ WebSocket 连接错误:', err);
              setIsLoading(false);
            });

            // 如果已经连接，直接请求
            if (socket.connected) {
              console.log('✅ Socket 已连接，直接请求');
              socket.emit('getClients');
            }
          } else {
            console.warn('⚠️ 未找到 WebSocket 实例，使用轮询方式');
            // 降级方案：轮询
            let retryCount = 0;
            const maxRetries = 10;
            const pollInterval = setInterval(() => {
              try {
                const template = new targetHiprint.PrintTemplate({ template: { panels: [] } });
                const list = template.getPrinterList();
                if (list && list.length > 0) {
                  setPrinterList(list);
                  setIsClientReady(true);
                  setIsLoading(false);
                  const defaultPrinter = list.find((p) => p.isDefault);
                  if (defaultPrinter) setSelectedPrinter(defaultPrinter.name);
                  else if (list.length > 0) setSelectedPrinter(list[0].name);
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

        setHiprintObj(targetHiprint);
        setIsReady(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []); // 移除 printerName 依赖，避免重复初始化

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
      setTimeout(() => setIsLoading(false), 5000);
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
      setTimeout(() => {
        const hasMultiplePanels = template?.panels && template.panels.length > 1;
        const finalDataList = hasMultiplePanels ? [{}] : dataList;
        const $htmlElements = customTemplate.getHtml(finalDataList);
        let htmlContent = '';
        $htmlElements.each((index, element) => {
          htmlContent += element.outerHTML;
        });
        resolve(htmlContent);
      }, 100);
    });
  };

  // ===== 4. 普通预览 =====
  const handlePreview = async () => {
    if (!hiprintObj || !templateData || !printData) {
      return alert('打印组件未就绪或缺失模板/数据！');
    }

    let dataList = Array.isArray(printData) ? printData : [printData];
    let template = templateData;

    if (onBeforePrint) {
      const bundle = await onBeforePrint(false);
      if (bundle) {
        dataList = Array.isArray(bundle.printData) ? bundle.printData : [bundle.printData];
        template = bundle.template || templateData;
      }
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
      // 记录预览操作（实际打印在浏览器打印窗口里完成）
      sendPrintLog({ dataList, mode: '预览' });
    } catch (error) {
      console.error('❌ 生成预览失败:', error);
      sendPrintLog({ dataList, status: 'FAILED', mode: '预览', errorMessage: error.message });
      alert('生成打印预览失败，请查看浏览器开发者工具控制台。');
    }
  };

  // ===== 5. 生成 TSPL 指令 =====
  const generateTSPL = (dataList, template) => {
    // 统一使用 getPaperSize
    const { width: paperWidth, height: paperHeight } = getPaperSize(template);
    const dotPerMm = 11.8;
    const labelWidth = Math.round(paperWidth * dotPerMm);
    const labelHeight = Math.round(paperHeight * dotPerMm);
    const hasMultiplePanels = template?.panels && template.panels.length > 1;

    let tspl = '';
    tspl += `SIZE ${labelWidth} ${labelHeight}\r\n`;
    tspl += 'GAP 2 0\r\n';
    tspl += 'DIRECTION 1\r\n';
    tspl += 'REFERENCE 0 0\r\n';
    tspl += 'SET PEEL OFF\r\n';
    tspl += 'SET TEAR ON\r\n';
    tspl += 'CLS\r\n';

    const elements = template?.panels?.[0]?.printElements || [];

    if (elements.length === 0) {
      dataList.forEach((data, index) => {
        const barcode = data.barcode || `202608190${String(index + 1).padStart(2, '0')}`;
        const model = data.model || 'DL3500';
        const capacity = data.capacity || '14.8V - 3.5Ah-51.8Wh';
        const colorText = data.color || '黑色';
        const powerText = data.power || '常规版';

        tspl += `TEXT 20,10,"0",1,1,1,"${model}-${capacity}"\r\n`;
        tspl += `TEXT 20,45,"0",1,1,1,"颜色：${colorText}"\r\n`;
        tspl += `TEXT 250,45,"0",1,1,1,"${powerText}"\r\n`;
        tspl += `BARCODE 100,75,"128",50,1,0,1,2,"${barcode}"\r\n`;
        tspl += `TEXT 20,140,"0",1,1,1,"CN ${barcode}"\r\n`;
      });
    } else {
      dataList.forEach((data, index) => {
        const itemData = hasMultiplePanels ? dataList[0] : data;
        elements.forEach((el) => {
          const type = el.printElementType?.type;
          const opts = el.options || {};

          let left = opts.left || 0;
          let top = opts.top || 0;
          let width = opts.width || 0;
          let height = opts.height || 0;

          const x = Math.round(left * dotPerMm);
          const y = Math.round(top * dotPerMm);
          const w = Math.round(width * dotPerMm);
          const h = Math.round(height * dotPerMm);

          if (type === 'text') {
            let title = opts.title || '';
            title = title.replace(/\{\{([^}]+)\}\}/g, (match, field) => {
              if (field === 'index') return String(index + 1);
              const value = itemData[field];
              return value !== undefined && value !== null ? String(value) : match;
            });

            const fontSize = opts.fontSize || 10;
            let tsplFontSize = 1;
            if (fontSize <= 10) tsplFontSize = 1;
            else if (fontSize <= 14) tsplFontSize = 2;
            else if (fontSize <= 18) tsplFontSize = 3;
            else if (fontSize <= 24) tsplFontSize = 4;
            else if (fontSize <= 30) tsplFontSize = 5;
            else if (fontSize <= 40) tsplFontSize = 6;
            else tsplFontSize = 7;

            const textAlign = opts.textAlign || 'left';
            let alignX = x;
            if (textAlign === 'center') {
              alignX = x + Math.round(w / 2);
            } else if (textAlign === 'right') {
              alignX = x + w;
            }

            const xMulti = opts.fontWeight === 'bolder' ? 2 : 1;
            const yMulti = opts.fontWeight === 'bolder' ? 2 : 1;
            title = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            tspl += `TEXT ${alignX},${y},"0",${tsplFontSize},${xMulti},${yMulti},"${title}"\r\n`;
          } else if (type === 'barcode') {
            let barcodeData = opts.testData || '';
            barcodeData = barcodeData.replace(/\{\{([^}]+)\}\}/g, (match, field) => {
              if (field === 'index') return String(index + 1);
              const value = itemData[field];
              return value !== undefined && value !== null ? String(value) : match;
            });

            const barcodeType = opts.barcodeType || 'code128';
            let tsplType = '128';
            if (barcodeType === 'code39') tsplType = '39';
            else if (barcodeType === 'code93') tsplType = '93';
            else if (barcodeType === 'code128') tsplType = '128';
            else if (barcodeType === 'ean13') tsplType = 'EAN13';
            else if (barcodeType === 'ean8') tsplType = 'EAN8';
            else if (barcodeType === 'upca') tsplType = 'UPCA';
            else if (barcodeType === 'upce') tsplType = 'UPCE';

            const barHeight = Math.max(Math.round((opts.height || 20) * dotPerMm / 4), 30);
            const narrowWidth = opts.barWidth ? Math.round(parseFloat(opts.barWidth) * 2) : 1;
            const wideWidth = narrowWidth * 3;

            tspl += `BARCODE ${x},${y},"${tsplType}",${barHeight},1,0,${narrowWidth},${wideWidth},"${barcodeData}"\r\n`;
          } else if (type === 'hline') {
            const lineWidth = opts.borderWidth ? Math.round(parseFloat(opts.borderWidth) * dotPerMm / 2) : 1;
            tspl += `LINE ${x},${y},${x + w},${y},${Math.max(lineWidth, 1)}\r\n`;
          } else if (type === 'rect') {
            const lineWidth = opts.borderWidth ? Math.round(parseFloat(opts.borderWidth) * dotPerMm / 2) : 1;
            tspl += `BOX ${x},${y},${x + w},${y + h},${Math.max(lineWidth, 1)}\r\n`;
          }
        });
      });
    }

    tspl += `PRINT ${dataList.length}\r\n`;
    return tspl;
  };

  // ===== 6. 通过中转服务发送 TSPL =====
  const sendTSPL = async (printer, tsplData) => {
    try {
      const response = await fetch(`${TRANSIT_HOST}/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          printer: printer,
          content: tsplData,
          contentType: 'text/plain',
          copies: 1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`中转服务返回错误: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ TSPL 发送成功:', result);
      return true;
    } catch (error) {
      console.error('❌ 发送 TSPL 失败:', error);
      throw error;
    }
  };

  // ===== 7. 静默打印（优先 print2，降级 TSPL） =====
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

    let dataList = Array.isArray(printData) ? printData : [printData];
    let template = templateData;

    if (onBeforePrint) {
      const bundle = await onBeforePrint(true);
      if (bundle) {
        dataList = Array.isArray(bundle.printData) ? bundle.printData : [bundle.printData];
        template = bundle.template || templateData;
      }
    }

    try {
      // ===== 第一招：print2（通用，兼容性好） =====
      // console.log('🖨️ 尝试 print2 打印...');
      // const customTemplate = new hiprintObj.PrintTemplate({ template });
      // const hasMultiplePanels = template?.panels && template.panels.length > 1;
      // const finalDataList = hasMultiplePanels ? [{}] : dataList;
      // // const { width: paperWidth, height: paperHeight } = getPaperSize(template);

      // const selectedPrinterObj = printerList.find(p => p.name === (selectedPrinter || printerName));
      // // 中转服务 printerList 里每台打印机自带顶层 clientId，不是 server.clientId
      // const clientId = selectedPrinterObj?.clientId || selectedPrinterObj?.server?.clientId;


      // console.log('clientId', clientId);  // 这个clientID,怎么是未定义

      // customTemplate.print2(finalDataList, {
      //   ...(clientId && { client: clientId }),
      //   printer: printer,
      //   silent: true,
      //   copies: finalDataList.length,
      // });
      
      // ===== 第一招：print2（通用，兼容性好） =====
      console.log('🖨️ 尝试 print2 打印...');

      // 1. 获取动态计算的纸张尺寸 (单位: mm)
      const { width: paperWidth, height: paperHeight } = getPaperSize(template);

      // 2. 实例化模板
      const customTemplate = new hiprintObj.PrintTemplate({ template });

      // 3. 【修正】直接使用毫米(mm)单位，不要 * 1000
      if (customTemplate.panels && customTemplate.panels.length > 0) {
        const panel = customTemplate.panels[0];
        panel.width = paperWidth;         // 单位：mm (例如 60)
        panel.height = paperHeight;       // 单位：mm (例如 30)
        panel.paperWidth = paperWidth;   // 单位：mm
        panel.paperHeight = paperHeight; // 单位：mm
        panel.paperType = 'other';       // 声明为自定义尺寸
      }

      const hasMultiplePanels = template?.panels && template.panels.length > 1;
      const finalDataList = hasMultiplePanels ? [{}] : dataList;

      // 4. 【核心修正】正确提取 clientId (避免 undefined)
      const selectedPrinterObj = printerList.find(p => p.name === (selectedPrinter || printerName));
      const clientId = selectedPrinterObj?.clientId || selectedPrinterObj?.server?.clientId || printerList[0]?.clientId;

      console.log('clientId:', clientId);

      // 5. 执行打印 (这里只需要传静默打印和打印机名字，无需传 pageSize)
      customTemplate.print2(finalDataList, {
        ...(clientId && { client: clientId }),
        printer: printer,
        silent: true,
        copies: finalDataList.length,
      });
  

      sendPrintLog({ dataList, mode: '打印' });
      // alert(`✅ 已发送 ${dataList.length} 张标签`);

    } catch (error) {
      // ===== 第二招：print2 失败，降级到 TSPL =====
      console.warn('print2 失败，尝试 TSPL 降级:', error);
      try {
        const tsplData = generateTSPL(dataList, template);
        await sendTSPL(printer, tsplData);
        sendPrintLog({ dataList, mode: '打印（TSPL 降级）' });
        // alert(`✅ 已发送 ${dataList.length} 张标签 (TSPL 降级)`);
      } catch (tsplError) {
        console.error('❌ TSPL 也失败:', tsplError);
        sendPrintLog({
          dataList,
          status: 'FAILED',
          mode: '打印',
          errorMessage: `${error.message} / ${tsplError.message}`,
        });
        alert('打印失败：' + error.message);
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
            onChange={(e) => setSelectedPrinter(e.target.value)}
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
          {/* 配置按钮 - 放在同一行 */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="打印机配置"
          >
            ⚙️
          </button>
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
                onClick={() => {
                  setShowConfirm(false);
                  handleSilentPrint();
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                ✅ 确认打印
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                取消
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
