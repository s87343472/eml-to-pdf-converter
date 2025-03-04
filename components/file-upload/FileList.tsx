"use client";

import { useState } from 'react';

export interface FileItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  progress?: number;
  error?: string;
}

interface FileListProps {
  files: FileItem[];
  onRemoveFile: (id: string) => void;
  onRemoveAllFiles: () => void;
}

export function FileList({ files, onRemoveFile, onRemoveAllFiles }: FileListProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const toggleSelectFile = (id: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedFiles(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(file => file.id)));
    }
  };

  const removeSelected = () => {
    selectedFiles.forEach(id => onRemoveFile(id));
    setSelectedFiles(new Set());
  };

  const getStatusColor = (status: FileItem['status']) => {
    switch (status) {
      case 'pending': return 'text-muted-foreground';
      case 'processing': return 'text-blue-500';
      case 'success': return 'text-green-500';
      case 'error': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusText = (status: FileItem['status']) => {
    switch (status) {
      case 'pending': return '等待处理';
      case 'processing': return '处理中';
      case 'success': return '已完成';
      case 'error': return '错误';
      default: return '未知状态';
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <input 
            type="checkbox" 
            id="select-all"
            className="mr-2"
            checked={files.length > 0 && selectedFiles.size === files.length}
            onChange={toggleSelectAll}
          />
          <label htmlFor="select-all" className="text-sm">
            全选
          </label>
        </div>
        <div className="flex gap-2">
          {selectedFiles.size > 0 && (
            <button 
              onClick={removeSelected}
              className="text-sm text-red-500 hover:text-red-700"
            >
              删除所选 ({selectedFiles.size})
            </button>
          )}
          {files.length > 0 && (
            <button 
              onClick={onRemoveAllFiles}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              清空全部
            </button>
          )}
        </div>
      </div>

      {files.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          尚未选择任何文件
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {files.map((file) => (
            <div 
              key={file.id}
              className="flex items-center p-3 border rounded-md hover:bg-muted/50 transition-colors"
            >
              <input 
                type="checkbox"
                checked={selectedFiles.has(file.id)}
                onChange={() => toggleSelectFile(file.id)}
                className="mr-3"
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div className="truncate font-medium">
                    {file.file.name}
                  </div>
                  <div className={`text-xs ml-2 ${getStatusColor(file.status)}`}>
                    {getStatusText(file.status)}
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{(file.file.size / 1024).toFixed(1)} KB</span>
                  {file.status === 'processing' && file.progress !== undefined && (
                    <span>{file.progress}%</span>
                  )}
                </div>
                {file.status === 'processing' && (
                  <div className="w-full bg-secondary h-1 rounded-full mt-1">
                    <div 
                      className="bg-primary h-1 rounded-full" 
                      style={{ width: `${file.progress || 0}%` }}
                    ></div>
                  </div>
                )}
                {file.status === 'error' && file.error && (
                  <div className="text-xs text-red-500 mt-1 truncate">
                    {file.error}
                  </div>
                )}
              </div>
              <button
                onClick={() => onRemoveFile(file.id)}
                className="ml-2 text-muted-foreground hover:text-foreground"
                title="删除文件"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 