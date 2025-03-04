"use client";

import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store/app-store';
import { useDropzone } from 'react-dropzone';

interface FileUploaderProps {
  maxFileSize?: number; // 单位：字节，默认10MB
  acceptedFileTypes?: string[]; // 默认['.eml']
  multiple?: boolean; // 默认true
  allowFolders?: boolean; // 默认true
  className?: string;
  onFilesAdded: (files: File[]) => void;
  maxFiles?: number;
}

export function FileUploader({
  maxFileSize = 10 * 1024 * 1024, // 10MB
  acceptedFileTypes = ['.eml'],
  multiple = true,
  allowFolders = true,
  className = '',
  onFilesAdded,
  maxFiles = 0,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const { addFiles, addLog } = useAppStore();
  
  // 验证文件
  const validateFile = (file: File): boolean => {
    // 检查文件大小
    if (file.size > maxFileSize) {
      addLog('warning', `文件 ${file.name} 超过大小限制 (${Math.round(maxFileSize / 1024 / 1024)}MB)`);
      return false;
    }
    
    // 检查文件类型
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!acceptedFileTypes.includes(fileExtension)) {
      addLog('warning', `文件 ${file.name} 类型不支持，仅支持 ${acceptedFileTypes.join(', ')} 文件`);
      return false;
    }
    
    return true;
  };
  
  // 处理文件
  const handleFiles = useCallback((files: FileList | File[]) => {
    const validFiles: File[] = [];
    
    Array.from(files).forEach(file => {
      if (validateFile(file)) {
        validFiles.push(file);
      }
    });
    
    if (validFiles.length > 0) {
      addFiles(validFiles);
      addLog('info', `已添加 ${validFiles.length} 个文件`);
      onFilesAdded(validFiles);
    }
  }, [addFiles, addLog, validateFile, onFilesAdded]);
  
  // 处理拖放
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);
  
  // 处理文件选择
  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      // 重置input，允许选择相同文件
      e.target.value = '';
    }
  }, [handleFiles]);
  
  // 处理文件夹选择
  const handleFolderSelect = useCallback(() => {
    // 创建一个隐藏的input元素用于选择文件夹
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        // 过滤出.eml文件
        const emlFiles = Array.from(target.files).filter(file => 
          file.name.toLowerCase().endsWith('.eml')
        );
        handleFiles(emlFiles);
      }
    };
    
    input.click();
  }, [handleFiles]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFiles,
    accept: {
      'message/rfc822': acceptedFileTypes,
    },
    maxFiles: maxFiles || undefined,
  });

  return (
    <div className={`w-full ${className}`}>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/20 hover:border-primary/50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="mb-4">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="48" 
            height="48" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="mx-auto text-muted-foreground"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <h3 className="text-lg font-medium mb-2">
          {isDragActive ? '释放鼠标上传文件' : '拖放EML文件到这里'}
        </h3>
        <p className="text-muted-foreground mb-4">或者点击选择文件</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={handleFileSelect}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            选择文件
          </button>
          <button
            type="button"
            onClick={handleFolderSelect}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
          >
            选择文件夹
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".eml"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center">
        支持的文件类型: .eml (邮件文件)
      </p>
    </div>
  );
}

// 为了支持directory属性，需要扩展HTMLInputElement
declare module 'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    // 添加directory和webkitdirectory属性
    directory?: string;
    webkitdirectory?: string;
  }
} 