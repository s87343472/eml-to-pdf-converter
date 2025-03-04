import { simpleParser } from 'mailparser';
import jschardet from 'jschardet';

export interface ParsedEmail {
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  date: Date | null;
  textBody: string;
  htmlBody: string | null;
  attachments: EmailAttachment[];
  headers: Record<string, string>;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Uint8Array;
  contentId?: string;
  disposition?: string;
  size: number;
}

// 创建一个延迟加载的 Worker
let worker: Worker | null = null;

function getWorker() {
  if (!worker && typeof window !== 'undefined') {
    worker = new Worker(new URL('../workers/eml-parser.worker.ts', import.meta.url));
  }
  return worker;
}

/**
 * 解析EML文件内容
 * @param emlContent EML文件内容（字符串或ArrayBuffer）
 * @returns 解析后的邮件对象
 */
export async function parseEmlContent(emlContent: string | ArrayBuffer): Promise<ParsedEmail> {
  // 如果在服务器端，直接解析
  if (typeof window === 'undefined') {
    return parseEmlContentSync(emlContent);
  }

  // 在客户端使用 Worker
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    if (!worker) {
      reject(new Error('无法创建 Web Worker'));
      return;
    }

    // 处理 Worker 消息
    const messageHandler = (e: MessageEvent) => {
      const { success, data, error } = e.data;
      
      // 移除消息处理器
      worker.removeEventListener('message', messageHandler);
      
      if (success) {
        resolve(processParsedData(data));
      } else {
        reject(new Error(error));
      }
    };
    
    // 添加消息处理器
    worker.addEventListener('message', messageHandler);
    
    // 发送数据给 Worker
    worker.postMessage({
      content: emlContent,
      type: emlContent instanceof ArrayBuffer ? 'arraybuffer' : 'string'
    });
  });
}

/**
 * 同步解析EML内容（用于服务器端）
 */
async function parseEmlContentSync(emlContent: string | ArrayBuffer): Promise<ParsedEmail> {
  let content: string = '';
  
  if (emlContent instanceof ArrayBuffer) {
    const buffer = new Uint8Array(emlContent);
    content = new TextDecoder().decode(buffer);
  } else {
    content = emlContent;
  }

  try {
    // 解析EML内容
    const parsed = await simpleParser(content);
    return processParsedData(parsed);
  } catch (error) {
    console.error('解析EML失败:', error);
    throw error;
  }
}

/**
 * 处理解析后的数据
 */
function processParsedData(parsed: any): ParsedEmail {
  return {
    subject: parsed.subject || '',
    from: parsed.from?.text || '',
    to: Array.isArray(parsed.to) ? parsed.to.map((addr: any) => addr.text) : [],
    cc: Array.isArray(parsed.cc) ? parsed.cc.map((addr: any) => addr.text) : [],
    date: parsed.date || null,
    textBody: parsed.text || '',
    htmlBody: parsed.html || null,
    attachments: parsed.attachments.map((att: any) => ({
      filename: att.filename || '',
      contentType: att.contentType || '',
      content: att.content,
      contentId: att.contentId,
      disposition: att.contentDisposition,
      size: att.size || 0
    })),
    headers: Object.fromEntries(parsed.headers)
  };
}

/**
 * 从头部获取值
 */
function getHeaderValue(headers: any, name: string): string | undefined {
  if (!headers) return undefined;
  
  const header = headers.get(name);
  if (!header) return undefined;
  
  if (typeof header === 'string') return header;
  if (header.value) return header.value;
  return undefined;
}

/**
 * 从头部获取文件名
 */
function getFilenameFromHeaders(headers: any): string {
  // 尝试从Content-Disposition获取
  const disposition = getHeaderValue(headers, 'content-disposition');
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/i);
    if (match && match[1]) return match[1];
    
    // 尝试获取filename*=UTF-8''格式的文件名
    const encodedMatch = disposition.match(/filename\*=([^']+)'[^']*'([^;]+)/i);
    if (encodedMatch && encodedMatch[2]) {
      try {
        return decodeURIComponent(encodedMatch[2]);
      } catch (e) {
        console.error('解码文件名失败:', encodedMatch[2]);
      }
    }
  }
  
  // 尝试从Content-Type获取
  const contentType = getHeaderValue(headers, 'content-type');
  if (contentType) {
    const match = contentType.match(/name="?([^"]+)"?/i);
    if (match && match[1]) return match[1];
  }
  
  return '';
}

/**
 * 解码内容
 */
function decodeContent(content: Uint8Array, encoding?: string): string {
  if (!content || content.length === 0) return '';
  
  // 处理不同的传输编码
  if (encoding && encoding.toLowerCase() === 'base64') {
    try {
      // 将base64编码的内容转换为字符串
      const binary = String.fromCharCode.apply(null, Array.from(content));
      const decoded = atob(binary);
      return decoded;
    } catch (e) {
      console.error('Base64解码失败:', e);
    }
  }
  
  if (encoding && encoding.toLowerCase() === 'quoted-printable') {
    try {
      // 将quoted-printable编码的内容转换为字符串
      const text = new TextDecoder().decode(content);
      return decodeQuotedPrintable(text);
    } catch (e) {
      console.error('Quoted-printable解码失败:', e);
    }
  }
  
  try {
    // 检测编码
    const detected = jschardet.detect(content);
    const charset = detected.encoding || 'utf-8';
    
    const decoder = new TextDecoder(charset);
    return decoder.decode(content);
  } catch (e) {
    // 如果解码失败，尝试使用UTF-8
    try {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(content);
    } catch (e) {
      console.error('无法解码内容:', e);
      return '';
    }
  }
}

/**
 * 解码Quoted-Printable编码
 */
function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r\n/g, '')
    .replace(/=([0-9A-F]{2})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
}