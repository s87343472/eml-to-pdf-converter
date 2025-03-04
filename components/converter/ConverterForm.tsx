"use client";

import { useState } from 'react';
import { useAppStore } from '@/lib/store/app-store';
import { FileUploader } from '../file-upload/FileUploader';
import { FileList } from '../file-upload/FileList';
import { batchProcessEmlFiles, downloadPdf } from '@/lib/utils/converter';

export function ConverterForm() {
  const {
    files,
    addFiles,
    removeFile,
    clearFiles,
    options,
    updateOptions,
    isProcessing,
    startProcessing,
    pauseProcessing,
    stopProcessing,
    addLog,
    processedCount,
    totalCount
  } = useAppStore();

  const [isConverting, setIsConverting] = useState(false);

  // 处理文件上传
  const handleFilesAdded = (newFiles: File[]) => {
    addFiles(newFiles);
    addLog('info', `已添加 ${newFiles.length} 个文件`);
  };

  // 处理开始转换
  const handleStartConversion = async () => {
    if (files.length === 0) {
      addLog('warning', '没有选择任何文件');
      return;
    }

    setIsConverting(true);
    startProcessing();
    addLog('info', '开始转换处理');

    try {
      await batchProcessEmlFiles(
        files.map(f => f.file),
        {
          batchSize: options.batchSize,
          mergePdf: options.mergePdf,
          autoPrint: options.autoPrint,
          onProgress: (fileId, progress) => {
            // 更新文件进度
            const file = files.find(f => f.file.name === fileId);
            if (file) {
              const fileIndex = files.indexOf(file);
              addLog('info', `处理文件 ${fileIndex + 1}/${files.length}: ${progress}%`);
            }
          },
          onComplete: (fileId, pdfData) => {
            // 处理单个文件完成
            const file = files.find(f => f.file.name === fileId);
            if (file) {
              // 下载PDF
              downloadPdf(pdfData, file.file.name);
            }
          },
          onError: (fileId, error) => {
            // 处理错误
            addLog('error', `处理文件失败: ${error}`);
          },
          onBatchComplete: (pdfData) => {
            // 处理批次完成
            if (options.mergePdf) {
              downloadPdf(pdfData, `merged_emails_${new Date().getTime()}.pdf`);
            }
          }
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog('error', `转换过程中发生错误: ${errorMessage}`);
    } finally {
      setIsConverting(false);
      stopProcessing();
    }
  };

  // 处理暂停/继续转换
  const handlePauseResumeConversion = () => {
    if (isProcessing) {
      pauseProcessing();
      addLog('info', '已暂停转换');
    } else {
      startProcessing();
      addLog('info', '已继续转换');
    }
  };

  // 计算进度百分比
  const progressPercentage = totalCount > 0 
    ? Math.round((processedCount / totalCount) * 100) 
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 space-y-6">
        {/* 文件上传区域 */}
        <div className="border rounded-lg p-4">
          <FileUploader onFilesAdded={handleFilesAdded} />
        </div>

        {/* 文件列表区域 */}
        <div className="border rounded-lg p-4">
          <FileList 
            files={files} 
            onRemoveFile={removeFile} 
            onRemoveAllFiles={clearFiles} 
          />
        </div>
      </div>

      <div className="lg:col-span-4 space-y-6">
        {/* 配置面板 */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">配置选项</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">批量大小</label>
              <select 
                className="w-full p-2 border rounded-md"
                value={options.batchSize}
                onChange={(e) => updateOptions({ batchSize: parseInt(e.target.value) })}
                disabled={isConverting}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                每次处理的文件数量，较小的值可以减少内存使用
              </p>
            </div>
            
            <div className="flex items-center">
              <input 
                type="checkbox" 
                id="merge-pdf" 
                className="mr-2"
                checked={options.mergePdf}
                onChange={(e) => updateOptions({ mergePdf: e.target.checked })}
                disabled={isConverting}
              />
              <label htmlFor="merge-pdf">合并为单个PDF</label>
            </div>
            
            <div className="flex items-center">
              <input 
                type="checkbox" 
                id="auto-print" 
                className="mr-2"
                checked={options.autoPrint}
                onChange={(e) => updateOptions({ autoPrint: e.target.checked })}
                disabled={isConverting}
              />
              <label htmlFor="auto-print">自动打印模式</label>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="border rounded-lg p-4">
          <button 
            className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors mb-2"
            onClick={handleStartConversion}
            disabled={isConverting || files.length === 0}
          >
            {isConverting ? '正在转换...' : '开始转换'}
          </button>
          <button 
            className="w-full py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
            onClick={handlePauseResumeConversion}
            disabled={!isConverting}
          >
            {isProcessing ? '暂停' : '继续'}
          </button>
        </div>

        {/* 进度显示 */}
        {isConverting && (
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-medium mb-2">转换进度</h3>
            <div className="w-full bg-secondary h-2 rounded-full mb-2">
              <div 
                className="bg-primary h-2 rounded-full" 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <p className="text-sm text-center">
              {processedCount} / {totalCount} 文件已处理 ({progressPercentage}%)
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 