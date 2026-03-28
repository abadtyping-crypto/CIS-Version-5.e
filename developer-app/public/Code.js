const SPREADSHEET_ID = '1vske6ojUEk7RGC6MHjjl4i5CFV8npGgvYC2BLSPUb-0'; 
const FOLDER_IDS = ["1aMxxVT3RJXAfCLaHrwXtF8q12QCz786i"];
const SHEET_NAME = "drive";

function doGet(e) {
  // Make sure 'Index' matches the name of your HTML file on the left sidebar
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('ACIS File Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function syncDriveToSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  
  const data = sheet.getDataRange().getValues();
  const existingIds = data.map(row => row[2]);

  if (data.length === 1 && data[0][0] === "") {
    sheet.appendRow(["Name", "Type", "ID", "ParentName", "DownloadUrl", "ViewUrl"]);
  }

  let newEntries = [];
  FOLDER_IDS.forEach(id => {
    try {
      let folder = DriveApp.getFolderById(id.trim());
      if (folder) processSmartFolder(folder, folder.getName(), existingIds, newEntries);
    } catch(e) { console.log("Skipping " + id); }
  });

  if (newEntries.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newEntries.length, 6).setValues(newEntries);
    return "Added " + newEntries.length + " new files.";
  }
  return "Everything is up to date!";
}

function processSmartFolder(folder, parentName, existingIds, newEntries) {
  if (!folder) return;
  try {
    const subs = folder.getFolders();
    while (subs.hasNext()) {
      let sub = subs.next();
      if (sub) processSmartFolder(sub, sub.getName(), existingIds, newEntries);
    }
    const files = folder.getFiles();
    while (files.hasNext()) {
      let file = files.next();
      if (file && !existingIds.includes(file.getId())) {
        newEntries.push([file.getName(), "File", file.getId(), parentName, 
                         "https://drive.google.com/uc?export=download&id=" + file.getId(), file.getUrl()]);
      }
    }
  } catch (err) { }
}

function getSheetData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  return sheet ? sheet.getDataRange().getValues() : [];
}