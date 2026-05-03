const PDFDocument = require('pdfkit');
const fs = require('fs');

const markdown = fs.readFileSync('./DOCUMENTACAO_COMPLETA.md', 'utf-8');
const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });

doc.pipe(fs.createWriteStream('./QUANTA_FLOW_DOCUMENTACAO.pdf'));

// Título
doc.fontSize(20).font('Helvetica-Bold').text('QUANTA FLOW', { align: 'center' });
doc.fontSize(11).text('Documentação Técnica Completa v5.0.0', { align: 'center' });
doc.fontSize(9).fillColor('#666').text('Plataforma Omnichannel de CRM, Automação de Vendas e IA', { align: 'center' });
doc.moveDown();
doc.fillColor('#000');

// Processar linhas
const lines = markdown.split('\n');
let inCode = false;

for (let i = 0; i < Math.min(lines.length, 500); i++) {
  const line = lines[i];
  
  if (!line.trim()) {
    doc.moveDown(0.2);
    continue;
  }
  
  if (line.startsWith('# ')) {
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#00A86B').text(line.substring(2));
    doc.moveDown(0.3);
    doc.fillColor('#000');
    continue;
  }
  
  if (line.startsWith('## ')) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1B3A57').text(line.substring(3));
    doc.moveDown(0.2);
    doc.fillColor('#000');
    continue;
  }
  
  if (line.startsWith('### ')) {
    doc.fontSize(11).font('Helvetica-Bold').text(line.substring(4));
    doc.moveDown(0.15);
    continue;
  }
  
  if (line.startsWith('- ')) {
    doc.fontSize(9).text('• ' + line.substring(2), { indent: 15 });
    continue;
  }
  
  if (line.startsWith('|') && line.includes('|')) {
    doc.fontSize(8).text(line);
    continue;
  }
  
  if (line.trim() && !line.startsWith('```')) {
    doc.fontSize(9).text(line.substring(0, 100), { width: 500 });
  }
}

doc.fontSize(8).fillColor('#999').text('Documento: Março 2026 | Produção v5.0.0', { align: 'center' });
doc.end();

console.log('✅ PDF gerado!');
