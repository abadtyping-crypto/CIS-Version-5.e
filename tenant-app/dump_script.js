import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export const extractPdfText = async (fileBlob) => {
  const arrayBuffer = await fileBlob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const sortedItems = [...textContent.items].sort((a, b) => {
      if (Math.abs(a.transform[5] - b.transform[5]) < 5) {
        return a.transform[4] - b.transform[4];
      }
      return b.transform[5] - a.transform[5];
    });
    const pageText = sortedItems.map(item => item.str).join(' ');
    pageTexts.push(pageText);
  }
  return pageTexts.join('\n');
};

async function run() {
  const filePath = 'c:\\Users\\SAMY-LAP\\Desktop\\ACIS Version 5.0\\tenant-app\\public\\ocrScanSample\\RPM UAQ.pdf';
  const data = new Uint8Array(fs.readFileSync(filePath));
  const text = await extractPdfText({ arrayBuffer: async () => data });
  fs.writeFileSync('c:\\Users\\SAMY-LAP\\Desktop\\ACIS Version 5.0\\tenant-app\\pdf_dump.txt', text);
  console.log('Dumped to pdf_dump.txt');
}

run().catch(console.error);

