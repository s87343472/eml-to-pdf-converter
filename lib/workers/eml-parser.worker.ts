import { simpleParser, AddressObject } from 'mailparser';

// 处理消息
self.onmessage = async (e) => {
  const { content, type } = e.data;
  
  try {
    let parsedContent: string = '';
    
    if (type === 'arraybuffer') {
      const buffer = new Uint8Array(content);
      parsedContent = new TextDecoder().decode(buffer);
    } else {
      parsedContent = content;
    }

    // 解析EML内容
    const parsed = await simpleParser(parsedContent);
    
    // 发送解析结果
    self.postMessage({ 
      success: true, 
      data: {
        subject: parsed.subject || '',
        from: parsed.from?.text || '',
        to: Array.isArray(parsed.to) ? parsed.to.map((addr: AddressObject) => addr.text) : [],
        cc: Array.isArray(parsed.cc) ? parsed.cc.map((addr: AddressObject) => addr.text) : [],
        date: parsed.date || null,
        text: parsed.text || '',
        html: parsed.html || null,
        attachments: parsed.attachments.map((att: any) => ({
          filename: att.filename || '',
          contentType: att.contentType || '',
          content: att.content,
          contentId: att.contentId,
          contentDisposition: att.contentDisposition,
          size: att.size || 0
        })),
        headers: Array.from(parsed.headers.entries())
      }
    });
  } catch (error) {
    // 发送错误信息
    self.postMessage({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}; 