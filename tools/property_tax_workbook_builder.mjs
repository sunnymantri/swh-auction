import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const cwd = process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(cwd, "outputs", `property-tax-fy2024-2025-${timestamp}`);
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();

const summary = workbook.worksheets.add("Summary");
const rental = workbook.worksheets.add("Rental Detail");
const sale = workbook.worksheets.add("Sale & CGT");
const review = workbook.worksheets.add("Needs Review");
const refs = workbook.worksheets.add("References");

for (const sheet of [summary, rental, sale, review, refs]) {
  sheet.showGridLines = false;
}

const ownerSplitCell = "B8";
const ownerSplitRef = "'Summary'!$B$8";

summary.getRange("A1:H1").merge();
summary.getRange("A1").values = [["Property Tax Workpaper – FY 2024–25"]];
summary.getRange("A1:H1").format = {
  fill: "#1F4E78",
  font: { bold: true, color: "#FFFFFF", size: 14 },
  horizontalAlignment: "Center",
  verticalAlignment: "Center",
};
summary.getRange("A1:H1").format.rowHeightPx = 28;

summary.getRange("A3:B8").values = [
  ["Property", "1/56-60 Ingleburn Road, Ingleburn NSW"],
  ["Tax year", "1 Jul 2024 to 30 Jun 2025"],
  ["Contract date", new Date("2025-04-08T00:00:00")],
  ["Settlement date", new Date("2025-05-20T00:00:00")],
  ["Sale price", 640000],
  ["Ownership split", 0.5],
];
summary.getRange("A3:A8").format = {
  fill: "#D9EAF7",
  font: { bold: true, color: "#0F172A" },
};
summary.getRange("B7").format.numberFormat = "$#,##0.00";
summary.getRange("B5:B6").format.numberFormat = "yyyy-mm-dd";
summary.getRange(ownerSplitCell).format.numberFormat = "0.0%";

summary.getRange("D3:H3").merge();
summary.getRange("D3").values = [["Notes"]];
summary.getRange("D4:H8").merge();
summary.getRange("D4").values = [[
  "Assumption used: the property was co-owned 50/50 by Sunny Mantri and Apoorva Patwa. Confirm ownership percentages with your accountant if the legal title split was different. Sale-related commission/advertising/cleaning are not included in totals unless separately verified.",
]];
summary.getRange("D3:H3").format = {
  fill: "#D9EAD3",
  font: { bold: true, color: "#0F172A" },
};
summary.getRange("D4:H8").format = {
  fill: "#F6FBF2",
  wrapText: true,
  verticalAlignment: "Top",
};

summary.getRange("A10:D10").merge();
summary.getRange("A10").values = [["Confirmed rental summary"]];
summary.getRange("A10:D10").format = {
  fill: "#0F766E",
  font: { bold: true, color: "#FFFFFF" },
};
summary.getRange("A11:B15").values = [
  ["Confirmed rental income", null],
  ["Confirmed rental expenses", null],
  ["Indicative net rental amount", null],
  ["Sunny share (50%)", null],
  ["Apoorva share (50%)", null],
];
summary.getRange("A11:A15").format = {
  fill: "#E6F4F1",
  font: { bold: true },
};
summary.getRange("B11").formulas = [[`=SUMIFS('Rental Detail'!$G$2:$G$100,'Rental Detail'!$A$2:$A$100,"Yes",'Rental Detail'!$B$2:$B$100,"Income")`]];
summary.getRange("B12").formulas = [[`=SUMIFS('Rental Detail'!$G$2:$G$100,'Rental Detail'!$A$2:$A$100,"Yes",'Rental Detail'!$B$2:$B$100,"Expense")`]];
summary.getRange("B13").formulas = [[`=B11-B12`]];
summary.getRange("B14").formulas = [[`=B13*${ownerSplitRef}`]];
summary.getRange("B15").formulas = [[`=B13*${ownerSplitRef}`]];

summary.getRange("F10:H10").merge();
summary.getRange("F10").values = [["Confirmed sale / CGT costs"]];
summary.getRange("F10:H10").format = {
  fill: "#7C3AED",
  font: { bold: true, color: "#FFFFFF" },
};
summary.getRange("F11:G14").values = [
  ["Confirmed sale/CGT costs", null],
  ["Sunny share (50%)", null],
  ["Apoorva share (50%)", null],
  ["Unverified extras not counted", null],
];
summary.getRange("F11:F14").format = {
  fill: "#EFE8FF",
  font: { bold: true },
};
summary.getRange("G11").formulas = [[`=SUMIFS('Sale & CGT'!$E$2:$E$100,'Sale & CGT'!$A$2:$A$100,"Yes")`]];
summary.getRange("G12").formulas = [[`=G11*${ownerSplitRef}`]];
summary.getRange("G13").formulas = [[`=G11*${ownerSplitRef}`]];
summary.getRange("G14").formulas = [[`=SUMIFS('Needs Review'!$D$2:$D$100,'Needs Review'!$A$2:$A$100,"User reported",'Needs Review'!$E$2:$E$100,"Hold until evidence found")`]];

summary.getRange("A17:H17").merge();
summary.getRange("A17").values = [["Do not double count settlement adjustments against the underlying water/council/strata bills without reconciling them first."]];
summary.getRange("A17:H17").format = {
  fill: "#FFF4D6",
  font: { color: "#7A4F01", bold: true },
  wrapText: true,
};

summary.getRange("B11:B15").format.numberFormat = "$#,##0.00";
summary.getRange("G11:G14").format.numberFormat = "$#,##0.00";
summary.getRange("A10:H17").format.borders = { preset: "all", style: "thin", color: "#D9E2F3" };
summary.getRange("A3:H17").format.borders = { preset: "outside", style: "thin", color: "#C7D2FE" };

const rentalRows = [
  ["Yes", "Income", "Rent", "Raine & Horne FY activity statement total rental income", new Date("2025-07-01T00:00:00"), "FY 2024-25", 22885.16, "Annual rental statement PDF", "Email 197c426a7e6f83e3 / OWN01117 - Financial Summary 1 Jul 2025.pdf", "Anchor rental statement"],
  ["Yes", "Expense", "Agent fees", "Raine & Horne management / money out total", new Date("2025-07-01T00:00:00"), "FY 2024-25", 1006.84, "Annual rental statement PDF", "Email 197c426a7e6f83e3 / OWN01117 - Financial Summary 1 Jul 2025.pdf", "Use only if not separately duplicated elsewhere"],
  ["Yes", "Expense", "Council rates", "Council notice amount due", new Date("2025-01-14T00:00:00"), "Due 2025-02-28", 385.18, "Council Notice.pdf", "Email 195b16269bd9e2b9 / Council Notice.pdf", "Direct property holding cost"],
  ["Yes", "Expense", "Water rates", "Sydney Water bill", new Date("2024-10-04T00:00:00"), "Due 2024-10-24", 172.79, "Sydney Water eBill", "Email 19254dee3c0660ba", "Property listed as U 1/56 Ingleburn Rd"],
  ["Yes", "Expense", "Water rates", "Sydney Water bill", new Date("2025-01-06T00:00:00"), "Bill amount only", 169.03, "Sydney Water eBill", "Email 1943de34c25f78b9", "Used bill amount, not full running balance"],
  ["Yes", "Expense", "Water rates", "Sydney Water bill", new Date("2025-04-03T00:00:00"), "Due 2025-04-24", 170.90, "Sydney Water eBill", "Email 195fdeb8c69b97bc", "Matches settlement-sheet water figure, so avoid double count"],
  ["Yes", "Expense", "Strata levy", "Quarterly levy", new Date("2024-11-01T00:00:00"), "2024-11-01 to 2025-01-31", 1084.88, "Lot_1_FeeNotice202411.pdf", "Email 192bba11b0c71d36", "Used clean levy amount; excluded arrears/interest"],
  ["Yes", "Expense", "Strata levy", "Quarterly levy", new Date("2025-02-01T00:00:00"), "2025-02-01 to 2025-04-30", 1084.88, "Lot_1_FeeNotice202502.pdf", "Email 193bdc81bdc2a8bb", "Used clean levy amount"],
];

rental.getRange("A1:M1").values = [[
  "Included",
  "Type",
  "Category",
  "Description",
  "Document Date",
  "Period / Note",
  "Amount",
  "Source",
  "Evidence",
  "Tax treatment note",
  "Ownership %",
  "Sunny share",
  "Apoorva share",
]];
rental.getRange(`A2:J${rentalRows.length + 1}`).values = rentalRows;
rental.getRange(`K2:K${rentalRows.length + 1}`).formulas = Array.from({ length: rentalRows.length }, () => [`=${ownerSplitRef}`]);
rental.getRange("L2").formulas = [[`=IF($A2="Yes",$G2*$K2,0)`]];
rental.getRange(`L2:L${rentalRows.length + 1}`).fillDown();
rental.getRange("M2").formulas = [[`=IF($A2="Yes",$G2*$K2,0)`]];
rental.getRange(`M2:M${rentalRows.length + 1}`).fillDown();
rental.freezePanes.freezeRows(1);
rental.getRange("A1:M1").format = {
  fill: "#0F766E",
  font: { bold: true, color: "#FFFFFF" },
  wrapText: true,
};
rental.getRange(`G2:G${rentalRows.length + 1}`).format.numberFormat = "$#,##0.00";
rental.getRange(`E2:E${rentalRows.length + 1}`).format.numberFormat = "yyyy-mm-dd";
rental.getRange(`K2:K${rentalRows.length + 1}`).format.numberFormat = "0.0%";
rental.getRange(`L2:M${rentalRows.length + 1}`).format.numberFormat = "$#,##0.00";
rental.getRange(`A1:M${rentalRows.length + 1}`).format.borders = { preset: "all", style: "thin", color: "#D9E2F3" };
rental.getRange(`J2:J${rentalRows.length + 1}`).format.wrapText = true;

const saleRows = [
  ["Yes", "Solicitor / conveyancing", "ConveyAbility invoice #2150", new Date("2025-05-20T00:00:00"), 1585.82, "Settlement / invoice PDF", "Email 196d784263955094", "Likely CGT disposal / cost-base item", null, null],
  ["Yes", "Solicitor / conveyancing", "ConveyAbility invoice #2080", new Date("2025-05-20T00:00:00"), 878.11, "Settlement / invoice PDF", "Email 196d784263955094", "Likely CGT disposal / cost-base item", null, null],
  ["Yes", "PEXA fee", "PEXA electronic settlement fee", new Date("2025-05-20T00:00:00"), 137.39, "Settlement sheet", "Email 196d784263955094", "Likely disposal cost", null, null],
];

sale.getRange("A1:J1").values = [[
  "Included",
  "Category",
  "Description",
  "Date",
  "Amount",
  "Source",
  "Evidence",
  "Tax treatment note",
  "Sunny share",
  "Apoorva share",
]];
sale.getRange(`A2:H${saleRows.length + 1}`).values = saleRows.map((row) => row.slice(0, 8));
sale.getRange("I2").formulas = [[`=IF($A2="Yes",$E2*${ownerSplitRef},0)`]];
sale.getRange(`I2:I${saleRows.length + 1}`).fillDown();
sale.getRange("J2").formulas = [[`=IF($A2="Yes",$E2*${ownerSplitRef},0)`]];
sale.getRange(`J2:J${saleRows.length + 1}`).fillDown();
sale.freezePanes.freezeRows(1);
sale.getRange("A1:J1").format = {
  fill: "#7C3AED",
  font: { bold: true, color: "#FFFFFF" },
  wrapText: true,
};
sale.getRange(`E2:E${saleRows.length + 1}`).format.numberFormat = "$#,##0.00";
sale.getRange(`D2:D${saleRows.length + 1}`).format.numberFormat = "yyyy-mm-dd";
sale.getRange(`I2:J${saleRows.length + 1}`).format.numberFormat = "$#,##0.00";
sale.getRange(`A1:J${saleRows.length + 1}`).format.borders = { preset: "all", style: "thin", color: "#E9D5FF" };
sale.getRange(`H2:H${saleRows.length + 1}`).format.wrapText = true;

const reviewRows = [
  ["User reported", "Cleaning", "House cleaned before/around sale", 750, "Hold until evidence found", "Could be relevant sale or rental-related cost depending on timing/use", "User stated approx. $750; no email invoice found yet", "Find invoice, receipt, or bank transaction"],
  ["Not found", "Sales commission", "Raine & Horne selling commission", null, "Hold until exact amount found", "Likely CGT sale cost", "Expected from settlement documents or agency invoice", "Locate commission statement or settlement deduction"],
  ["Not found", "Sale advertising / open homes", "Advertising and open-home costs for sale campaign", null, "Hold until exact amount found", "Likely CGT sale cost", "User reported expense, but no exact amount surfaced in email", "Locate agency invoice or campaign statement"],
  ["Needs apportionment", "Strata levy", "May 2025 levy notice covering period to 31 Jul 2025", 1084.88, "Hold until settlement/apportionment reconciled", "Only pre-settlement portion may be relevant", "Email 195b040fad2a1a47 / Lot_1_FeeNotice202505.pdf", "Reconcile against settlement sheet and sale date 2025-05-20"],
  ["Double-count risk", "Settlement adjustment", "Council rates on settlement sheet", 775.84, "Do not add on top of direct bills without reconciliation", "Settlement adjustment only", "Email 196d784263955094 / Settlement Sheet & Invoices.pdf", "Check whether this replaces or adjusts direct council bill entries"],
  ["Double-count risk", "Settlement adjustment", "Sydney Water on settlement sheet", 170.90, "Do not add on top of direct bills without reconciliation", "Settlement adjustment only", "Email 196d784263955094 / Settlement Sheet & Invoices.pdf", "Matches separate Sydney Water bill already captured"],
  ["Double-count risk", "Settlement adjustment", "Strata levies on settlement sheet", 2190.83, "Do not add on top of direct bills without reconciliation", "Settlement adjustment only", "Email 196d784263955094 / Settlement Sheet & Invoices.pdf", "May overlap levy notices already captured"],
  ["Not found", "Land tax / land rates", "Land tax, land rates, or similar state charge", null, "No email evidence found", "Potential rental expense only if actually incurred", "No matching notice surfaced in email search", "Check council/Revenue NSW records or bank statements"],
];

review.getRange("A1:H1").values = [[
  "Status",
  "Category",
  "Description",
  "Amount",
  "Current handling",
  "Likely treatment",
  "Source note",
  "Next action",
]];
review.getRange(`A2:H${reviewRows.length + 1}`).values = reviewRows;
review.freezePanes.freezeRows(1);
review.getRange("A1:H1").format = {
  fill: "#B45309",
  font: { bold: true, color: "#FFFFFF" },
  wrapText: true,
};
review.getRange(`D2:D${reviewRows.length + 1}`).format.numberFormat = "$#,##0.00";
review.getRange(`A1:H${reviewRows.length + 1}`).format.borders = { preset: "all", style: "thin", color: "#FDE68A" };
review.getRange(`E2:H${reviewRows.length + 1}`).format.wrapText = true;

refs.getRange("A1:C1").values = [["Reference", "Purpose", "URL"]];
refs.getRange("A2:C4").values = [
  ["ATO rental expenses", "Rental deductions and apportionment", "https://www.ato.gov.au/individuals-and-families/investments-and-assets/property-and-land/residential-rental-properties/rental-expenses/how-to-claim-rental-expenses"],
  ["ATO CGT when selling your rental property", "Sale/CGT treatment", "https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/property-and-capital-gains-tax/cgt-when-selling-your-rental-property"],
  ["ATO cost base of asset", "What can go into cost base", "https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/calculating-your-cgt/cost-base-of-asset"],
];
refs.getRange("A1:C1").format = {
  fill: "#334155",
  font: { bold: true, color: "#FFFFFF" },
};
refs.getRange("A1:C4").format.borders = { preset: "all", style: "thin", color: "#CBD5E1" };
refs.getRange("C2:C4").format.wrapText = true;

for (const sheet of [summary, rental, sale, review, refs]) {
  const used = sheet.getUsedRange();
  used.format.autofitColumns();
  used.format.autofitRows();
}

summary.getRange("B2:B20").format.columnWidthPx = 140;
summary.getRange("D4:H8").format.columnWidthPx = 170;
summary.getRange("F:F").format.columnWidthPx = 230;
summary.getRange("G:G").format.columnWidthPx = 160;
rental.getRange("D:D").format.columnWidthPx = 300;
rental.getRange("F:F").format.columnWidthPx = 180;
rental.getRange("H:H").format.columnWidthPx = 170;
rental.getRange("I:I").format.columnWidthPx = 360;
rental.getRange("J:J").format.columnWidthPx = 280;
sale.getRange("B:B").format.columnWidthPx = 190;
sale.getRange("C:C").format.columnWidthPx = 240;
sale.getRange("F:F").format.columnWidthPx = 180;
sale.getRange("G:G").format.columnWidthPx = 220;
sale.getRange("H:H").format.columnWidthPx = 240;
review.getRange("C:C").format.columnWidthPx = 230;
review.getRange("E:E").format.columnWidthPx = 220;
review.getRange("F:F").format.columnWidthPx = 230;
review.getRange("G:G").format.columnWidthPx = 260;
review.getRange("H:H").format.columnWidthPx = 220;
refs.getRange("B:B").format.columnWidthPx = 180;
refs.getRange("C:C").format.columnWidthPx = 620;

summary.getRange("B14").formulas = [[`=B13*${ownerSplitRef}`]];
summary.getRange("B15").formulas = [[`=B13*${ownerSplitRef}`]];
summary.getRange("G12").formulas = [[`=G11*${ownerSplitRef}`]];
summary.getRange("G13").formulas = [[`=G11*${ownerSplitRef}`]];

for (const sheet of [summary, rental, sale, review, refs]) {
  sheet.getUsedRange().format.autofitRows();
}

const summaryInspect = await workbook.inspect({
  kind: "table",
  sheetId: "Summary",
  range: "A1:H17",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 8,
});
console.log(summaryInspect.ndjson);

const errorScan = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errorScan.ndjson);

for (const sheetName of ["Summary", "Rental Detail", "Sale & CGT", "Needs Review", "References"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(path.join(outputDir, `${sheetName.replace(/[^A-Za-z0-9]+/g, "_")}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
const outputPath = path.join(outputDir, "property_tax_workpaper_fy2024_2025_ingleburn.xlsx");
await xlsx.save(outputPath);
console.log(`OUTPUT_XLSX=${outputPath}`);
