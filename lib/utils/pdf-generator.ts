import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from 'pdf-lib';
import html2canvas from 'html2canvas';
import { ParsedEmail, EmailAttachment } from './eml-parser';
import fontkit from '@pdf-lib/fontkit';
import { join } from 'path';
import { readFileSync } from 'fs';
import { ParsedMail } from 'mailparser';
import { Worker } from 'worker_threads';

/**
 * 将HTML内容转换为PDF
 * @param email 解析后的邮件对象
 * @returns PDF文件的Uint8Array
 */
export async function convertEmailToPdf(email: ParsedEmail): Promise<Uint8Array> {
  // 创建一个新的PDF文档
  const pdfDoc = await PDFDocument.create();
  
  // 添加元数据
  pdfDoc.setTitle(email.subject);
  pdfDoc.setAuthor('EML to PDF Converter');
  pdfDoc.setCreator('EML to PDF Converter');
  pdfDoc.setProducer('EML to PDF Converter');
  pdfDoc.setSubject(email.subject);
  
  // 加载字体
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // 添加邮件头信息页
  await addHeaderPage(pdfDoc, email, regularFont, boldFont);
  
  // 如果有HTML内容，添加HTML渲染页
  if (email.htmlBody) {
    await addHtmlPage(pdfDoc, email);
  } else {
    // 否则添加纯文本内容页
    await addTextPage(pdfDoc, email, regularFont, boldFont);
  }
  
  // 添加附件信息页（如果有附件）
  if (email.attachments.length > 0) {
    await addAttachmentsPage(pdfDoc, email, regularFont, boldFont);
  }
  
  // 保存PDF文档
  return await pdfDoc.save();
}

/**
 * 添加邮件头信息页
 */
async function addHeaderPage(
  pdfDoc: PDFDocument, 
  email: ParsedEmail,
  regularFont: PDFFont,
  boldFont: PDFFont
) {
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 11;
  const margin = 50;
  
  // 添加标题
  page.drawText('邮件信息 / Email Information', {
    x: margin,
    y: height - margin,
    size: 16,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  
  // 添加分隔线
  page.drawLine({
    start: { x: margin, y: height - margin - 20 },
    end: { x: width - margin, y: height - margin - 20 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  
  // 添加邮件基本信息
  let yPos = height - margin - 50;
  const lineHeight = fontSize * 1.5;
  const labelWidth = 100;
  
  // 主题
  drawLabelValuePair(
    page, 
    '主题 / Subject:', 
    email.subject, 
    margin, 
    yPos, 
    fontSize, 
    boldFont, 
    regularFont, 
    labelWidth,
    width - margin * 2 - labelWidth
  );
  yPos -= lineHeight * 2;
  
  // 发件人
  drawLabelValuePair(
    page, 
    '发件人 / From:', 
    email.from, 
    margin, 
    yPos, 
    fontSize, 
    boldFont, 
    regularFont, 
    labelWidth,
    width - margin * 2 - labelWidth
  );
  yPos -= lineHeight * 2;
  
  // 收件人
  drawLabelValuePair(
    page, 
    '收件人 / To:', 
    email.to.join(', '), 
    margin, 
    yPos, 
    fontSize, 
    boldFont, 
    regularFont, 
    labelWidth,
    width - margin * 2 - labelWidth
  );
  yPos -= lineHeight * 2;
  
  // 抄送
  if (email.cc.length > 0) {
    drawLabelValuePair(
      page, 
      '抄送 / CC:', 
      email.cc.join(', '), 
      margin, 
      yPos, 
      fontSize, 
      boldFont, 
      regularFont, 
      labelWidth,
      width - margin * 2 - labelWidth
    );
    yPos -= lineHeight * 2;
  }
  
  // 日期
  if (email.date) {
    drawLabelValuePair(
      page, 
      '日期 / Date:', 
      formatDate(email.date), 
      margin, 
      yPos, 
      fontSize, 
      boldFont, 
      regularFont, 
      labelWidth,
      width - margin * 2 - labelWidth
    );
    yPos -= lineHeight * 2;
  }
  
  // 附件数量
  drawLabelValuePair(
    page, 
    '附件 / Attachments:', 
    `${email.attachments.length} 个文件`, 
    margin, 
    yPos, 
    fontSize, 
    boldFont, 
    regularFont, 
    labelWidth,
    width - margin * 2 - labelWidth
  );
  
  // 添加其他重要头信息
  if (Object.keys(email.headers).length > 0) {
    yPos -= lineHeight * 2;
    
    page.drawText('其他头信息 / Other Headers:', {
      x: margin,
      y: yPos,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    
    yPos -= lineHeight;
    
    // 显示一些重要的头信息
    const importantHeaders = [
      'message-id', 'reply-to', 'sender', 'return-path', 'importance', 'priority'
    ];
    
    for (const header of importantHeaders) {
      if (email.headers[header]) {
        yPos -= lineHeight;
        
        if (yPos < margin) {
          // 如果页面空间不足，添加新页面
          const newPage = pdfDoc.addPage();
          yPos = newPage.getSize().height - margin;
          
          // 添加标题
          newPage.drawText('邮件头信息（续） / Email Headers (Continued)', {
            x: margin,
            y: yPos,
            size: 16,
            font: boldFont,
            color: rgb(0, 0, 0),
          });
          
          yPos -= lineHeight * 2;
        }
        
        drawLabelValuePair(
          page, 
          `${header}:`, 
          email.headers[header], 
          margin, 
          yPos, 
          fontSize, 
          boldFont, 
          regularFont, 
          labelWidth,
          width - margin * 2 - labelWidth
        );
      }
    }
  }
}

/**
 * 添加HTML内容页
 */
async function addHtmlPage(pdfDoc: PDFDocument, email: ParsedEmail) {
  // 创建一个临时的div来渲染HTML
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.padding = '20px';
  container.style.backgroundColor = 'white';
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.fontFamily = 'Arial, sans-serif';
  
  // 设置HTML内容
  const htmlContent = email.htmlBody || '';
  
  // 处理内嵌图片
  const processedHtml = processHtmlWithInlineImages(htmlContent, email.attachments);
  container.innerHTML = processedHtml;
  
  // 将容器添加到文档中
  document.body.appendChild(container);
  
  try {
    // 使用html2canvas将HTML渲染为canvas
    const canvas = await html2canvas(container, {
      scale: 1.5, // 提高分辨率
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: '#ffffff',
    });
    
    // 将canvas转换为PNG图像
    const pngData = canvas.toDataURL('image/png');
    
    // 从base64字符串中提取二进制数据
    const base64Data = pngData.split(',')[1];
    const imageData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // 将图像嵌入到PDF中
    const image = await pdfDoc.embedPng(imageData);
    
    // 计算适合页面的尺寸
    const pageWidth = 595; // A4宽度（点）
    const pageHeight = 842; // A4高度（点）
    const margin = 50;
    
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;
    
    const imageWidth = image.width;
    const imageHeight = image.height;
    
    // 计算缩放比例
    const scale = Math.min(
      availableWidth / imageWidth,
      availableHeight / imageHeight
    );
    
    const scaledWidth = imageWidth * scale;
    const scaledHeight = imageHeight * scale;
    
    // 计算页数
    const pagesNeeded = Math.ceil(imageHeight / (availableHeight / scale));
    
    // 添加页面并绘制图像的不同部分
    for (let i = 0; i < pagesNeeded; i++) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      
      const yOffset = i * (availableHeight / scale);
      
      // 使用裁剪后的图像部分
      const partHeight = Math.min(availableHeight / scale, imageHeight - yOffset);
      
      // 创建一个新的canvas来裁剪图像
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = imageWidth;
      tempCanvas.height = partHeight;
      
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        // 绘制图像的一部分到临时canvas
        ctx.drawImage(
          canvas, 
          0, yOffset, 
          imageWidth, partHeight, 
          0, 0, 
          imageWidth, partHeight
        );
        
        // 将临时canvas转换为PNG
        const partPngData = tempCanvas.toDataURL('image/png');
        const partBase64Data = partPngData.split(',')[1];
        const partImageData = Uint8Array.from(atob(partBase64Data), c => c.charCodeAt(0));
        
        // 将部分图像嵌入到PDF中
        const partImage = await pdfDoc.embedPng(partImageData);
        
        // 绘制部分图像
        page.drawImage(partImage, {
          x: margin,
          y: pageHeight - margin - (scaledHeight / pagesNeeded),
          width: scaledWidth,
          height: (partHeight / imageHeight) * scaledHeight,
        });
      }
    }
  } finally {
    // 清理：从文档中移除临时容器
    document.body.removeChild(container);
  }
}

/**
 * 添加纯文本内容页
 */
async function addTextPage(
  pdfDoc: PDFDocument, 
  email: ParsedEmail,
  regularFont: PDFFont,
  boldFont: PDFFont
) {
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 11;
  const lineHeight = fontSize * 1.2;
  const margin = 50;
  
  // 添加标题
  page.drawText('邮件内容 / Email Content', {
    x: margin,
    y: height - margin,
    size: 16,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  
  // 添加分隔线
  page.drawLine({
    start: { x: margin, y: height - margin - 20 },
    end: { x: width - margin, y: height - margin - 20 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  
  // 处理文本内容
  const textLines = email.textBody.split('\n');
  let yPos = height - margin - 50;
  let currentPage = page;
  
  for (const line of textLines) {
    // 如果到达页面底部，添加新页面
    if (yPos < margin) {
      currentPage = pdfDoc.addPage();
      yPos = currentPage.getSize().height - margin;
    }
    
    // 处理长行，进行自动换行
    const maxLineWidth = width - margin * 2;
    const words = line.split(' ');
    let currentLine = '';
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const lineWidth = regularFont.widthOfTextAtSize(testLine, fontSize);
      
      if (lineWidth > maxLineWidth && i > 0) {
        // 绘制当前行并开始新行
        currentPage.drawText(currentLine, {
          x: margin,
          y: yPos,
          size: fontSize,
          font: regularFont,
          color: rgb(0, 0, 0),
        });
        
        yPos -= lineHeight;
        currentLine = word;
        
        // 检查是否需要新页面
        if (yPos < margin) {
          currentPage = pdfDoc.addPage();
          yPos = currentPage.getSize().height - margin;
        }
      } else {
        currentLine = testLine;
      }
    }
    
    // 绘制最后一行
    if (currentLine) {
      currentPage.drawText(currentLine, {
        x: margin,
        y: yPos,
        size: fontSize,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
    }
    
    yPos -= lineHeight;
  }
}

/**
 * 添加附件信息页
 */
async function addAttachmentsPage(
  pdfDoc: PDFDocument, 
  email: ParsedEmail,
  regularFont: PDFFont,
  boldFont: PDFFont
) {
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 11;
  const lineHeight = fontSize * 1.5;
  const margin = 50;
  
  // 添加标题
  page.drawText('附件列表 / Attachments List', {
    x: margin,
    y: height - margin,
    size: 16,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  
  // 添加分隔线
  page.drawLine({
    start: { x: margin, y: height - margin - 20 },
    end: { x: width - margin, y: height - margin - 20 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  
  // 列出附件
  let yPos = height - margin - 50;
  let currentPage = page;
  
  for (let i = 0; i < email.attachments.length; i++) {
    const attachment = email.attachments[i];
    
    // 如果到达页面底部，添加新页面
    if (yPos < margin + lineHeight * 4) {
      currentPage = pdfDoc.addPage();
      yPos = currentPage.getSize().height - margin;
      
      // 添加标题
      currentPage.drawText('附件列表（续） / Attachments List (Continued)', {
        x: margin,
        y: yPos,
        size: 16,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      
      // 添加分隔线
      currentPage.drawLine({
        start: { x: margin, y: yPos - 20 },
        end: { x: width - margin, y: yPos - 20 },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
      
      yPos -= 50;
    }
    
    // 绘制附件信息
    currentPage.drawText(`${i + 1}. ${attachment.filename}`, {
      x: margin,
      y: yPos,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    
    yPos -= lineHeight;
    
    // 绘制附件类型
    currentPage.drawText(`类型 / Type: ${attachment.contentType}`, {
      x: margin + 20,
      y: yPos,
      size: fontSize,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    
    yPos -= lineHeight;
    
    // 绘制附件大小
    currentPage.drawText(`大小 / Size: ${formatFileSize(attachment.size)}`, {
      x: margin + 20,
      y: yPos,
      size: fontSize,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    
    // 如果是内嵌附件，显示内嵌ID
    if (attachment.contentId) {
      yPos -= lineHeight;
      currentPage.drawText(`内嵌ID / Content ID: ${attachment.contentId}`, {
        x: margin + 20,
        y: yPos,
        size: fontSize,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
    }
    
    yPos -= lineHeight * 1.5;
  }
}

/**
 * 绘制标签-值对
 */
function drawLabelValuePair(
  page: PDFPage,
  label: string,
  value: string,
  x: number,
  y: number,
  fontSize: number,
  labelFont: PDFFont,
  valueFont: PDFFont,
  labelWidth: number,
  valueWidth: number
) {
  // 绘制标签
  page.drawText(label, {
    x,
    y,
    size: fontSize,
    font: labelFont,
    color: rgb(0, 0, 0),
  });
  
  // 处理可能的长值，进行自动换行
  const words = value.split(' ');
  let currentLine = '';
  let currentY = y;
  const lineHeight = fontSize * 1.2;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const lineWidth = valueFont.widthOfTextAtSize(testLine, fontSize);
    
    if (lineWidth > valueWidth && i > 0) {
      // 绘制当前行并开始新行
      page.drawText(currentLine, {
        x: x + labelWidth,
        y: currentY,
        size: fontSize,
        font: valueFont,
        color: rgb(0, 0, 0),
      });
      
      currentY -= lineHeight;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  // 绘制最后一行
  if (currentLine) {
    page.drawText(currentLine, {
      x: x + labelWidth,
      y: currentY,
      size: fontSize,
      font: valueFont,
      color: rgb(0, 0, 0),
    });
  }
}

/**
 * 处理HTML中的内嵌图片
 */
function processHtmlWithInlineImages(html: string, attachments: EmailAttachment[]): string {
  let processedHtml = html;
  
  // 查找具有contentId的附件
  const inlineAttachments = attachments.filter(att => att.contentId && att.disposition === 'inline');
  
  // 替换内嵌图片引用
  for (const attachment of inlineAttachments) {
    if (attachment.contentId) {
      const contentId = attachment.contentId.replace(/[<>]/g, '');
      const regex = new RegExp(`cid:${contentId}`, 'gi');
      
      // 创建Blob URL
      const blob = new Blob([attachment.content], { type: attachment.contentType });
      const blobUrl = URL.createObjectURL(blob);
      
      // 替换CID引用为Blob URL
      processedHtml = processedHtml.replace(regex, blobUrl);
    }
  }
  
  return processedHtml;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * 合并多个PDF文件
 * @param pdfBuffers PDF文件的Uint8Array数组
 * @returns 合并后的PDF文件的Uint8Array
 */
export async function mergePdfs(pdfBuffers: Uint8Array[]): Promise<Uint8Array> {
  // 创建一个新的PDF文档
  const mergedPdf = await PDFDocument.create();
  
  // 逐个处理每个PDF
  for (const buffer of pdfBuffers) {
    // 加载PDF文档
    const pdf = await PDFDocument.load(buffer);
    
    // 复制所有页面
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    
    // 将页面添加到合并的PDF中
    pages.forEach(page => {
      mergedPdf.addPage(page);
    });
  }
  
  // 保存合并后的PDF
  return await mergedPdf.save();
}

interface PdfGeneratorOptions {
  fontSize?: number;
  margin?: number;
  lineHeight?: number;
  maxLineLength?: number;
}

export class PdfGenerator {
  private pdfDoc!: PDFDocument;
  private regularFont!: PDFFont;
  private boldFont!: PDFFont;
  private options: Required<PdfGeneratorOptions>;
  private fontWidthCache = new Map<string, number>();
  private static fontCache: { regular?: Uint8Array; bold?: Uint8Array } = {};

  constructor(options: PdfGeneratorOptions = {}) {
    this.options = {
      fontSize: options.fontSize || 11,
      margin: options.margin || 50,
      lineHeight: options.lineHeight || 1.5,
      maxLineLength: options.maxLineLength || 100,
    };
  }

  private async loadFonts(): Promise<void> {
    console.log('PDF: 加载字体');
    try {
      // 使用静态缓存避免重复读取字体文件
      if (!PdfGenerator.fontCache.regular || !PdfGenerator.fontCache.bold) {
        const fontPath = join(process.cwd(), 'node_modules', '@fontsource', 'noto-sans-sc', 'files', 'noto-sans-sc-chinese-simplified-400-normal.woff');
        const fontBoldPath = join(process.cwd(), 'node_modules', '@fontsource', 'noto-sans-sc', 'files', 'noto-sans-sc-chinese-simplified-700-normal.woff');
        
        [PdfGenerator.fontCache.regular, PdfGenerator.fontCache.bold] = await Promise.all([
          readFileSync(fontPath),
          readFileSync(fontBoldPath)
        ]);
      }

      [this.regularFont, this.boldFont] = await Promise.all([
        this.pdfDoc.embedFont(PdfGenerator.fontCache.regular!),
        this.pdfDoc.embedFont(PdfGenerator.fontCache.bold!)
      ]);
      
      console.log('PDF: 字体加载完成');
    } catch (error) {
      console.error('PDF: 加载字体失败:', error);
      throw error;
    }
  }

  private getTextWidth(text: string, fontSize: number): number {
    const cacheKey = `${text}_${fontSize}`;
    if (this.fontWidthCache.has(cacheKey)) {
      return this.fontWidthCache.get(cacheKey)!;
    }
    const width = this.regularFont.widthOfTextAtSize(text, fontSize);
    this.fontWidthCache.set(cacheKey, width);
    return width;
  }

  private wrapText(text: string, maxWidth: number): string[] {
    if (!text) return [];
    
    const lines: string[] = [];
    const paragraphs = text.split('\n');
    const spaceWidth = this.getTextWidth(' ', this.options.fontSize);

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        lines.push('');
        continue;
      }

      // 优化：预先计算每个字符的宽度
      const chars = Array.from(paragraph);
      const charWidths = new Float64Array(chars.length);
      for (let i = 0; i < chars.length; i++) {
        charWidths[i] = this.getTextWidth(chars[i], this.options.fontSize);
      }

      let currentLine = '';
      let currentWidth = 0;
      let start = 0;

      for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const charWidth = charWidths[i];
        
        if (currentWidth + charWidth > maxWidth) {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = '';
            currentWidth = 0;
            i = start - 1; // 回退一个字符重新开始
          } else {
            // 单个字符就超过最大宽度，强制换行
            lines.push(char);
            start = i + 1;
          }
        } else {
          currentLine += char;
          currentWidth += charWidth;
          if (char === ' ') start = i + 1;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines;
  }

  async generateFromParsedMail(parsedMail: ParsedMail): Promise<Uint8Array> {
    console.log('PDF: 开始生成 PDF');
    const startTime = Date.now();
    const pageSize = { width: 595, height: 842 }; // A4尺寸

    try {
      // 初始化文档
      this.pdfDoc = await PDFDocument.create();
      this.pdfDoc.registerFontkit(fontkit);
      await this.loadFonts();

      // 并行处理文本和图片
      const [textPages, images] = await Promise.all([
        this.processText(parsedMail, pageSize),
        this.processImages(parsedMail)
      ]);

      // 合并所有页面
      const allPages = [
        ...await this.createHeaderPage(parsedMail, pageSize),
        ...textPages
      ];

      // 添加图片页面
      if (images.length > 0) {
        allPages.push(...await this.createImagePages(images, pageSize));
      }

      // 添加附件信息页
      if (parsedMail.attachments.length > 0) {
        allPages.push(...await this.createAttachmentPages(parsedMail.attachments, pageSize));
      }

      // 保存PDF
      console.log('PDF: 开始保存，总页数:', allPages.length);
      const pdfBytes = await this.pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false
      });

      const endTime = Date.now();
      console.log('PDF: 文档生成完成', {
        size: `${(pdfBytes.length / 1024).toFixed(2)}KB`,
        pages: allPages.length,
        time: `${endTime - startTime}ms`
      });

      return pdfBytes;
    } catch (error) {
      console.error('PDF: 生成过程中出错:', error);
      throw error;
    }
  }

  private async processText(parsedMail: ParsedMail, pageSize: { width: number; height: number }): Promise<PDFPage[]> {
    const pages: PDFPage[] = [];
    const textContent = parsedMail.text || '';
    
    // 预处理文本
    const paragraphs = textContent.split('\n\n')
      .filter(p => p.trim())
      .map(p => p.replace(/\r\n/g, '\n'));

    let currentPage = this.pdfDoc.addPage([pageSize.width, pageSize.height]);
    pages.push(currentPage);
    let yPos = pageSize.height - this.options.margin;

    // 添加标题
    currentPage.drawText('邮件内容 / Email Content', {
      x: this.options.margin,
      y: yPos,
      size: 16,
      font: this.boldFont,
      color: rgb(0, 0, 0),
    });
    yPos -= this.options.fontSize * 2;

    // 使用批处理来处理段落
    const BATCH_SIZE = 10;
    for (let i = 0; i < paragraphs.length; i += BATCH_SIZE) {
      const batch = paragraphs.slice(i, Math.min(i + BATCH_SIZE, paragraphs.length));
      
      for (const paragraph of batch) {
        const lines = this.wrapText(paragraph, pageSize.width - this.options.margin * 2);
        
        for (const line of lines) {
          if (yPos < this.options.margin + this.options.fontSize) {
            currentPage = this.pdfDoc.addPage([pageSize.width, pageSize.height]);
            pages.push(currentPage);
            yPos = pageSize.height - this.options.margin;
          }

          if (line.trim()) {
            currentPage.drawText(line.trim(), {
              x: this.options.margin,
              y: yPos,
              size: this.options.fontSize,
              font: this.regularFont,
              color: rgb(0, 0, 0),
            });
          }
          yPos -= this.options.fontSize * this.options.lineHeight;
        }
        yPos -= this.options.fontSize * this.options.lineHeight;
      }
    }

    return pages;
  }

  private async processImages(parsedMail: ParsedMail): Promise<PDFImage[]> {
    if (!parsedMail.attachments?.length) return [];

    const imageAttachments = parsedMail.attachments.filter(
      att => att.contentType?.startsWith('image/') && att.content
    );

    if (!imageAttachments.length) return [];

    console.log(`PDF: 处理 ${imageAttachments.length} 个图片`);
    
    const imagePromises = imageAttachments.map(async (attachment) => {
      try {
        if (!attachment.content) return null;
        return attachment.contentType?.includes('jpeg') || attachment.contentType?.includes('jpg')
          ? await this.pdfDoc.embedJpg(attachment.content)
          : await this.pdfDoc.embedPng(attachment.content);
      } catch (error) {
        console.warn('PDF: 处理图片失败:', error);
        return null;
      }
    });

    const images = (await Promise.all(imagePromises)).filter(Boolean) as PDFImage[];
    console.log(`PDF: 成功处理 ${images.length} 个图片`);
    return images;
  }

  private async createImagePages(images: PDFImage[], pageSize: { width: number; height: number }): Promise<PDFPage[]> {
    const pages: PDFPage[] = [];
    
    for (const image of images) {
      const page = this.pdfDoc.addPage([pageSize.width, pageSize.height]);
      pages.push(page);

      const maxWidth = pageSize.width - this.options.margin * 2;
      const maxHeight = pageSize.height - this.options.margin * 2;
      
      const scale = Math.min(
        maxWidth / image.width,
        maxHeight / image.height,
        1
      );

      const width = image.width * scale;
      const height = image.height * scale;

      const x = (pageSize.width - width) / 2;
      const y = (pageSize.height - height) / 2;

      page.drawImage(image, {
        x,
        y,
        width,
        height
      });
    }

    return pages;
  }

  private async createHeaderPage(parsedMail: ParsedMail, pageSize: { width: number; height: number }): Promise<PDFPage[]> {
    const page = this.pdfDoc.addPage([pageSize.width, pageSize.height]);
    const drawer = this.createTextDrawer(page);
    
    // 添加标题和基本信息
    drawer.drawBoldText('邮件信息 / Email Information');
    drawer.moveDown(2);

    const fields = [
      ['主题 / Subject:', parsedMail.subject || ''],
      ['发件人 / From:', parsedMail.from?.text || ''],
      ['收件人 / To:', Array.isArray(parsedMail.to) ? parsedMail.to.map(addr => addr.text).join(', ') : ''],
      ['日期 / Date:', parsedMail.date ? parsedMail.date.toLocaleString() : '']
    ];

    for (const [label, value] of fields) {
      drawer.drawBoldText(label);
      drawer.drawRegularText(value, this.options.margin + 100);
      drawer.moveDown(2);
    }

    return [page];
  }

  private async createAttachmentPages(attachments: ParsedMail['attachments'], pageSize: { width: number; height: number }): Promise<PDFPage[]> {
    const pages: PDFPage[] = [];
    const page = this.pdfDoc.addPage([pageSize.width, pageSize.height]);
    pages.push(page);
    
    const drawer = this.createTextDrawer(page);
    drawer.drawBoldText('附件列表 / Attachments List:');
    drawer.moveDown(2);

    for (const attachment of attachments) {
      if (drawer.needsNewPage()) {
        const newPage = this.pdfDoc.addPage([pageSize.width, pageSize.height]);
        pages.push(newPage);
        drawer.resetPage(newPage);
      }

      drawer.drawBoldText(`文件名: ${attachment.filename || '未知'}`);
      drawer.moveDown();
      drawer.drawRegularText(`类型: ${attachment.contentType}`, this.options.margin + 20);
      drawer.moveDown();
      drawer.drawRegularText(`大小: ${this.formatFileSize(attachment.size || 0)}`, this.options.margin + 20);
      drawer.moveDown(2);
    }

    return pages;
  }

  private createTextDrawer(page: PDFPage) {
    const { fontSize, margin, lineHeight } = this.options;
    let yPos = page.getSize().height - margin;
    const actualLineHeight = fontSize * lineHeight;

    return {
      drawBoldText: (text: string, x: number = margin) => {
        try {
          page.drawText(text, {
            x,
            y: yPos,
            size: fontSize,
            font: this.boldFont,
            color: rgb(0, 0, 0),
          });
        } catch (error) {
          console.error('PDF: 绘制粗体文本失败:', { text, error });
        }
      },

      drawRegularText: (text: string, x: number = margin) => {
        try {
          page.drawText(text, {
            x,
            y: yPos,
            size: fontSize,
            font: this.regularFont,
            color: rgb(0, 0, 0),
          });
        } catch (error) {
          console.error('PDF: 绘制常规文本失败:', { text, error });
        }
      },

      moveDown: (lines: number = 1) => {
        yPos -= actualLineHeight * lines;
      },

      getCurrentY: () => yPos,

      needsNewPage: () => yPos < margin,

      resetPage: (newPage: PDFPage) => {
        page = newPage;
        yPos = page.getSize().height - margin;
      }
    };
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
} 