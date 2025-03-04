import { NextRequest, NextResponse } from 'next/server';
import { simpleParser } from 'mailparser';
import { PdfWorkerService } from '@/lib/services/pdf-worker';

// 创建一个全局的Worker服务实例
const pdfWorkerService = new PdfWorkerService();

export async function POST(request: NextRequest) {
  console.log('开始处理PDF转换请求');
  const startTime = Date.now();

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    console.log(`收到 ${files.length} 个文件`);
    
    // 处理第一个文件
    const file = files[0];
    console.log('文件信息:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // 解析EML文件
    const buffer = await file.arrayBuffer();
    const parsed = await simpleParser(Buffer.from(buffer).toString());
    
    console.log('EML解析完成:', {
      subject: parsed.subject,
      from: parsed.from?.text,
      to: Array.isArray(parsed.to) ? parsed.to.length : 1,
      attachments: parsed.attachments?.length,
      hasHtml: !!parsed.html,
      hasText: !!parsed.text
    });

    // 使用Worker服务生成PDF
    const pdfBytes = await pdfWorkerService.generatePdf(parsed);
    
    const endTime = Date.now();
    console.log('PDF生成完成', {
      size: `${(pdfBytes.length / 1024 / 1024).toFixed(2)}MB`,
      time: `${endTime - startTime}ms`
    });

    // 返回生成的PDF
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name.replace('.eml', '.pdf'))}"`,
      },
    });
  } catch (error) {
    console.error('PDF转换失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  } finally {
    // 清理Worker资源
    await pdfWorkerService.cleanup();
  }
} 