import { parse } from 'emailjs-mime-parser';
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

/**
 * 解析EML文件内容
 * @param emlContent EML文件内容（字符串或ArrayBuffer）
 * @returns 解析后的邮件对象
 */
export async function parseEmlContent(emlContent: string | ArrayBuffer): Promise<ParsedEmail> {
  // 如果输入是ArrayBuffer，转换为字符串
  let content: string;
  if (emlContent instanceof ArrayBuffer) {
    const buffer = new Uint8Array(emlContent);
    // 检测编码
    const detected = jschardet.detect(buffer);
    const encoding = detected.encoding || 'utf-8';
    
    try {
      const decoder = new TextDecoder(encoding);
      content = decoder.decode(buffer);
    } catch (e) {
      // 如果检测到的编码不支持，回退到UTF-8
      const decoder = new TextDecoder('utf-8');
      content = decoder.decode(buffer);
    }
  } else {
    content = emlContent;
  }

  // 解析EML内容
  const parsed = parse(content);
  
  // 提取基本信息
  const subject = decodeHeaderValue(getHeaderValue(parsed.headers, 'subject') || '无主题');
  const from = decodeHeaderValue(getHeaderValue(parsed.headers, 'from') || '');
  const to = getAddressListFromHeader(parsed.headers, 'to');
  const cc = getAddressListFromHeader(parsed.headers, 'cc');
  
  // 解析日期
  let date: Date | null = null;
  const dateStr = getHeaderValue(parsed.headers, 'date');
  if (dateStr) {
    try {
      date = new Date(dateStr);
    } catch (e) {
      console.error('无法解析邮件日期:', dateStr);
    }
  }
  
  // 提取正文和附件
  let textBody = '';
  let htmlBody: string | null = null;
  const attachments: EmailAttachment[] = [];
  
  // 收集所有头信息
  const headers: Record<string, string> = {};
  if (parsed.headers) {
    for (const [key, value] of parsed.headers.entries()) {
      if (typeof value === 'string') {
        headers[key.toLowerCase()] = decodeHeaderValue(value);
      } else if (value && value.value) {
        headers[key.toLowerCase()] = decodeHeaderValue(value.value);
      }
    }
  }
  
  // 处理邮件内容部分
  processNode(parsed, {
    textBody: (text) => { textBody += text; },
    htmlBody: (html) => { htmlBody = htmlBody ? htmlBody + html : html; },
    attachment: (attachment) => { attachments.push(attachment); }
  });
  
  return {
    subject,
    from,
    to,
    cc,
    date,
    textBody,
    htmlBody,
    attachments,
    headers
  };
}

/**
 * 递归处理MIME节点
 */
function processNode(
  node: any, 
  handlers: {
    textBody: (text: string) => void;
    htmlBody: (html: string) => void;
    attachment: (attachment: EmailAttachment) => void;
  }
) {
  // 检查是否是多部分内容
  if (node.childNodes && node.childNodes.length > 0) {
    // 递归处理子节点
    for (const childNode of node.childNodes) {
      processNode(childNode, handlers);
    }
    return;
  }
  
  // 获取内容类型和传输编码
  const contentType = (node.contentType || {}).value || '';
  const contentDisposition = getHeaderValue(node.headers, 'content-disposition') || '';
  const filename = getFilenameFromHeaders(node.headers);
  const contentId = getHeaderValue(node.headers, 'content-id')?.replace(/[<>]/g, '') || undefined;
  const contentTransferEncoding = getHeaderValue(node.headers, 'content-transfer-encoding') || '';
  
  // 检查是否是附件
  const isAttachment = contentDisposition.includes('attachment') || 
                       (filename && filename.length > 0);
  
  if (isAttachment) {
    // 处理附件
    handlers.attachment({
      filename: decodeHeaderValue(filename || `attachment-${Date.now()}`),
      contentType,
      content: node.content,
      contentId,
      disposition: contentDisposition,
      size: node.content ? node.content.byteLength : 0
    });
  } else if (contentType.includes('text/plain')) {
    // 处理纯文本内容
    const text = decodeContent(node.content, contentTransferEncoding);
    handlers.textBody(text);
  } else if (contentType.includes('text/html')) {
    // 处理HTML内容
    const html = decodeContent(node.content, contentTransferEncoding);
    handlers.htmlBody(html);
  } else if (contentType.includes('image/') && contentId) {
    // 处理内嵌图片
    handlers.attachment({
      filename: decodeHeaderValue(filename || `image-${contentId}`),
      contentType,
      content: node.content,
      contentId,
      disposition: 'inline',
      size: node.content ? node.content.byteLength : 0
    });
  }
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
 * 从头部获取地址列表
 */
function getAddressListFromHeader(headers: any, name: string): string[] {
  const header = getHeaderValue(headers, name);
  if (!header) return [];
  
  // 解码头部值
  const decodedHeader = decodeHeaderValue(header);
  
  // 简单的邮箱地址提取，实际应用中可能需要更复杂的解析
  return decodedHeader.split(',').map(addr => addr.trim());
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

/**
 * 解码邮件头部值（支持RFC 2047编码）
 */
function decodeHeaderValue(value: string): string {
  if (!value) return '';
  
  // 处理RFC 2047编码的头部
  return value.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        // Base64编码
        return decodeURIComponent(escape(atob(text)));
      } else if (encoding.toUpperCase() === 'Q') {
        // Quoted-Printable编码
        return decodeURIComponent(escape(decodeQuotedPrintable(text)));
      }
    } catch (e) {
      console.error('解码头部失败:', value, e);
    }
    return text;
  });
} 