import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import html2canvas from 'html2canvas';
import { ParsedEmail, EmailAttachment } from './eml-parser';

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