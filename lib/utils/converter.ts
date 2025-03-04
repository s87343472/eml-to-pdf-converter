import { parseEmlContent } from './eml-parser';
import { convertEmailToPdf, mergePdfs } from './pdf-generator';
import { useAppStore } from '../store/app-store';

/**
 * 批量处理EML文件转换为PDF
 * @param files 要处理的文件数组
 * @param options 转换选项
 */
export async function batchProcessEmlFiles(
  files: File[],
  options: {
    batchSize: number;
    mergePdf: boolean;
    autoPrint: boolean;
    onProgress?: (fileId: string, progress: number) => void;
    onComplete?: (fileId: string, pdfData: Uint8Array) => void;
    onError?: (fileId: string, error: string) => void;
    onBatchComplete?: (pdfData: Uint8Array) => void;
  }
) {
  const { 
    batchSize = 50, 
    mergePdf = false, 
    autoPrint = false,
    onProgress, 
    onComplete, 
    onError,
    onBatchComplete
  } = options;
  
  // 获取应用状态
  const { 
    updateFileStatus, 
    addLog, 
    isProcessing,
    incrementProcessed
  } = useAppStore.getState();
  
  // 将文件分批处理
  const batches: File[][] = [];
  for (let i = 0; i < files.length; i += batchSize) {
    batches.push(files.slice(i, i + batchSize));
  }
  
  // 存储所有生成的PDF数据
  const allPdfData: Uint8Array[] = [];
  
  // 处理每一批文件
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchPdfData: Uint8Array[] = [];
    
    addLog('info', `开始处理第 ${batchIndex + 1}/${batches.length} 批文件 (${batch.length} 个文件)`);
    
    // 并行处理批次中的每个文件
    await Promise.all(
      batch.map(async (file) => {
        // 获取文件ID（这里使用文件名作为ID，实际应用中应该使用唯一标识符）
        const fileId = file.name;
        
        try {
          // 检查是否暂停处理
          if (!isProcessing) {
            return;
          }
          
          // 更新文件状态为处理中
          updateFileStatus(fileId, 'processing');
          
          // 读取EML文件内容
          const fileContent = await readFileAsArrayBuffer(file);
          
          // 解析EML内容
          const email = await parseEmlContent(fileContent);
          
          // 更新进度
          if (onProgress) {
            onProgress(fileId, 50);
          }
          
          // 转换为PDF
          const pdfData = await convertEmailToPdf(email);
          
          // 更新进度
          if (onProgress) {
            onProgress(fileId, 100);
          }
          
          // 如果需要合并PDF，将PDF数据添加到批次数组
          if (mergePdf) {
            batchPdfData.push(pdfData);
          }
          
          // 如果不需要合并，直接调用完成回调
          if (!mergePdf && onComplete) {
            onComplete(fileId, pdfData);
          }
          
          // 更新文件状态为成功
          updateFileStatus(fileId, 'success');
          incrementProcessed();
          addLog('success', `成功处理文件: ${file.name}`);
          
          // 如果启用了自动打印模式，触发打印
          if (autoPrint && !mergePdf) {
            printPdf(pdfData, getSafeFilename(file.name));
          }
        } catch (error) {
          // 处理错误
          const errorMessage = error instanceof Error ? error.message : String(error);
          updateFileStatus(fileId, 'error', 0, errorMessage);
          addLog('error', `处理文件失败: ${file.name} - ${errorMessage}`);
          
          if (onError) {
            onError(fileId, errorMessage);
          }
        }
      })
    );
    
    // 如果需要合并PDF并且有成功处理的文件
    if (mergePdf && batchPdfData.length > 0) {
      try {
        // 合并批次中的所有PDF
        const mergedPdf = await mergePdfs(batchPdfData);
        
        // 将合并后的PDF添加到总数组
        allPdfData.push(mergedPdf);
        
        // 调用批次完成回调
        if (onBatchComplete) {
          onBatchComplete(mergedPdf);
        }
        
        // 如果启用了自动打印模式，触发打印
        if (autoPrint) {
          printPdf(mergedPdf, `merged_batch_${batchIndex + 1}_${new Date().getTime()}.pdf`);
        }
        
        addLog('success', `成功合并第 ${batchIndex + 1} 批文件的PDF`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        addLog('error', `合并PDF失败: ${errorMessage}`);
      }
    }
  }
  
  // 如果需要合并所有批次的PDF
  if (mergePdf && allPdfData.length > 1) {
    try {
      // 合并所有批次的PDF
      const finalMergedPdf = await mergePdfs(allPdfData);
      
      // 调用批次完成回调
      if (onBatchComplete) {
        onBatchComplete(finalMergedPdf);
      }
      
      // 如果启用了自动打印模式，触发打印
      if (autoPrint) {
        printPdf(finalMergedPdf, `merged_all_${new Date().getTime()}.pdf`);
      }
      
      addLog('success', '成功合并所有批次的PDF');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog('error', `合并所有PDF失败: ${errorMessage}`);
    }
  }
  
  addLog('info', '所有文件处理完成');
}

/**
 * 将文件读取为ArrayBuffer
 */
async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('无法读取文件'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('读取文件时发生错误'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 打印PDF
 */
function printPdf(pdfData: Uint8Array, filename: string) {
  // 创建Blob对象
  const blob = new Blob([pdfData], { type: 'application/pdf' });
  
  // 创建URL
  const url = URL.createObjectURL(blob);
  
  // 创建iframe用于打印
  const printFrame = document.createElement('iframe');
  printFrame.style.display = 'none';
  printFrame.src = url;
  printFrame.title = filename;
  
  // 添加到文档
  document.body.appendChild(printFrame);
  
  // 监听iframe加载完成事件
  printFrame.onload = () => {
    try {
      // 打印
      printFrame.contentWindow?.print();
      
      // 延迟移除iframe和释放URL
      setTimeout(() => {
        document.body.removeChild(printFrame);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error('打印PDF时发生错误:', error);
    }
  };
}

/**
 * 下载PDF
 */
export function downloadPdf(pdfData: Uint8Array, filename: string) {
  // 创建Blob对象
  const blob = new Blob([pdfData], { type: 'application/pdf' });
  
  // 创建URL
  const url = URL.createObjectURL(blob);
  
  // 创建下载链接
  const link = document.createElement('a');
  link.href = url;
  
  // 处理文件名
  const safeFilename = getSafeFilename(filename);
  link.download = safeFilename.endsWith('.pdf') ? safeFilename : `${safeFilename}.pdf`;
  
  // 触发点击
  document.body.appendChild(link);
  link.click();
  
  // 延迟移除链接和释放URL
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * 获取安全的文件名（移除不安全字符）
 */
function getSafeFilename(filename: string): string {
  // 移除文件名中的不安全字符
  let safeName = filename.replace(/[\\/:*?"<>|]/g, '_');
  
  // 如果文件名以.eml结尾，替换为.pdf
  if (safeName.toLowerCase().endsWith('.eml')) {
    safeName = safeName.substring(0, safeName.length - 4) + '.pdf';
  }
  
  return safeName;
} 