"use client";

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { FileUploader } from '@/components/file-upload/FileUploader';
import { FileList } from '@/components/file-upload/FileList';
import { useConverterStore } from '@/store/converter-store';

export function ConverterForm() {
  const [isConverting, setIsConverting] = useState(false);
  const { files, setFiles, addLog } = useConverterStore();

  const handleFiles = async (newFiles: File[]) => {
    console.log('ConverterForm: 收到新文件:', newFiles);
    setFiles(newFiles);
    addLog(`已选择 ${newFiles.length} 个文件`);
  };

  const handleConvert = async () => {
    if (!files.length) {
      addLog('错误: 请先选择要转换的文件');
      return;
    }

    setIsConverting(true);
    addLog('开始转换...');

    try {
      const formData = new FormData();
      files.forEach(file => {
        console.log('前端: 添加文件到 FormData:', {
          name: file.name,
          size: `${(file.size / 1024).toFixed(2)}KB`,
          type: file.type
        });
        formData.append('files', file);
      });

      console.log('前端: 发送转换请求');
      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
      });

      console.log('前端: 收到响应', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: `${(Number(response.headers.get('content-length')) / 1024).toFixed(2)}KB`,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `服务器错误 (${response.status})`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/pdf')) {
        console.error('前端: 响应类型错误', contentType);
        throw new Error(`响应类型错误: ${contentType}`);
      }

      // 获取 PDF 数据
      const pdfBlob = await response.blob();
      console.log('前端: PDF 大小:', pdfBlob.size, '字节');

      // 创建下载链接
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'converted.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      addLog('转换完成！');
    } catch (error) {
      console.error('前端: 转换失败:', error);
      addLog(`转换失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="space-y-4">
      <FileUploader onFilesAdded={handleFiles} />
      <FileList />
      <Button
        onClick={handleConvert}
        disabled={isConverting || files.length === 0}
        className="w-full"
      >
        {isConverting ? "转换中..." : "开始转换"}
      </Button>
    </div>
  );
} 