import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function debugPdf() {
  const filePath = 'c:\\Users\\SAMY-LAP\\Desktop\\ACIS Version 5.0\\tenant-app\\public\\ocrScanSample\\RPM UAQ.pdf';
  const data = new Uint8Array(fs.readFileSync(filePath));
  
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  
  // Group by Y
  const rowsMap = new Map();
  for (const item of textContent.items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.transform[5]);
    if (!rowsMap.has(y)) rowsMap.set(y, []);
    rowsMap.get(y).push(item);
  }

  const sortedY = Array.from(rowsMap.keys()).sort((a, b) => b - a);
  
  console.log("--- PDF PAGE 1 Y-COORDINATE DUMP ---");
  for (const y of sortedY) {
    const items = rowsMap.get(y).sort((a, b) => a.transform[4] - b.transform[4]);
    const lineStr = items.map(i => `[X:${Math.round(i.transform[4])}] ${i.str}`).join(' | ');
    console.log(`Y: ${y} => ${lineStr}`);
  }
}

debugPdf().catch(console.error);

