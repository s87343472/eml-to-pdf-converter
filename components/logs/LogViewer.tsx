"use client";

import { useAppStore } from '@/lib/store/app-store';
import { useEffect, useRef } from 'react';

export function LogViewer() {
  const { logs, clearLogs } = useAppStore();
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新日志
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // 获取日志级别对应的样式
  const getLogLevelStyle = (level: string) => {
    switch (level) {
      case 'info':
        return 'text-blue-500';
      case 'success':
        return 'text-green-500';
      case 'warning':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  // 格式化时间戳
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">处理日志</h3>
        {logs.length > 0 && (
          <button
            onClick={clearLogs}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            清空日志
          </button>
        )}
      </div>
      <div
        ref={logContainerRef}
        className="bg-muted p-2 rounded-md h-48 overflow-y-auto text-sm font-mono"
      >
        {logs.length === 0 ? (
          <p className="text-muted-foreground">等待开始处理...</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="mb-1">
              <span className="text-muted-foreground mr-2">
                [{formatTimestamp(log.timestamp)}]
              </span>
              <span className={`${getLogLevelStyle(log.level)} mr-2`}>
                [{log.level.toUpperCase()}]
              </span>
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 