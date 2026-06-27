import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = "/Users/sunny.mantri/Downloads/cricket-auction 4";
const outputDir = path.join(root, "output", "tax-2025");
const workbook = Workbook.create();

const summary = workbook.worksheets.add("Summary");
const rental = workbook.worksheets.add("Rental Property");
const cgt = workbook.worksheets.add("CGT Sale");
const personal = workbook.worksheets.add("Personal & Work");
const missing = workbook.worksheets.add("Missing Info");
const refs = workbook.worksheets.add("References");

function styleTitle(range) {
  range.format.fill = { color: "#1F4E78" };
  range.format.font = { color: "#FFFFFF", bold: true, size: 14, name: "Aptos" };
  range.format.horizontalAlignment = "Center";
  range.format.verticalAlignment = "Center";
}

function styleHeader(range, fill = "#D9EAF7") {
  range.format.fill = { color: fill };
  range.format.font = { bold: true, name: "Aptos" };
  range.format.horizontalAlignment = "Center";
  range.format.verticalAlignment = "Center";
  range.format.wrapText = true;
  range.format.borders = { preset: "all", style: "thin", color: "#A6A6A6" };
}

function styleBody(range) {
  range.format.font = { name: "Aptos", size: 11 };
  range.format.verticalAlignment = "Top";
  range.format.wrapText = true;
  range.format.borders = { preset: "all", style: "thin", color: "#D9D9D9" };
}

function styleCurrency(range) {
  range.setNumberFormat('"$"#,##0.00');
}

function stylePercent(range) {
  range.setNumberFormat("0.0%");
}

function setColumnWidths(sheet, widths) {
  widths.forEach((width, idx) => {
    sheet.getRangeByIndexes(0, idx, 1, 1).format.columnWidth = width;
  });
}

function addTable(sheet, startCell, headers, rows, opts = {}) {
  const startCol = sheet.getRange(startCell).columnIndex;
  const startRow = sheet.getRange(startCell).rowIndex;
  const endCol = startCol + headers.length - 1;
  const endRow = startRow + rows.length;
  const headerRange = sheet.getRangeByIndexes(startRow, startCol, 1, headers.length);
  const bodyRange = sheet.getRangeByIndexes(startRow + 1, startCol, rows.length, headers.length);
  const fullRange = sheet.getRangeByIndexes(startRow, startCol, rows.length + 1, headers.length);
  headerRange.values = [headers];
  bodyRange.values = rows;
  styleHeader(headerRange, opts.headerFill || "#D9EAF7");
  styleBody(bodyRange);
  if (opts.currencyCols?.length) {
    for (const col of opts.currencyCols) {
      styleCurrency(sheet.getRangeByIndexes(startRow + 1, startCol + col, rows.length, 1));
    }
  }
  if (opts.percentCols?.length) {
    for (const col of opts.percentCols) {
      stylePercent(sheet.getRangeByIndexes(startRow + 1, startCol + col, rows.length, 1));
    }
  }
  if (opts.centerCols?.length) {
    for (const col of opts.centerCols) {
      sheet.getRangeByIndexes(startRow + 1, startCol + col, rows.length, 1).format.horizontalAlignment = "Center";
    }
  }
  fullRange.format.rowHeight = 22;
  return { startRow, startCol, endRow, endCol };
}

summary.showGridLines = false;
rental.showGridLines = false;
cgt.showGridLines = false;
personal.showGridLines = false;
missing.showGridLines = false;
refs.showGridLines = false;

summary.getRange("A1:H1").merge();
summary.getRange("A1").values = [[
  "Tax 2024–25 Working Paper – Sunny Mantri & Apoorva Patwa"
]];
styleTitle(summary.getRange("A1:H1"));
summary.getRange("A3:H3").merge();
summary.getRange("A3").values = [[
  "Property: 1/56-60 Ingleburn Road, Ingleburn NSW 2565 | Ownership split assumed 50/50 | Period: 1 Jul 2024 to 30 Jun 2025"
]];
summary.getRange("A3").format.fill = { color: "#EAF2F8" };
summary.getRange("A3").format.font = { bold: true, name: "Aptos" };
summary.getRange("A3").format.wrapText = true;

addTable(
  summary,
  "A6",
  ["Area", "Status", "Total AUD", "Your Share", "Apoorva Share", "Primary Source / Note"],
  [
    ["Rental income", "Confirmed", 22885.16, 11442.58, 11442.58, "Raine & Horne FY statement"],
    ["Confirmed rental deductions (before interest/insurance/cleaning)", "Partial", 5109.55, 2554.78, 2554.78, "Strata, council, water, management fees"],
    ["Depreciation schedule found", "Confirmed", 1362.00, 681.00, 681.00, "Duo Tax Div 43 full-year schedule"],
    ["Estimated apportioned depreciation to 20 May 2025", "Estimate", 1209.01, 604.50, 604.50, "Needs accountant confirmation"],
    ["CGT selling costs confirmed", "Confirmed", 15161.32, 7580.66, 7580.66, "Commission, legal, PEXA, advertising"],
    ["Loan interest", "Missing", null, null, null, "Need bank/lender annual interest statement"],
    ["Private health statement", "Missing", null, null, null, "Need annual PHI statement or MyGov prefill"],
    ["PAYG statements", "Missing", null, null, null, "User to provide"],
  ],
  { currencyCols: [2, 3, 4], centerCols: [1] }
);

summary.getRange("A17:H18").merge();
summary.getRange("A17").values = [[
  "Use the 'Rental Property' and 'CGT Sale' tabs for likely tax return figures. Use 'Personal & Work' for insurance and work expense candidates. Use 'Missing Info' to close remaining gaps."
]];
summary.getRange("A17").format.wrapText = true;
summary.getRange("A17").format.fill = { color: "#FFF2CC" };
summary.getRange("A17").format.font = { name: "Aptos", italic: true };
setColumnWidths(summary, [26, 14, 14, 14, 14, 24, 14, 14]);
summary.getRange("A1:H1").format.rowHeight = 28;
summary.getRange("A3:H3").format.rowHeight = 34;

addTable(
  rental,
  "A1",
  ["Category", "Item", "Total AUD", "Your 50%", "Apoorva 50%", "Likely treatment", "Evidence link", "Status", "Missing / note"],
  [
    ["Rental income", "Rent received", 22885.16, 11442.58, 11442.58, "Rental income", "https://mail.google.com/mail/#all/197c426a7e6f83e3", "Confirmed", "Good to use"],
    ["Rental deduction", "Property management fees", 1006.84, 503.42, 503.42, "Deductible rental expense", "https://mail.google.com/mail/#all/197c426a7e6f83e3", "Confirmed", "Good to use"],
    ["Rental deduction", "Strata fees", 3281.81, 1640.91, 1640.91, "Deductible rental expense", "https://mail.google.com/mail/#all/195b040fad2a1a47", "Partial", "Conservative total; Aug 2024 notice missing"],
    ["Rental deduction", "Council rates", 385.18, 192.59, 192.59, "Deductible rental expense", "https://mail.google.com/mail/#all/195b16269bd9e2b9", "Partial", "Only one notice found"],
    ["Rental deduction", "Water charges", 435.72, 217.86, 217.86, "Deductible rental expense", "https://mail.google.com/mail/#all/195fdeb8c69b97bc", "Partial", "Three bills found, not clearly all four quarters"],
    ["Rental deduction", "Loan interest", null, null, null, "Usually deductible if investment loan", "", "Missing", "Need bank/lender annual interest statement"],
    ["Rental deduction", "Landlord insurance", 520.00, 260.00, 260.00, "Likely deductible rental expense", "https://mail.google.com/mail/#all/195ab564966aec66", "Review", "Need payment proof"],
    ["Rental deduction", "Cleaning", 750.00, 375.00, 375.00, "Possible rental or sale-related cost", "", "Missing support", "Need receipt"],
    ["Rental deduction", "Bunnings repair item", 117.08, 58.54, 58.54, "Maybe deductible if for rental repair", "https://mail.google.com/mail/#all/192eb180e85209db", "Low confidence", "Address shows 3 Livingstone Ave"],
    ["Depreciation", "Duo Tax report fee", 595.00, 297.50, 297.50, "Supporting evidence / tax affairs context", "file:///Users/sunny.mantri/Documents/Personal/DT-Receipt%20238117.pdf", "Confirmed", "Not the depreciation claim itself"],
    ["Depreciation", "Division 43 capital works full-year", 1362.00, 681.00, 681.00, "Rental depreciation / capital works", "file:///Users/sunny.mantri/Documents/Personal/DT-Report%20238117.pdf", "Confirmed", "Full-year schedule amount"],
    ["Depreciation", "Estimated Div 43 to 20 May 2025", 1209.01, 604.50, 604.50, "Likely apportioned 2024-25 claim", "file:///Users/sunny.mantri/Documents/Personal/DT-Report%20238117.pdf", "Estimate", "Needs accountant confirmation"],
  ],
  { currencyCols: [2, 3, 4] }
);
rental.freezePanes.freezeRows(1);
setColumnWidths(rental, [18, 24, 12, 12, 12, 22, 34, 14, 30]);

addTable(
  cgt,
  "A1",
  ["Category", "Item", "Total AUD", "Your 50%", "Apoorva 50%", "Likely treatment", "Evidence link", "Status", "Missing / note"],
  [
    ["CGT", "Sale proceeds", 640000.00, 320000.00, 320000.00, "Capital proceeds", "https://mail.google.com/mail/#all/19efcbccf2e20b4b", "Confirmed", "Good to use"],
    ["CGT", "Marketing / advertising", 2000.00, 1000.00, 1000.00, "Selling cost for CGT", "https://mail.google.com/mail/#all/19efcbccf2e20b4b", "Confirmed", "Good to use"],
    ["CGT", "Agent commission", 10560.00, 5280.00, 5280.00, "Selling cost for CGT", "https://mail.google.com/mail/#all/19efcbccf2e20b4b", "Confirmed", "Good to use"],
    ["CGT", "Solicitor / conveyancing", 2463.93, 1231.97, 1231.97, "Selling cost for CGT", "https://mail.google.com/mail/#all/196d784263955094", "Confirmed", "Good to use"],
    ["CGT", "PEXA / settlement fee", 137.39, 68.70, 68.70, "Selling cost for CGT", "https://mail.google.com/mail/#all/196d784263955094", "Confirmed", "Good to use"],
    ["CGT", "Original purchase contract", null, null, null, "Needed for cost base", "", "Missing", "Need original settlement / purchase docs"],
    ["CGT", "Purchase stamp duty", null, null, null, "Needed for cost base", "", "Missing", "Need purchase docs"],
    ["CGT", "Purchase legal fees", null, null, null, "Needed for cost base", "", "Missing", "Need purchase docs"],
    ["CGT", "Capital improvements after purchase", null, null, null, "May affect cost base", "", "Missing", "Need invoices / works history"],
  ],
  { currencyCols: [2, 3, 4] }
);
cgt.freezePanes.freezeRows(1);
setColumnWidths(cgt, [14, 24, 12, 12, 12, 22, 34, 14, 30]);

addTable(
  personal,
  "A1",
  ["Category", "Item", "Amount AUD", "Likely treatment", "Evidence link", "Status", "Missing / note"],
  [
    ["Private health", "Annual PHI details", null, "PHI reporting item, not normal deduction", "https://www.ato.gov.au/forms-and-instructions/individual-tax-return-2025-instructions/medicare-levy-questions-m1-m2-individual-tax-return-2025/private-health-insurance-policy-details-2025", "Missing statement", "Need annual PHI statement or MyGov prefill"],
    ["Private health", "GU Health membership / emails", null, "Supports membership context only", "https://mail.google.com/mail/#all/1973e5cf56c8f34d", "Partial", "No annual tax statement found yet"],
    ["Life insurance", "TAL policy 7152950", null, "Claim depends on policy type", "https://mail.google.com/mail/#all/1953abe13d5e0e48", "Policy found", "Need policy schedule + payment evidence"],
    ["Life insurance", "TAL premium payments", null, "May or may not be deductible", "https://mail.google.com/mail/#all/1953abe13d5e0e48", "Missing payment evidence", "Need bank statements / annual premium statement"],
    ["Work expense", "Officeworks invoice 620847018", 5.00, "Candidate work-related expense", "https://mail.google.com/mail/#all/195d72dfc4cf1d57", "Candidate", "Need item detail / confirm work use"],
    ["Work expense", "Amazon Bluetooth mouse", 19.98, "Good candidate work-related expense", "https://mail.google.com/mail/#all/19582ad03d2738ea", "Candidate", "Claim work-use portion if mixed use"],
    ["Work expense", "Sony earbuds", 129.00, "Candidate only if genuinely used for work", "https://mail.google.com/mail/#all/19582ad03d2738ea", "Review", "Need work-use confirmation"],
    ["Work expense", "Earbud case", 9.89, "Candidate only if earbuds are work-related", "https://mail.google.com/mail/#all/19582ad03d2738ea", "Review", "Low priority"],
    ["Rules", "ATO deduction rules", null, "Must relate to earning employment income and be supported by records", "https://www.ato.gov.au/forms-and-instructions/individual-tax-return-2025-instructions/supporting-information-individual-tax-return-2025/claiming-deductions-2025", "Confirmed source", "Reimbursed expenses cannot be claimed"],
  ],
  { currencyCols: [2] }
);
personal.freezePanes.freezeRows(1);
setColumnWidths(personal, [14, 24, 12, 25, 36, 16, 30]);

addTable(
  missing,
  "A1",
  ["Priority", "Missing item", "Why needed", "Best source"],
  [
    ["High", "Bank statements for 1 Jul 2024 to 30 Jun 2025", "Find TAL premiums, private health payments, loan interest, and other spending", "Bank PDF / CSV statements"],
    ["High", "PAYG income statements", "Complete income side of return", "MyGov / employer"],
    ["High", "Investment loan interest statement", "Major rental deduction", "Lender annual statement"],
    ["High", "Original purchase contract + settlement", "Needed to finish CGT cost base", "Conveyancer / old email"],
    ["High", "Purchase stamp duty + purchase legal fees", "Needed for CGT cost base", "Settlement docs"],
    ["Medium", "Private health annual statement", "Needed for PHI section", "Insurer annual statement / MyGov prefill"],
    ["Medium", "Full-year council notices", "Complete rental deduction", "Council notices / bank statements"],
    ["Medium", "Missing water quarter if any", "Complete rental deduction", "Sydney Water / bank statements"],
    ["Medium", "Landlord insurance payment proof", "Support rental deduction", "Bank statements"],
    ["Medium", "Cleaning receipt for $750", "Support claim", "Invoice / bank transaction"],
    ["Medium", "Any other Bunnings / repair invoices for the rental", "Support repairs claim", "Receipts / bank statements"],
    ["Medium", "Prior year tax return / rental schedule", "Helps reconcile depreciation already claimed", "Accountant PDFs"],
  ],
  { centerCols: [0] }
);
missing.freezePanes.freezeRows(1);
setColumnWidths(missing, [10, 30, 34, 24]);

addTable(
  refs,
  "A1",
  ["Reference type", "Description", "Link / path"],
  [
    ["ATO", "21 Rent 2025", "https://www.ato.gov.au/forms-and-instructions/individual-supplementary-tax-return-2025-instructions/income-questions-13-24-supplementary-tax-return-2025/21-rent-2025"],
    ["ATO", "18 Capital gains 2025", "https://www.ato.gov.au/forms-and-instructions/individual-supplementary-tax-return-2025-instructions/income-questions-13-24-supplementary-tax-return-2025/18-capital-gains-2025"],
    ["ATO", "Rental properties guide 2025", "https://www.ato.gov.au/forms-and-instructions/rental-properties-2025"],
    ["ATO", "Private health insurance policy details 2025", "https://www.ato.gov.au/forms-and-instructions/individual-tax-return-2025-instructions/medicare-levy-questions-m1-m2-individual-tax-return-2025/private-health-insurance-policy-details-2025"],
    ["ATO", "Claiming deductions 2025", "https://www.ato.gov.au/forms-and-instructions/individual-tax-return-2025-instructions/supporting-information-individual-tax-return-2025/claiming-deductions-2025"],
    ["ATO", "CGT when selling your rental property", "https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/property-and-capital-gains-tax/cgt-when-selling-your-rental-property"],
    ["Local file", "Duo Tax report", "file:///Users/sunny.mantri/Documents/Personal/DT-Report%20238117.pdf"],
    ["Local file", "Duo Tax receipt", "file:///Users/sunny.mantri/Documents/Personal/DT-Receipt%20238117.pdf"],
  ],
  {}
);
refs.freezePanes.freezeRows(1);
setColumnWidths(refs, [14, 30, 80]);

for (const sheet of [summary, rental, cgt, personal, missing, refs]) {
  const used = sheet.getUsedRange();
  used.format.autofitRows();
}

summary.getRange("C8:E15").setNumberFormat('"$"#,##0.00');

await fs.mkdir(outputDir, { recursive: true });
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
const outputPath = path.join(outputDir, "tax_2025_working_paper.xlsx");
await xlsx.save(outputPath);

const inspectSummary = await workbook.inspect({
  kind: "table",
  sheetId: "Summary",
  range: "A6:F14",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 10,
  maxChars: 4000,
});
console.log(inspectSummary.ndjson);

const inspectErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
  maxChars: 2000,
});
console.log(inspectErrors.ndjson);

const preview = await workbook.render({ sheetName: "Summary", range: "A1:H18", scale: 2, format: "png", autoCrop: "all" });
const previewBytes = new Uint8Array(await preview.arrayBuffer());
await fs.writeFile(path.join(outputDir, "tax_2025_summary_preview.png"), previewBytes);

console.log(outputPath);
