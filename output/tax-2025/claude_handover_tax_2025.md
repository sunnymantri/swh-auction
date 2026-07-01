# Handover Note for Claude – Australia Tax 2024–25 Review

Prepared for: Sunny Mantri  
Co-owner on property: Apoorva Patwa  
Property: 1/56-60 Ingleburn Road, Ingleburn NSW 2565  
Tax period: 1 Jul 2024 to 30 Jun 2025

## 1. Purpose of this handover

This handover is to help you review and improve an interactive tax working-paper and HTML calculator prepared for Sunny. The current deliverable is meant to help assemble:

- rental property income and deductions
- CGT sale costs and capital-improvement candidates
- personal/work expense candidates
- missing supporting documents
- a rough per-owner view for Sunny and Apoorva

The current build is a working draft, not a final accountant-grade tax return.

## 2. Main output files

Primary delivered files:

- `/Users/sunny.mantri/Documents/Personal Finances/Tax 2025/tax_2025_review.html`
- `/Users/sunny.mantri/Documents/Personal Finances/Tax 2025/tax_2025_working_paper.xlsx`

Generator/source file:

- `/Users/sunny.mantri/Downloads/cricket-auction 4/output/tax-2025/update_tax_2025_workbook.mjs`

Workspace copies:

- `/Users/sunny.mantri/Downloads/cricket-auction 4/output/tax-2025/tax_2025_review.html`
- `/Users/sunny.mantri/Downloads/cricket-auction 4/output/tax-2025/tax_2025_working_paper.xlsx`
- `/Users/sunny.mantri/Downloads/cricket-auction 4/output/tax-2025/tax_2025_working_paper.xlsx.inspect.ndjson`

This note:

- `/Users/sunny.mantri/Downloads/cricket-auction 4/output/tax-2025/claude_handover_tax_2025.md`

## 3. What has already been built

### 3.1 Interactive HTML review/calculator

The HTML includes:

- Summary tab
- Rental Property tab
- CGT Sale tab
- Personal & Work tab
- Missing Info tab
- References tab

It also includes:

- color-coded statuses
  - green = confirmed
  - yellow = candidate/review/partial/estimate
  - red = missing
  - gray = excluded
- include/exclude checkboxes for expense rows with amounts
- live summary recalculation
- statement-view selector:
  - Combined
  - Sunny
  - Apoorva

### 3.2 Workbook structure

The workbook currently rewrites/populates:

- `Summary`
- `Rental Property`
- `CGT Sale`
- `Personal & Work`
- `Missing Info`
- `References`

## 4. Current tax data captured

### 4.1 Income captured

Employment income captured from screenshot:

- SFDC AUSTRALIA PTY LIMITED: `$247,413.00`

Interest income captured from screenshot:

- ANZ: `$123.53`
- Bank of China: `$10.62`
- St George: `$251.29`
- ATO overpayment interest: `$0.93`
- Total: `$386.37`

### 4.2 Rental property captured

Rental income:

- Raine & Horne annual statement used as primary source
- Rental income currently captured: `$22,885.16`

Rental deductions currently in workbook:

- Property management fees: `$1,006.84`
- Strata fees: `$3,281.81`
- Council rates: `$385.18`
- Water charges: `$435.72`
- Landlord insurance: `$520.00`
- Cleaning: `$750.00`
- Bunnings repair item: `$117.08`
- Duo Tax report fee: `$595.00`
- Division 43 capital works full-year: `$1,362.00`
- Estimated Div 43 to 20 May 2025: `$1,209.01`

Still missing / incomplete:

- loan interest statement for Ingleburn property
- complete council notices
- all water notices if quarterly set incomplete
- payment proof for some deductions

### 4.3 CGT / property sale captured

Sale proceeds:

- `$640,000.00`

Selling costs captured:

- Advertising / marketing: `$2,000.00`
- Agent commission: `$10,560.00`
- Solicitor / conveyancing on sale: `$2,463.93`
- PEXA / settlement platform: `$137.39`

Capital-improvement / cost-base candidate rows captured:

- Kitchen quote SK0269: `$9,438.00`
- Kitchen quote SK0270 revised: `$10,288.00`
- Bathroom quote AJJ Tiling: `$16,500.00`
- General improvements estimate: `$9,400.00`

Missing cost-base items still listed:

- original purchase contract + settlement
- purchase stamp duty
- purchase legal fees
- transfer / registration fee

### 4.4 Personal / work candidates captured

Work/software items currently in workbook include:

- Officeworks invoice: `$5.00`
- Amazon Bluetooth mouse: `$19.98`
- Sony earbuds: `$129.00`
- Earbud case: `$9.89`
- Google One annual charge: `$124.99`
- Google One refund: `-$68.15`
- Surfshark: `$147.01`
- LinkedIn Premium receipts: `$274.94`
- Grammarly authorisation: `$225.35`
- OpenAI / ChatGPT subscription: `$422.88`

Insurance-related rows currently included as review candidates or missing evidence:

- TAL Life + TPD quoted monthly premium: `$127.44`
- TAL premium payments: amount missing, evidence missing
- Prior-year income protection note: `$872.28` but marked as not FY 2024–25 evidence

## 5. Source documents/files already referenced

Important local files:

- `/Users/sunny.mantri/Documents/Personal/DT-Report 238117.pdf`
- `/Users/sunny.mantri/Documents/Personal/DT-Receipt 238117.pdf`
- `/Users/sunny.mantri/Documents/Personal/Quote SK0269 Sunny Ingleburn.pdf`
- `/Users/sunny.mantri/Documents/Personal/Quote SK0270 Revised Sunny Ingleburn.pdf`
- `/Users/sunny.mantri/Documents/Personal/AJJ TILING SERVICES sunny.docx`
- `/Users/sunny.mantri/Documents/Personal/ANZ - Transaction History - July 1 2024- June 30 2025.csv`
- `/Users/sunny.mantri/Documents/Personal/ANZ - Progress Saver - .csv`
- `/Users/sunny.mantri/Documents/Personal/ANZ - Offset.csv`

Also many Gmail deep links have been embedded in workbook/HTML references.

## 6. Important assumptions currently baked in

### 6.1 Ownership split

The property is currently treated as:

- Sunny 50%
- Apoorva 50%

This is assumed throughout rental and CGT rows.

### 6.2 Personal items

Most personal/work/software rows are currently treated as belonging to Sunny only.

That means in `Apoorva` statement view:

- salary currently shows as zero / missing
- personal work/software amounts are not shown unless separately attributable

If Claude can find Apoorva-specific data, this part should be improved.

### 6.3 Capital improvements

The quote-based improvements are treated as candidates only, not fully confirmed.

Specific handling:

- SK0269 is treated as likely superseded by SK0270 and is excluded by default
- SK0270, AJJ Tiling, and the `$9,400` estimate are included as candidate improvement rows

These should be validated against:

- actual invoices
- payment proof
- depreciation/capital-works already claimed in Duo Tax schedule

## 7. Known issues / limitations

### 7.1 Summary sheet in workbook is still more static than ideal

The HTML is the more interactive and useful surface.

The Excel workbook does not dynamically switch between Sunny/Apoorva views; that logic is only in HTML right now.

### 7.2 Statement-view selector is summary-only

The `Combined / Sunny / Apoorva` selector currently affects the summary calculations.

It does **not** fully restyle or transform every row in every tab into a true owner-specific statement output.

Potential improvement:

- add a dedicated “Printable Statement” section for Sunny
- add a dedicated “Printable Statement” section for Apoorva
- generate line items in an ATO-style format for each person separately

### 7.3 Include logic

The latest generator version was updated so expense rows with amounts should get include checkboxes across:

- Rental Property
- CGT Sale
- Personal & Work

However, this should be manually reviewed in the actual page to ensure:

- all intended rows show the checkbox
- no important rows are blocked from inclusion
- the include column is placed before notes and not squashing notes

### 7.4 Browser verification limitation

The browser plugin would not directly load the local `file://` page because of URL policy restrictions. Verification was done by:

- rebuilding the HTML
- inspecting generated HTML source
- copying refreshed file into the target folder

So Claude should manually inspect the local HTML in a browser if possible.

### 7.5 Missing-note column layout

This was partially improved by:

- moving the include column before notes
- widening the note column with CSS

But layout may still need refinement in the live page.

## 8. Specific user requests still worth improving

The user explicitly wanted:

1. ability to create/use individual tax statements for Sunny and Apoorva
2. better use of the calculator to decide what to include/exclude
3. less cramped note columns
4. support for unsupported/missing-doc items via manual inclusion
5. clearer report that can be used for tax filing review

Strong next steps:

- make owner selector affect not just summary totals but also report presentation
- add printable/export-friendly individual summaries
- create an ATO-style grouped output by person:
  - income
  - rental deductions
  - CGT
  - work-related expenses
  - insurance / other candidates
- show a “selected for Sunny return” and “selected for Apoorva return” section

## 9. Suggested review priorities for Claude

### Priority 1

Open and review:

- `/Users/sunny.mantri/Documents/Personal Finances/Tax 2025/tax_2025_review.html`

Check:

- does the owner selector visibly work?
- do all expense rows show include checkboxes?
- is the note column readable?

### Priority 2

Review generator logic:

- `/Users/sunny.mantri/Downloads/cricket-auction 4/output/tax-2025/update_tax_2025_workbook.mjs`

Especially:

- `buildHtmlReview(...)`
- `getMeta(...)`
- `applyBadgesAndControls()`
- `renderSummaryDashboard()`

### Priority 3

Improve tax reporting structure:

- clearer Sunny-only statement
- clearer Apoorva-only statement
- better mapping of deductible vs informational vs unsupported items

### Priority 4

Review tax-treatment assumptions:

- whether some insurance items should remain only informational
- whether Duo Tax fee belongs where it is
- whether depreciation vs capital-improvement treatment risks double counting
- whether some Bunnings / cleaning / landlord insurance items should default differently

## 10. Extra context that matters

- User said Bank of China payments seen in ANZ related to another property: `3 Livingstone Ave`, not Ingleburn.
- User wants the Ingleburn return/file to avoid double-counting rental income already captured in Raine & Horne annual statement.
- User mentioned cleaning around `$750`.
- User wants software like OpenAI, Surfshark, LinkedIn etc reviewed as work-related expense candidates.
- User asked for support around life insurance / private health / income protection where possible.

## 11. Recommended handoff message to user (optional)

If you take over, a good next move would be something like:

“Reviewing the current tax workbook and HTML now. I’ll focus first on making the Sunny/Apoorva statement views cleaner and checking that every expense row can be included/excluded properly, then I’ll tighten the tax grouping and flag anything that still needs accountant confirmation.”

