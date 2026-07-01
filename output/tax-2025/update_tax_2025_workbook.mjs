import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath =
  "/Users/sunny.mantri/Downloads/cricket-auction 4/output/tax-2025/tax_2025_working_paper.xlsx";
const previewPath =
  "/Users/sunny.mantri/Downloads/cricket-auction 4/output/tax-2025/tax_2025_personal_work_preview.png";
const htmlPath =
  "/Users/sunny.mantri/Downloads/cricket-auction 4/output/tax-2025/tax_2025_review.html";

const colors = {
  navy: "#16324F",
  border: "#D9E1E7",
  gray: "#F4F6F8",
  text: "#1F2937",
  white: "#FFFFFF",
};
const audCurrency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function styleHeader(range) {
  range.format = {
    fill: colors.navy,
    font: { bold: true, color: colors.white },
    horizontalAlignment: "Center",
    verticalAlignment: "Center",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: colors.border },
  };
}

function styleTable(range) {
  range.format = {
    borders: { preset: "all", style: "thin", color: colors.border },
    verticalAlignment: "Center",
    wrapText: true,
    font: { color: colors.text },
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cellToHtml(value) {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    return escapeHtml(audCurrency.format(value));
  }

  const text = String(value);
  let href = null;
  if (/^https?:\/\//i.test(text) || /^file:\/\//i.test(text)) {
    href = text;
  } else if (text.startsWith("/Users/") || text.startsWith("/var/")) {
    href = `file://${text}`;
  }

  if (!href) return escapeHtml(text);
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(
    text,
  )}</a>`;
}

function matrixToTableHtml(values, tableId, sectionId) {
  if (!values?.length) return "<p>No data available.</p>";
  const [header, ...rows] = values;
  const head = `<tr>${header.map((v) => `<th>${escapeHtml(v ?? "")}</th>`).join("")}</tr>`;
  const body = rows
    .map(
      (row, index) =>
        `<tr data-section="${sectionId}" data-row-index="${index}">${row
          .map((v) => `<td>${cellToHtml(v)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table id="${tableId}"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function buildHtmlReview(sections) {
  const serializedSections = JSON.stringify(sections).replace(/</g, "\\u003c");
  const nav = sections
    .map(
      (section, index) =>
        `<button class="tab-button${index === 0 ? " active" : ""}" data-tab="${section.id}">${escapeHtml(
          section.title,
        )}</button>`,
    )
    .join("");

  const panels = sections
    .map(
      (section, index) => {
        const content =
          section.id === "summary"
            ? `<div id="summary-dashboard"></div>`
            : `<div class="table-wrap">${matrixToTableHtml(
                section.values,
                section.tableId,
                section.id,
              )}</div>`;
        return `
        <section class="tab-panel${index === 0 ? " active" : ""}" id="${section.id}">
          <div class="panel-header">
            <div>
              <h2>${escapeHtml(section.title)}</h2>
              <p>${escapeHtml(section.description)}</p>
            </div>
            ${
              section.id === "summary"
                ? `<div class="panel-actions"><div class="summary-pill">Live calculator</div><label class="owner-select">Statement view<select id="owner-view"><option value="combined">Combined</option><option value="sunny">Sunny</option><option value="apoorva">Apoorva</option></select></label></div>`
                : `<input class="table-filter" data-table="${section.tableId}" type="search" placeholder="Filter this table..." />`
            }
          </div>
          ${content}
        </section>`;
      },
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tax 2024–25 Review – Sunny Mantri & Apoorva Patwa</title>
  <style>
    :root { --navy:#16324f; --navy2:#244b71; --bg:#f4f6f8; --card:#fff; --text:#1f2937; --muted:#5b6472; --border:#d9e1e7; --accent:#eef4fb; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:var(--bg); color:var(--text); }
    .page { max-width:1400px; margin:0 auto; padding:24px; }
    .hero,.note,.tab-panel,.summary-card { background:var(--card); border:1px solid var(--border); border-radius:14px; box-shadow:0 8px 24px rgba(22,50,79,.05); }
    .hero { padding:24px; margin-bottom:16px; }
    .hero h1 { margin:0 0 8px; font-size:28px; color:var(--navy); }
    .hero p,.panel-header p { margin:6px 0 0; color:var(--muted); line-height:1.45; }
    .note { padding:16px 18px; margin-bottom:16px; background:var(--accent); line-height:1.5; }
    .tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
    .tab-button { border:1px solid var(--border); background:#fff; color:var(--navy); border-radius:999px; padding:10px 14px; font-weight:600; cursor:pointer; }
    .tab-button.active { background:var(--navy); color:#fff; border-color:var(--navy); }
    .tab-panel { display:none; padding:18px; margin-bottom:16px; }
    .tab-panel.active { display:block; }
    .panel-header { display:flex; justify-content:space-between; gap:16px; align-items:end; margin-bottom:12px; }
    .panel-header h2 { margin:0; color:var(--navy); font-size:22px; }
    .summary-pill { padding:8px 12px; border-radius:999px; background:var(--accent); color:var(--navy); font-weight:600; }
    .panel-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
    .owner-select { display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid var(--border); border-radius:999px; background:#fff; color:var(--navy); font-weight:600; }
    .owner-select select { border:none; background:transparent; color:var(--navy); font:inherit; font-weight:700; }
    .table-filter { min-width:280px; padding:10px 12px; border-radius:10px; border:1px solid var(--border); font:inherit; }
    .table-wrap { overflow:auto; border:1px solid var(--border); border-radius:12px; }
    table { border-collapse:collapse; width:100%; min-width:1180px; background:#fff; }
    th,td { padding:10px 12px; border-bottom:1px solid var(--border); border-right:1px solid var(--border); vertical-align:top; text-align:left; line-height:1.35; }
    th:last-child,td:last-child { border-right:none; }
    thead th { position:sticky; top:0; background:var(--navy); color:#fff; z-index:1; }
    tbody tr:nth-child(even) { background:#fbfcfd; }
    a { color:var(--navy2); text-decoration:none; }
    a:hover { text-decoration:underline; }
    .amount-cell { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
    .badge { display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:700; letter-spacing:.01em; }
    .badge-confirmed { background:#dff3e4; color:#17683a; }
    .badge-candidate { background:#fff4cc; color:#7a5a00; }
    .badge-missing { background:#fde2e1; color:#9e2b25; }
    .badge-excluded { background:#e5e7eb; color:#4b5563; }
    .row-excluded { background:#f3f4f6 !important; color:#6b7280; }
    .row-excluded a { color:#6b7280; }
    .include-toggle { display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:var(--text); }
    .include-toggle input { width:16px; height:16px; accent-color:var(--navy); }
    .col-item { min-width:220px; }
    .col-treatment { min-width:260px; }
    .col-evidence { min-width:220px; }
    .col-status { min-width:140px; }
    .col-amount { min-width:110px; }
    .col-note { min-width:340px; width:340px; }
    .col-include { min-width:120px; width:120px; white-space:nowrap; }
    .calc-note { color:var(--muted); font-size:13px; }
    .view-note { margin:0 0 14px; color:var(--muted); font-size:14px; }
    .summary-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; margin-bottom:16px; }
    .summary-card { padding:16px; }
    .summary-card h3 { margin:0 0 8px; color:var(--navy); font-size:16px; }
    .summary-card .big-number { font-size:28px; font-weight:800; color:var(--text); margin:0; }
    .summary-card .sub-number { margin-top:4px; color:var(--muted); font-size:13px; }
    .summary-section { margin-bottom:18px; }
    .summary-section h3 { margin:0 0 10px; color:var(--navy); }
    .summary-section table { min-width:0; }
    .summary-empty { padding:18px; border:1px dashed var(--border); border-radius:12px; color:var(--muted); background:#fafafa; }
    @media (max-width:900px) { .panel-header { flex-direction:column; align-items:stretch; } .table-filter { min-width:0; width:100%; } .page { padding:14px; } }
    @media (max-width:1100px) { .summary-grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="hero">
      <h1>Tax 2024–25 Review</h1>
      <p>Sunny Mantri &amp; Apoorva Patwa</p>
      <p>Property focus: 1/56-60 Ingleburn Road, Ingleburn NSW 2565</p>
    </div>
    <div class="note">
      <strong>Important:</strong> Use the Raine &amp; Horne annual rental statement as the primary rental income source. The ANZ bank rent deposits are a reconciliation aid only and should not be added again if the annual statement already includes them.
      <br /><br />
      <strong>Loan note:</strong> Bank of China repayments seen in ANZ were identified by you as relating to 3 Livingstone Ave, not the Ingleburn property. The Ingleburn loan interest still needs its own lender statement.
    </div>
    <div class="tabs">${nav}</div>
    ${panels}
  </div>
  <script id="section-data" type="application/json">${serializedSections}</script>
  <script>
    const sectionData = JSON.parse(document.getElementById('section-data').textContent);
    const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const calcStateKey = 'tax-2025-review-state-v3';
    const ownerStateKey = 'tax-2025-owner-view-v1';

    function fmtCurrency(value) {
      return currency.format(Number(value || 0));
    }

    function num(value) {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value === 'number') return value;
      const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : null;
    }

    function escapeHtmlClient(value) {
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
    }

    function normalizeStatus(raw) {
      const value = String(raw || '').trim().toLowerCase();
      if (!value) return 'missing';
      if (value.includes('confirmed') || value === 'calculated') return 'confirmed';
      if (value.includes('candidate') || value.includes('review') || value.includes('partial') || value.includes('estimate') || value.includes('adjustment') || value.includes('low confidence')) return 'candidate';
      if (value.includes('missing') || value.includes('do not use')) return 'missing';
      return 'candidate';
    }

    function badgeClass(kind) {
      return { confirmed: 'badge-confirmed', candidate: 'badge-candidate', missing: 'badge-missing', excluded: 'badge-excluded' }[kind] || 'badge-candidate';
    }

    function columnClass(name) {
      const value = String(name || '').trim().toLowerCase();
      if (value === 'item' || value === 'area' || value === 'missing item') return 'col-item';
      if (value === 'likely treatment' || value === 'why needed') return 'col-treatment';
      if (value === 'evidence link' || value === 'link / path' || value === 'best source') return 'col-evidence';
      if (value === 'status' || value === 'priority') return 'col-status';
      if (value.includes('amount') || value.includes('share') || value === 'income') return 'col-amount';
      if (value.includes('note') || value.includes('source')) return 'col-note';
      if (value.includes('include in calc')) return 'col-include';
      return '';
    }

    function getMeta(sectionId, row) {
      if (sectionId === 'personal') {
        const [category, item, amount, treatment, evidence, status] = row;
        const statusKind = normalizeStatus(status);
        const amountNum = num(amount);
        if (category === 'Employment income') return { group: 'employment-income', optional: false, defaultIncluded: true, amount: amountNum, statusKind, owner: 'sunny' };
        if (category === 'Interest income') {
          if (String(item).includes('Total interest income')) return { group: 'interest-income', optional: false, defaultIncluded: true, amount: amountNum, statusKind, owner: 'sunny' };
          return { group: 'info-only', optional: false, defaultIncluded: false, amount: amountNum, statusKind, owner: 'sunny' };
        }
        if (category === 'Work expense') return { group: 'office-equipment', optional: amountNum !== null, defaultIncluded: false, amount: amountNum, statusKind, owner: 'sunny' };
        if (category === 'Software subscription' || category === 'Software adjustment') return { group: 'office-subscription', optional: amountNum !== null, defaultIncluded: false, amount: amountNum, statusKind, owner: 'sunny' };
        if (amountNum !== null) {
          return {
            group: 'personal-other',
            optional: true,
            defaultIncluded: statusKind === 'confirmed',
            amount: amountNum,
            statusKind,
            owner: 'sunny',
          };
        }
        return { group: 'other', optional: false, defaultIncluded: false, amount: amountNum, statusKind, owner: 'sunny' };
      }

      if (sectionId === 'rental') {
        const [category, item, amount, yourShare, apoorvaShare, treatment, evidence, status] = row;
        const statusKind = normalizeStatus(status);
        if (category === 'Rental income') return { group: 'rental-income', optional: false, defaultIncluded: true, amount: num(amount), yourShare: num(yourShare), apoorvaShare: num(apoorvaShare), statusKind, owner: 'shared' };
        if (category === 'Rental deduction' || category === 'Depreciation') {
          const amountNum = num(amount);
          const optional = amountNum !== null;
          const defaultIncluded = statusKind === 'confirmed' || statusKind === 'candidate';
          return { group: 'rental-expense', optional, defaultIncluded, amount: amountNum, yourShare: num(yourShare), apoorvaShare: num(apoorvaShare), statusKind, category, item, owner: 'shared' };
        }
      }

      if (sectionId === 'cgt') {
        const [category, item, amount, yourShare, apoorvaShare, treatment, evidence, status] = row;
        const statusKind = normalizeStatus(status);
        if (item === 'Sale proceeds') return { group: 'cgt-proceeds', optional: false, defaultIncluded: true, amount: num(amount), yourShare: num(yourShare), apoorvaShare: num(apoorvaShare), statusKind, owner: 'shared' };
        const amountNum = num(amount);
        if (amountNum !== null) {
          const isImprovement = /quote|renovation|improvement|estimate|tiling|kitchen|bathroom/i.test(String(item));
          const isSuperseded = /superseded/i.test(String(item));
          const optional = true;
          const defaultIncluded = isImprovement ? !isSuperseded : statusKind === 'confirmed' || statusKind === 'candidate';
          return {
            group: isImprovement ? 'cgt-improvement' : 'cgt-selling-cost',
            optional,
            defaultIncluded,
            amount: amountNum,
            yourShare: num(yourShare),
            apoorvaShare: num(apoorvaShare),
            statusKind,
            owner: 'shared',
          };
        }
      }

      return { group: 'other', optional: false, defaultIncluded: false, amount: null, statusKind: 'missing' };
    }

    function rowKey(sectionId, rowIndex) {
      return sectionId + ':' + rowIndex;
    }

    function loadState() {
      try {
        return JSON.parse(localStorage.getItem(calcStateKey) || '{}');
      } catch {
        return {};
      }
    }

    function saveState(state) {
      localStorage.setItem(calcStateKey, JSON.stringify(state));
    }

    const calcState = loadState();
    const ownerViewSelect = document.getElementById('owner-view');

    function loadOwnerView() {
      const value = localStorage.getItem(ownerStateKey);
      return ['combined', 'sunny', 'apoorva'].includes(value) ? value : 'combined';
    }

    function saveOwnerView(value) {
      localStorage.setItem(ownerStateKey, value);
    }

    let ownerView = loadOwnerView();
    if (ownerViewSelect) ownerViewSelect.value = ownerView;

    function ownerLabel(value) {
      return { combined: 'Combined', sunny: 'Sunny', apoorva: 'Apoorva' }[value] || 'Combined';
    }

    function viewAmount(meta) {
      if (meta.owner === 'shared') {
        if (ownerView === 'sunny') return meta.yourShare ?? meta.amount ?? 0;
        if (ownerView === 'apoorva') return meta.apoorvaShare ?? meta.amount ?? 0;
        return meta.amount ?? 0;
      }
      if (meta.owner === 'sunny') {
        return ownerView === 'apoorva' ? 0 : meta.amount ?? 0;
      }
      return meta.amount ?? 0;
    }

    function rowVisibleInView(meta) {
      if (meta.owner === 'sunny' && ownerView === 'apoorva') return false;
      return true;
    }

    function includeValue(sectionId, rowIndex, meta) {
      const key = rowKey(sectionId, rowIndex);
      if (Object.prototype.hasOwnProperty.call(calcState, key)) return calcState[key];
      return meta.defaultIncluded;
    }

    function applyBadgesAndControls() {
      sectionData.forEach((section) => {
        if (section.id === 'summary') return;
        const table = document.getElementById(section.tableId);
        if (!table) return;

        const headerCells = Array.from(table.querySelectorAll('thead th'));
        headerCells.forEach((th) => {
          const cls = columnClass(th.textContent.trim());
          if (cls) th.classList.add(cls);
        });
        const statusIndex = headerCells.findIndex((th) => th.textContent.trim() === 'Status');
        const noteIndex = headerCells.findIndex((th) => /note|source/i.test(th.textContent.trim()));
        const amountIndexes = headerCells
          .map((th, idx) => ({ text: th.textContent.trim(), idx }))
          .filter(({ text }) => ['Amount AUD', 'Total AUD', 'Your 50%', 'Apoorva 50%', 'Your Share', 'Apoorva Share'].includes(text))
          .map(({ idx }) => idx);

        if (section.id !== 'references' && section.id !== 'missing') {
          const includeHeader = document.createElement('th');
          includeHeader.textContent = 'Include in calc';
          includeHeader.classList.add('col-include');
          const headRow = table.querySelector('thead tr');
          const targetHeader = noteIndex >= 0 ? headRow.children[noteIndex] : null;
          if (targetHeader) headRow.insertBefore(includeHeader, targetHeader);
          else headRow.appendChild(includeHeader);
        }

        Array.from(table.querySelectorAll('tbody tr')).forEach((tr) => {
          const rowIndex = Number(tr.dataset.rowIndex);
          const row = section.values[rowIndex + 1];
          const meta = getMeta(section.id, row);

          Array.from(tr.children).forEach((td, idx) => {
            const header = headerCells[idx];
            if (!header) return;
            const cls = columnClass(header.textContent.trim());
            if (cls) td.classList.add(cls);
          });

          amountIndexes.forEach((idx) => {
            const td = tr.children[idx];
            if (td) td.classList.add('amount-cell');
          });

          if (statusIndex >= 0) {
            const statusCell = tr.children[statusIndex];
            if (statusCell) {
              const original = statusCell.textContent.trim();
              statusCell.innerHTML = '<span class="badge ' + badgeClass(meta.statusKind) + '">' + escapeHtmlClient(original) + '</span>';
            }
          } else if (section.id === 'missing') {
            const priorityCell = tr.children[0];
            if (priorityCell) {
              priorityCell.innerHTML = '<span class="badge badge-missing">' + escapeHtmlClient(priorityCell.textContent.trim()) + '</span>';
            }
          }

          if (section.id === 'references' || section.id === 'missing') return;

          const includeCell = document.createElement('td');
          includeCell.classList.add('col-include');
          const included = includeValue(section.id, rowIndex, meta);
          tr.dataset.calcIncluded = included ? 'true' : 'false';

          if (meta.amount === null) {
            includeCell.innerHTML = '<span class="badge badge-missing">No amount</span>';
          } else {
            const label = document.createElement('label');
            label.className = 'include-toggle';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = included;
            checkbox.addEventListener('change', () => {
              calcState[rowKey(section.id, rowIndex)] = checkbox.checked;
              saveState(calcState);
              refreshRowState(tr, meta, checkbox.checked);
              renderSummaryDashboard();
            });
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode('Include'));
            includeCell.appendChild(label);
          }

          const targetCell = noteIndex >= 0 ? tr.children[noteIndex] : null;
          if (targetCell) tr.insertBefore(includeCell, targetCell);
          else tr.appendChild(includeCell);
          refreshRowState(tr, meta, included);
        });
      });
    }

    function refreshRowState(tr, meta, included) {
      tr.dataset.calcIncluded = included ? 'true' : 'false';
      if (meta.optional && !included) tr.classList.add('row-excluded');
      else tr.classList.remove('row-excluded');
    }

    function collectIncludedRows() {
      const rows = [];
      sectionData.forEach((section) => {
        if (section.id === 'summary' || section.id === 'references' || section.id === 'missing') return;
        section.values.slice(1).forEach((row, rowIndex) => {
          const meta = getMeta(section.id, row);
          const included = includeValue(section.id, rowIndex, meta);
          rows.push({ sectionId: section.id, rowIndex, row, meta, included });
        });
      });
      return rows;
    }

    function shareLabel() {
      if (ownerView === 'sunny') return 'Sunny share';
      if (ownerView === 'apoorva') return 'Apoorva share';
      return 'Combined total';
    }

    function rentalBucket(item) {
      const text = String(item).toLowerCase();
      if (text.includes('management')) return 'Property management fees';
      if (text.includes('strata')) return 'Strata fees';
      if (text.includes('council')) return 'Council rates';
      if (text.includes('water')) return 'Water charges';
      if (text.includes('loan')) return 'Loan interest';
      if (text.includes('insurance')) return 'Landlord insurance';
      if (text.includes('clean')) return 'Cleaning';
      if (text.includes('bunnings') || text.includes('repair')) return 'Repairs and maintenance';
      if (text.includes('division 43') || text.includes('depreciation') || text.includes('duo tax')) return 'Depreciation / capital works';
      return 'Other rental expense';
    }

    function officeBucket(row) {
      const category = String(row[0] || '');
      if (category === 'Software subscription' || category === 'Software adjustment') return 'Subscriptions / software';
      return 'Equipment / supplies';
    }

    function personalBucket(row) {
      const category = String(row[0] || '');
      if (category.includes('Life insurance')) return 'Life insurance / TPD';
      if (category.includes('Income protection')) return 'Income protection / redundancy';
      if (category.includes('Private health')) return 'Private health';
      return 'Other personal candidate';
    }

    function renderDetailTable(columns, rows, emptyText) {
      if (!rows.length) return '<div class="summary-empty">' + escapeHtmlClient(emptyText) + '</div>';
      const thead = '<thead><tr>' + columns.map((col) => '<th>' + escapeHtmlClient(col) + '</th>').join('') + '</tr></thead>';
      const tbody = '<tbody>' + rows.map((row) => '<tr>' + row.map((cell) => '<td' + (String(cell).trim().startsWith('$') || String(cell).trim().startsWith('-$') ? ' class="amount-cell"' : '') + '>' + cell + '</td>').join('') + '</tr>').join('') + '</tbody>';
      return '<div class="table-wrap"><table>' + thead + tbody + '</table></div>';
    }

    function renderSummaryDashboard() {
      const rows = collectIncludedRows();
      const employmentIncome = rows.filter((r) => r.included && r.meta.group === 'employment-income' && rowVisibleInView(r.meta)).reduce((sum, r) => sum + viewAmount(r.meta), 0);
      const interestIncome = rows.filter((r) => r.included && r.meta.group === 'interest-income' && rowVisibleInView(r.meta)).reduce((sum, r) => sum + viewAmount(r.meta), 0);
      const rentalIncome = rows.filter((r) => r.included && r.meta.group === 'rental-income' && rowVisibleInView(r.meta)).reduce((sum, r) => sum + viewAmount(r.meta), 0);
      const rentalExpenses = rows.filter((r) => r.included && r.meta.group === 'rental-expense' && rowVisibleInView(r.meta));
      const officeExpenses = rows.filter((r) => r.included && (r.meta.group === 'office-equipment' || r.meta.group === 'office-subscription') && rowVisibleInView(r.meta));
      const personalOtherExpenses = rows.filter((r) => r.included && r.meta.group === 'personal-other' && rowVisibleInView(r.meta));
      const cgtSaleProceeds = rows.filter((r) => r.included && r.meta.group === 'cgt-proceeds' && rowVisibleInView(r.meta)).reduce((sum, r) => sum + viewAmount(r.meta), 0);
      const cgtSaleRow = rows.find((r) => r.included && r.meta.group === 'cgt-proceeds');
      const cgtSellingCosts = rows.filter((r) => r.included && r.meta.group === 'cgt-selling-cost' && rowVisibleInView(r.meta));
      const cgtImprovements = rows.filter((r) => r.included && r.meta.group === 'cgt-improvement' && rowVisibleInView(r.meta));

      const rentalTotal = rentalExpenses.reduce((sum, r) => sum + viewAmount(r.meta), 0);
      const officeTotal = officeExpenses.reduce((sum, r) => sum + viewAmount(r.meta), 0);
      const personalOtherTotal = personalOtherExpenses.reduce((sum, r) => sum + viewAmount(r.meta), 0);
      const cgtCostTotal = cgtSellingCosts.reduce((sum, r) => sum + viewAmount(r.meta), 0);
      const cgtImprovementTotal = cgtImprovements.reduce((sum, r) => sum + viewAmount(r.meta), 0);
      const officeEquipmentTotal = officeExpenses.filter((r) => r.meta.group === 'office-equipment').reduce((sum, r) => sum + viewAmount(r.meta), 0);
      const officeSubscriptionTotal = officeExpenses.filter((r) => r.meta.group === 'office-subscription').reduce((sum, r) => sum + viewAmount(r.meta), 0);
      const rentalYourShare = rentalExpenses.reduce((sum, r) => sum + (r.meta.yourShare || 0), 0);
      const rentalApoorvaShare = rentalExpenses.reduce((sum, r) => sum + (r.meta.apoorvaShare || 0), 0);
      const cgtSellingYourShare = cgtSellingCosts.reduce((sum, r) => sum + (r.meta.yourShare || 0), 0);
      const cgtSellingApoorvaShare = cgtSellingCosts.reduce((sum, r) => sum + (r.meta.apoorvaShare || 0), 0);
      const cgtImprovementYourShare = cgtImprovements.reduce((sum, r) => sum + (r.meta.yourShare || 0), 0);
      const cgtImprovementApoorvaShare = cgtImprovements.reduce((sum, r) => sum + (r.meta.apoorvaShare || 0), 0);
      const propertyStatementTotal = rentalTotal + cgtCostTotal + cgtImprovementTotal;
      const statementLabel = ownerLabel(ownerView);
      const combinedMode = ownerView === 'combined';

      const rentalRows = rentalExpenses.map((r) => combinedMode
        ? [
            escapeHtmlClient(rentalBucket(r.row[1])),
            escapeHtmlClient(r.row[1]),
            escapeHtmlClient(String(r.row[7] || '')),
            fmtCurrency(r.meta.amount || 0),
            fmtCurrency(r.meta.yourShare || 0),
            fmtCurrency(r.meta.apoorvaShare || 0),
          ]
        : [
            escapeHtmlClient(rentalBucket(r.row[1])),
            escapeHtmlClient(r.row[1]),
            escapeHtmlClient(String(r.row[7] || '')),
            fmtCurrency(viewAmount(r.meta)),
            escapeHtmlClient(statementLabel + ' ownership share'),
          ],
      );

      const officeRows = officeExpenses.map((r) => [
        escapeHtmlClient(officeBucket(r.row)),
        escapeHtmlClient(r.row[1]),
        escapeHtmlClient(String(r.row[5] || '')),
        fmtCurrency(viewAmount(r.meta)),
      ]);

      const personalOtherRows = personalOtherExpenses.map((r) => [
        escapeHtmlClient(personalBucket(r.row)),
        escapeHtmlClient(r.row[1]),
        escapeHtmlClient(String(r.row[5] || '')),
        fmtCurrency(viewAmount(r.meta)),
      ]);

      const cgtRows = [
        ...(cgtSaleProceeds ? [combinedMode
          ? [escapeHtmlClient('Sale proceeds'), escapeHtmlClient('Sale proceeds'), escapeHtmlClient('Confirmed'), fmtCurrency(cgtSaleRow?.meta.amount || 0), fmtCurrency(cgtSaleRow?.meta.yourShare || 0), fmtCurrency(cgtSaleRow?.meta.apoorvaShare || 0), escapeHtmlClient('Gross sale price before cost-base adjustments')]
          : [escapeHtmlClient('Sale proceeds'), escapeHtmlClient('Sale proceeds'), escapeHtmlClient('Confirmed'), fmtCurrency(cgtSaleProceeds), escapeHtmlClient(statementLabel + ' ownership share'), escapeHtmlClient('Gross sale price before cost-base adjustments')]] : []),
        ...cgtSellingCosts.map((r) => combinedMode
          ? [escapeHtmlClient('Selling cost'), escapeHtmlClient(r.row[1]), escapeHtmlClient(String(r.row[7] || '')), fmtCurrency(r.meta.amount || 0), fmtCurrency(r.meta.yourShare || 0), fmtCurrency(r.meta.apoorvaShare || 0), escapeHtmlClient(String(r.row[8] || ''))]
          : [escapeHtmlClient('Selling cost'), escapeHtmlClient(r.row[1]), escapeHtmlClient(String(r.row[7] || '')), fmtCurrency(viewAmount(r.meta)), escapeHtmlClient(statementLabel + ' ownership share'), escapeHtmlClient(String(r.row[8] || ''))]),
        ...cgtImprovements.map((r) => combinedMode
          ? [escapeHtmlClient('Capital improvement'), escapeHtmlClient(r.row[1]), escapeHtmlClient(String(r.row[7] || '')), fmtCurrency(r.meta.amount || 0), fmtCurrency(r.meta.yourShare || 0), fmtCurrency(r.meta.apoorvaShare || 0), escapeHtmlClient(String(r.row[8] || ''))]
          : [escapeHtmlClient('Capital improvement'), escapeHtmlClient(r.row[1]), escapeHtmlClient(String(r.row[7] || '')), fmtCurrency(viewAmount(r.meta)), escapeHtmlClient(statementLabel + ' ownership share'), escapeHtmlClient(String(r.row[8] || ''))]),
      ];

      document.getElementById('summary-dashboard').innerHTML = [
        '<p class="view-note">Current statement view: <strong>' + statementLabel + '</strong>' + (ownerView === 'apoorva' ? ' · Personal salary, work expenses and software costs currently appear to belong to Sunny only.' : '') + '</p>',
        '<div class="summary-grid">',
          '<div class="summary-card">',
            '<h3>Employment income</h3>',
            '<p class="big-number">' + fmtCurrency(employmentIncome) + '</p>',
            '<p class="sub-number">' + (ownerView === 'apoorva' ? 'No Apoorva PAYG statement captured yet' : 'PAYG salary captured from your screenshot') + '</p>',
          '</div>',
          '<div class="summary-card">',
            '<h3>Interest income</h3>',
            '<p class="big-number">' + fmtCurrency(interestIncome) + '</p>',
            '<p class="sub-number">' + (ownerView === 'apoorva' ? 'No Apoorva interest summary captured yet' : 'Bank and ATO interest income confirmed') + '</p>',
          '</div>',
          '<div class="summary-card">',
            '<h3>Rental income</h3>',
            '<p class="big-number">' + fmtCurrency(rentalIncome) + '</p>',
            '<p class="sub-number">Primary source: Raine &amp; Horne annual statement · ' + shareLabel() + '</p>',
          '</div>',
          '<div class="summary-card">',
            '<h3>Rental deductions selected</h3>',
            '<p class="big-number">' + fmtCurrency(rentalTotal) + '</p>',
            '<p class="sub-number">Includes only rows currently set to include · ' + shareLabel() + '</p>',
          '</div>',
          '<div class="summary-card">',
            '<h3>Office expenses selected</h3>',
            '<p class="big-number">' + fmtCurrency(officeTotal) + '</p>',
            '<p class="sub-number">Equipment / supplies ' + fmtCurrency(officeEquipmentTotal) + ' · Subscriptions ' + fmtCurrency(officeSubscriptionTotal) + '</p>',
          '</div>',
          '<div class="summary-card">',
            '<h3>Other personal / insurance candidates selected</h3>',
            '<p class="big-number">' + fmtCurrency(personalOtherTotal) + '</p>',
            '<p class="sub-number">Rows outside office software/equipment that you manually include</p>',
          '</div>',
          '<div class="summary-card">',
            '<h3>CGT selling costs selected</h3>',
            '<p class="big-number">' + fmtCurrency(cgtCostTotal) + '</p>',
            '<p class="sub-number">Sale proceeds ' + fmtCurrency(cgtSaleProceeds) + ' · ' + shareLabel() + '</p>',
          '</div>',
          '<div class="summary-card">',
            '<h3>CGT capital improvements selected</h3>',
            '<p class="big-number">' + fmtCurrency(cgtImprovementTotal) + '</p>',
            '<p class="sub-number">Quotes / refurbishment items currently included</p>',
          '</div>',
          '<div class="summary-card">',
            '<h3>' + statementLabel + ' property amount selected</h3>',
            '<p class="big-number">' + fmtCurrency(propertyStatementTotal) + '</p>',
            '<p class="sub-number">' + (combinedMode
              ? 'Sunny share ' + fmtCurrency(rentalYourShare + cgtSellingYourShare + cgtImprovementYourShare) + ' · Apoorva share ' + fmtCurrency(rentalApoorvaShare + cgtSellingApoorvaShare + cgtImprovementApoorvaShare)
              : 'Rental deductions ' + fmtCurrency(rentalTotal) + ' · CGT selling ' + fmtCurrency(cgtCostTotal) + ' · Improvements ' + fmtCurrency(cgtImprovementTotal)) + '</p>',
          '</div>',
        '</div>',
        '<div class="summary-section">',
          '<h3>Rental property breakdown</h3>',
          '<p class="calc-note">ATO-style grouping for rental income and deductions. Every expense row can now be included or excluded directly in the Rental Property tab.</p>',
          renderDetailTable(combinedMode ? ['Expense type', 'Item', 'Status', 'Total AUD', 'Sunny share', 'Apoorva share'] : ['Expense type', 'Item', 'Status', 'Statement amount', 'Basis'], rentalRows, 'No rental expense rows are currently included.'),
        '</div>',
        '<div class="summary-section">',
          '<h3>Office expenses breakdown</h3>',
          '<p class="calc-note">Work-related expenses grouped between equipment / supplies and subscriptions / software.</p>',
          renderDetailTable(['ATO-style bucket', 'Item', 'Status', 'Amount AUD'], officeRows, 'No office-expense candidate rows are currently included.'),
        '</div>',
        '<div class="summary-section">',
          '<h3>Other personal / insurance breakdown</h3>',
          '<p class="calc-note">Use this section when you manually include non-office personal candidate rows such as insurance-related amounts.</p>',
          renderDetailTable(['Bucket', 'Item', 'Status', 'Amount AUD'], personalOtherRows, 'No other personal candidate rows are currently included for this statement view.'),
        '</div>',
        '<div class="summary-section">',
          '<h3>CGT breakdown</h3>',
          '<p class="calc-note">Sale proceeds, selling costs and capital-improvement candidates selected from the CGT Sale tab. Red status rows can still be included if you want to model them without documents.</p>',
          renderDetailTable(combinedMode ? ['Type', 'Item', 'Status', 'Total AUD', 'Sunny share', 'Apoorva share', 'Note'] : ['Type', 'Item', 'Status', 'Statement amount', 'Basis', 'Note'], cgtRows, 'No CGT rows are currently included.'),
        '</div>'
      ].join('');
    }

    const tabButtons = document.querySelectorAll('.tab-button');
    const panels = document.querySelectorAll('.tab-panel');
    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        tabButtons.forEach((b) => b.classList.remove('active'));
        panels.forEach((p) => p.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(button.dataset.tab).classList.add('active');
      });
    });
    document.querySelectorAll('.table-filter').forEach((input) => {
      input.addEventListener('input', () => {
        const table = document.getElementById(input.dataset.table);
        const query = input.value.trim().toLowerCase();
        table.querySelectorAll('tbody tr').forEach((row) => {
          row.style.display = !query || row.textContent.toLowerCase().includes(query) ? '' : 'none';
        });
      });
    });
    if (ownerViewSelect) {
      ownerViewSelect.addEventListener('change', () => {
        ownerView = ownerViewSelect.value;
        saveOwnerView(ownerView);
        renderSummaryDashboard();
      });
    }
    applyBadgesAndControls();
    renderSummaryDashboard();
  </script>
</body>
</html>`;
}

const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = workbook.worksheets.getItem("Summary");
const rental = workbook.worksheets.getItem("Rental Property");
const cgt = workbook.worksheets.getItem("CGT Sale");
const personal = workbook.worksheets.getItem("Personal & Work");
const references = workbook.worksheets.getItem("References");
const missing = workbook.worksheets.getItem("Missing Info");

summary.getUsedRange().clear({ applyTo: "all" });
summary.getRange("A1:F19").values = [
  ["Tax 2024–25 Working Paper – Sunny Mantri & Apoorva Patwa", null, null, null, null, null],
  [null, null, null, null, null, null],
  [
    "Property: 1/56-60 Ingleburn Road, Ingleburn NSW 2565 | Ownership split assumed 50/50 | Period: 1 Jul 2024 to 30 Jun 2025",
    null,
    null,
    null,
    null,
    null,
  ],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  ["Area", "Status", "Total AUD", "Your Share", "Apoorva Share", "Primary Source / Note"],
  [
    "Employment income (PAYG summary)",
    "Confirmed",
    247413.0,
    null,
    null,
    "Salary screenshot captured from PAYG / prefill summary",
  ],
  [
    "Interest income",
    "Confirmed",
    386.37,
    null,
    null,
    "ANZ, Bank of China, St George and ATO interest from screenshot",
  ],
  [
    "Rental income",
    "Confirmed",
    22885.16,
    11442.58,
    11442.58,
    "Raine & Horne FY statement is the primary source. Bank rent deposits in ANZ appear to reconcile and should not be double-counted.",
  ],
  [
    "Confirmed rental deductions (before interest/insurance/cleaning)",
    "Partial",
    5109.55,
    2554.78,
    2554.78,
    "Strata, council, water, management fees",
  ],
  [
    "Depreciation schedule found",
    "Confirmed",
    1362.0,
    681.0,
    681.0,
    "Duo Tax Div 43 full-year schedule",
  ],
  [
    "Estimated apportioned depreciation to 20 May 2025",
    "Estimate",
    1209.01,
    604.5,
    604.5,
    "Needs accountant confirmation",
  ],
  [
    "CGT selling costs confirmed",
    "Confirmed",
    15161.32,
    7580.66,
    7580.66,
    "Commission, legal, PEXA, advertising",
  ],
  [
    "Capital improvement candidates currently selected in calculator",
    "Review",
    36188.0,
    18094.0,
    18094.0,
    "SK0270 revised kitchen quote, AJJ tiling quote and user-estimated improvements are included by default. SK0269 is left excluded as likely superseded.",
  ],
  [
    "Loan interest",
    "Missing",
    null,
    null,
    null,
    "Need bank/lender annual interest statement for the Ingleburn property",
  ],
  [
    "Private health statement",
    "Missing",
    null,
    null,
    null,
    "Need annual PHI statement or MyGov prefill",
  ],
  [
    "PAYG withholding / full income statement detail",
    "Partial",
    null,
    null,
    null,
    "Salary income is captured from the screenshot. If tax withheld needs separate support, use the full income statement / PAYG summary.",
  ],
  [null, null, null, null, null, null],
  [
    "Use the 'Rental Property' and 'CGT Sale' tabs for likely tax return figures. Use 'Personal & Work' for insurance and work expense candidates. Use 'Missing Info' to close remaining gaps.",
    null,
    null,
    null,
    null,
    null,
  ],
];
summary.getRange("A1:F1").merge();
summary.getRange("A3:F3").merge();
summary.getRange("A19:F19").merge();
summary.getRange("A1:F19").format.font = { color: colors.text };
summary.getRange("A1:F1").format = {
  fill: colors.navy,
  font: { bold: true, color: colors.white, fontSize: 14 },
  horizontalAlignment: "Center",
  verticalAlignment: "Center",
  wrapText: true,
};
summary.getRange("A3:F3").format = {
  font: { bold: true, color: colors.text },
  wrapText: true,
};
styleHeader(summary.getRange("A6:F6"));
styleTable(summary.getRange("A7:F17"));
summary.getRange("C7:E17").format.numberFormat = "$#,##0.00";
summary.getRange("A1:F19").format.wrapText = true;
summary.getRange("A1:F19").format.autofitColumns();
summary.getRange("A1:F19").format.autofitRows();
summary.freezePanes.freezeRows(6);

personal.getUsedRange().clear({ applyTo: "all" });
personal.getRange("A1:G23").values = [
  [
    "Category",
    "Item",
    "Amount AUD",
    "Likely treatment",
    "Evidence link",
    "Status",
    "Missing / note",
  ],
  [
    "Employment income",
    "SFDC AUSTRALIA PTY LIMITED",
    247413.0,
    "Assessable salary and wages income",
    "/var/folders/zg/_wtvb95j10v3lq9_h03xrqy00000gn/T/codex-clipboard-bc7e1fda-ed08-4e90-a9a4-a2b0e6cd19dc.png",
    "Confirmed from screenshot",
    "Screenshot shows salary, wages, allowances, tips, bonuses etc for FY 2024–25",
  ],
  [
    "Interest income",
    "ANZ BANKING GROUP LTD",
    123.53,
    "Assessable bank interest income",
    "/var/folders/zg/_wtvb95j10v3lq9_h03xrqy00000gn/T/codex-clipboard-bc7e1fda-ed08-4e90-a9a4-a2b0e6cd19dc.png",
    "Confirmed from screenshot",
    "Interest earned, not deductible interest paid",
  ],
  [
    "Interest income",
    "BANK OF CHINA (AUSTRALIA) LIMITED",
    10.62,
    "Assessable bank interest income",
    "/var/folders/zg/_wtvb95j10v3lq9_h03xrqy00000gn/T/codex-clipboard-bc7e1fda-ed08-4e90-a9a4-a2b0e6cd19dc.png",
    "Confirmed from screenshot",
    "Interest earned, not deductible interest paid",
  ],
  [
    "Interest income",
    "ST GEORGE BANK A DIVISION OF WESTPAC BANKING CORPORATION",
    251.29,
    "Assessable bank interest income",
    "/var/folders/zg/_wtvb95j10v3lq9_h03xrqy00000gn/T/codex-clipboard-bc7e1fda-ed08-4e90-a9a4-a2b0e6cd19dc.png",
    "Confirmed from screenshot",
    "This appears to be deposit / account interest earned, not the investment-loan interest deduction we still need separately",
  ],
  [
    "Interest income",
    "ATO - Interest on overpayment",
    0.93,
    "Assessable interest income",
    "/var/folders/zg/_wtvb95j10v3lq9_h03xrqy00000gn/T/codex-clipboard-bc7e1fda-ed08-4e90-a9a4-a2b0e6cd19dc.png",
    "Confirmed from screenshot",
    "ATO interest on overpayment is taxable income",
  ],
  [
    "Interest income",
    "Total interest income from screenshot",
    386.37,
    "Assessable interest income total",
    "/var/folders/zg/_wtvb95j10v3lq9_h03xrqy00000gn/T/codex-clipboard-bc7e1fda-ed08-4e90-a9a4-a2b0e6cd19dc.png",
    "Calculated",
    "123.53 + 10.62 + 251.29 + 0.93",
  ],
  [
    "Private health",
    "Annual PHI details",
    null,
    "PHI reporting item, not normal deduction",
    "https://www.ato.gov.au/forms-and-instructions/individual-tax-return-2025-instructions/medicare-levy-questions-m1-m2-individual-tax-return-2025/private-health-insurance-policy-details-2025",
    "Missing statement",
    "Need annual PHI statement or MyGov prefill",
  ],
  [
    "Private health",
    "GU Health membership / emails",
    null,
    "Supports membership context only",
    "https://mail.google.com/mail/#all/1973e5cf56c8f34d",
    "Partial",
    "No annual tax statement found yet",
  ],
  [
    "Life insurance",
    "TAL Life + TPD quoted monthly premium",
    127.44,
    "Usually not deductible if it is only life / TPD cover",
    "https://mail.google.com/mail/#all/1953abe13d5e0e48",
    "Partial",
    "Quote email dated 26 Nov 2024 shows $127.44 monthly; policy activated Feb 2025",
  ],
  [
    "Life insurance",
    "TAL premium payments",
    null,
    "Need actual debits before claiming anything",
    "https://mail.google.com/mail/#all/1953abe13d5e0e48",
    "Missing payment evidence",
    "Need bank statements / annual premium statement",
  ],
  [
    "Income protection / redundancy",
    "Prior-year note to accountant",
    872.28,
    "Prior-year reference only, not FY 2024–25 evidence",
    "https://mail.google.com/mail/#all/19268ee0317319db",
    "Do not use yet",
    "Email says income protection for the last financial year was 872.28; this appears to relate to the 2024 return, not FY 2024–25",
  ],
  [
    "Work expense",
    "Officeworks invoice 620847018",
    5.0,
    "Candidate work-related expense",
    "https://mail.google.com/mail/#all/195d72dfc4cf1d57",
    "Candidate",
    "Need item detail / confirm work use",
  ],
  [
    "Work expense",
    "Amazon Bluetooth mouse",
    19.98,
    "Good candidate work-related expense",
    "https://mail.google.com/mail/#all/19582ad03d2738ea",
    "Candidate",
    "Claim work-use portion if mixed use",
  ],
  [
    "Work expense",
    "Sony earbuds",
    129.0,
    "Candidate only if genuinely used for work",
    "https://mail.google.com/mail/#all/19582ad03d2738ea",
    "Review",
    "Need work-use confirmation",
  ],
  [
    "Work expense",
    "Earbud case",
    9.89,
    "Candidate only if earbuds are work-related",
    "https://mail.google.com/mail/#all/19582ad03d2738ea",
    "Review",
    "Low priority",
  ],
  [
    "Software subscription",
    "Google One 2 TB annual charge",
    124.99,
    "Candidate work-related software / storage expense",
    "https://mail.google.com/mail/#all/1940c191f64327c4",
    "Review",
    "Later refund email found for 68.15; claim only work-use portion after netting refund",
  ],
  [
    "Software adjustment",
    "Google One refund approved",
    -68.15,
    "Reduces any Google One claim",
    "https://mail.google.com/mail/#all/197620b2e1c26b81",
    "Adjustment",
    "Need PayPal / bank confirmation refund actually landed in FY",
  ],
  [
    "Software subscription",
    "Surfshark recurring order",
    147.01,
    "Candidate software / VPN expense",
    "https://mail.google.com/mail/#all/195ee719371144cc",
    "Candidate",
    "PayPal receipt shows 147.01 AUD charged on 1 Apr 2025 for Surfshark recurring subscription",
  ],
  [
    "Software subscription",
    "LinkedIn Premium receipts found",
    274.94,
    "Review carefully; may be non-deductible if mainly job-seeking",
    "https://mail.google.com/mail/#all/1976c6775aa9705a",
    "Review",
    "Receipts found for 14 Oct 2024 27.49, 14 Nov 2024 27.49, 14 Dec 2024 54.99, 14 Mar 2025 54.99, 14 May 2025 54.99, 14 Jun 2025 54.99",
  ],
  [
    "Software subscription",
    "Grammarly annual payment authorisation",
    225.35,
    "Candidate software expense if work-related",
    "https://mail.google.com/mail/#all/19358c2bf7a6cdb7",
    "Review",
    "PayPal authorisation on 23 Nov 2024 for 139.95 USD / 225.35 AUD; ideally confirm final posted receipt in PayPal or bank",
  ],
  [
    "Software subscription",
    "OpenAI / ChatGPT subscription",
    422.88,
    "Candidate work-related software expense",
    "file:///Users/sunny.mantri/Documents/Personal/ANZ%20-%20Offset.csv",
    "Confirmed from ANZ bank statement",
    "12 monthly OpenAI / ChatGPT subscription charges from 15 Jul 2024 to 13 Jun 2025. Claim work-use portion only. No Anthropic / Claude charge confirmed yet.",
  ],
  [
    "Rules",
    "ATO deduction rules",
    null,
    "Must relate to earning employment income and be supported by records",
    "https://www.ato.gov.au/forms-and-instructions/individual-tax-return-2025-instructions/supporting-information-individual-tax-return-2025/claiming-deductions-2025",
    "Confirmed source",
    "Reimbursed expenses cannot be claimed",
  ],
];
styleHeader(personal.getRange("A1:G1"));
styleTable(personal.getRange("A2:G23"));
personal.getRange("C2:C23").format.numberFormat = "$#,##0.00";
personal.getRange("A1:G23").format.font.color = colors.text;
personal.getRange("A1:G23").format.autofitColumns();
personal.getRange("A1:G23").format.autofitRows();
personal.getRange("A1:G23").format.wrapText = true;
personal.freezePanes.freezeRows(1);

cgt.getUsedRange().clear({ applyTo: "all" });
cgt.getRange("A1:I14").values = [
  [
    "Category",
    "Item",
    "Total AUD",
    "Your Share",
    "Apoorva Share",
    "Likely treatment",
    "Evidence link",
    "Status",
    "Missing / note",
  ],
  [
    "CGT proceeds",
    "Sale proceeds",
    640000.0,
    320000.0,
    320000.0,
    "Capital proceeds on sale of 1/56-60 Ingleburn Road",
    null,
    "Confirmed",
    "Use final contract / settlement statement",
  ],
  [
    "CGT selling cost",
    "Advertising / marketing",
    2000.0,
    1000.0,
    1000.0,
    "Incidental selling cost for CGT",
    null,
    "Confirmed",
    "Open homes / marketing per sale records",
  ],
  [
    "CGT selling cost",
    "Agent commission",
    10560.0,
    5280.0,
    5280.0,
    "Incidental selling cost for CGT",
    null,
    "Confirmed",
    "Raine & Horne commission on sale",
  ],
  [
    "CGT selling cost",
    "Solicitor / conveyancing on sale",
    2463.93,
    1231.97,
    1231.97,
    "Incidental selling cost for CGT",
    "https://mail.google.com/mail/#all/195c649924399ebe",
    "Confirmed",
    "Legal costs to complete the sale",
  ],
  [
    "CGT selling cost",
    "PEXA / settlement platform",
    137.39,
    68.7,
    68.7,
    "Incidental selling cost for CGT",
    null,
    "Confirmed",
    "Electronic settlement charge",
  ],
  [
    "Capital improvement",
    "Kitchen renovation quote SK0269 (likely superseded)",
    9438.0,
    4719.0,
    4719.0,
    "Capital improvement candidate for CGT cost base only if accepted and paid",
    "file:///Users/sunny.mantri/Documents/Personal/Quote%20SK0269%20Sunny%20Ingleburn.pdf",
    "Review",
    "Earlier quote dated 5 Feb 2018. Keep excluded unless you confirm it was paid and not replaced by SK0270.",
  ],
  [
    "Capital improvement",
    "Kitchen renovation quote SK0270 revised",
    10288.0,
    5144.0,
    5144.0,
    "Capital improvement candidate for CGT cost base only if accepted and paid",
    "file:///Users/sunny.mantri/Documents/Personal/Quote%20SK0270%20Revised%20Sunny%20Ingleburn.pdf",
    "Missing support",
    "Revised kitchen quote dated 14 Feb 2018. Need invoice / payment proof.",
  ],
  [
    "Capital improvement",
    "Bathroom renovation quote AJJ Tiling Services",
    16500.0,
    8250.0,
    8250.0,
    "Capital improvement candidate for CGT cost base or Div 43 review",
    "file:///Users/sunny.mantri/Documents/Personal/AJJ%20TILING%20SERVICES%20sunny.docx",
    "Missing support",
    "Quote dated 10 May 2020. Check against Duo Tax schedule so it is not double-counted.",
  ],
  [
    "Capital improvement",
    "General improvements estimate (user-provided)",
    9400.0,
    4700.0,
    4700.0,
    "User-estimated capital improvement candidate",
    null,
    "Missing support",
    "Add only if you want to model unsupported improvement spend pending documents.",
  ],
  [
    "Missing cost-base item",
    "Original purchase contract + settlement",
    null,
    null,
    null,
    "Needed to finalise CGT cost base",
    null,
    "Missing",
    "Need 2018 acquisition documents",
  ],
  [
    "Missing cost-base item",
    "Purchase stamp duty",
    null,
    null,
    null,
    "Part of CGT cost base",
    null,
    "Missing",
    "Usually on settlement statement / transfer duty records",
  ],
  [
    "Missing cost-base item",
    "Purchase legal fees",
    null,
    null,
    null,
    "Part of CGT cost base",
    null,
    "Missing",
    "Need 2018 solicitor / conveyancer invoice",
  ],
  [
    "Missing cost-base item",
    "Transfer / registration fee",
    null,
    null,
    null,
    "Part of CGT cost base",
    null,
    "Missing",
    "User said a registration form fee was paid back then",
  ],
];
styleHeader(cgt.getRange("A1:I1"));
styleTable(cgt.getRange("A2:I14"));
cgt.getRange("C2:E14").format.numberFormat = "$#,##0.00";
cgt.getRange("A1:I14").format.font.color = colors.text;
cgt.getRange("A1:I14").format.wrapText = true;
cgt.getRange("A1:I14").format.autofitColumns();
cgt.getRange("A1:I14").format.autofitRows();
cgt.freezePanes.freezeRows(1);

references.getUsedRange().clear({ applyTo: "all" });
references.getRange("A1:C24").values = [
  ["Reference type", "Description", "Link / path"],
  [
    "ATO",
    "21 Rent 2025",
    "https://www.ato.gov.au/forms-and-instructions/individual-supplementary-tax-return-2025-instructions/income-questions-13-24-supplementary-tax-return-2025/21-rent-2025",
  ],
  [
    "ATO",
    "18 Capital gains 2025",
    "https://www.ato.gov.au/forms-and-instructions/individual-supplementary-tax-return-2025-instructions/income-questions-13-24-supplementary-tax-return-2025/18-capital-gains-2025",
  ],
  [
    "ATO",
    "Rental properties guide 2025",
    "https://www.ato.gov.au/forms-and-instructions/rental-properties-2025",
  ],
  [
    "ATO",
    "Private health insurance policy details 2025",
    "https://www.ato.gov.au/forms-and-instructions/individual-tax-return-2025-instructions/medicare-levy-questions-m1-m2-individual-tax-return-2025/private-health-insurance-policy-details-2025",
  ],
  [
    "ATO",
    "Claiming deductions 2025",
    "https://www.ato.gov.au/forms-and-instructions/individual-tax-return-2025-instructions/supporting-information-individual-tax-return-2025/claiming-deductions-2025",
  ],
  [
    "ATO",
    "CGT when selling your rental property",
    "https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/property-and-capital-gains-tax/cgt-when-selling-your-rental-property",
  ],
  [
    "Local file",
    "Duo Tax report",
    "file:///Users/sunny.mantri/Documents/Personal/DT-Report%20238117.pdf",
  ],
  [
    "Local file",
    "Duo Tax receipt",
    "file:///Users/sunny.mantri/Documents/Personal/DT-Receipt%20238117.pdf",
  ],
  [
    "Gmail",
    "Google One annual charge receipt",
    "https://mail.google.com/mail/#all/1940c191f64327c4",
  ],
  [
    "Gmail",
    "Google One refund email",
    "https://mail.google.com/mail/#all/197620b2e1c26b81",
  ],
  [
    "Gmail",
    "Surfshark PayPal receipt",
    "https://mail.google.com/mail/#all/195ee719371144cc",
  ],
  [
    "Gmail",
    "LinkedIn PayPal receipt set",
    "https://mail.google.com/mail/#all/1976c6775aa9705a",
  ],
  [
    "Gmail",
    "Grammarly PayPal authorisation",
    "https://mail.google.com/mail/#all/19358c2bf7a6cdb7",
  ],
  [
    "Gmail",
    "TAL quote / premium email",
    "https://mail.google.com/mail/#all/1936751257bc73f4",
  ],
  [
    "Gmail",
    "TAL welcome / policy schedule email",
    "https://mail.google.com/mail/#all/1953abe13d5e0e48",
  ],
  [
    "Gmail",
    "Prior-year income protection note",
    "https://mail.google.com/mail/#all/19268ee0317319db",
  ],
  [
    "Local file",
    "ANZ Offset CSV with OpenAI and Surfshark charges",
    "file:///Users/sunny.mantri/Documents/Personal/ANZ%20-%20Offset.csv",
  ],
  [
    "Gmail",
    "Sale contract preparation invoice 2080",
    "https://mail.google.com/mail/#all/195c649924399ebe",
  ],
  [
    "Gmail",
    "Approval emails PDF: 2018 flooring + 2020 bathroom works",
    "https://mail.google.com/mail/#all/1965c87eca55e56f",
  ],
  [
    "Gmail",
    "Sale enquiry email noting 2018 laminate / kitchen and 2020 bathroom works",
    "https://mail.google.com/mail/#all/1965c87eca55e56f",
  ],
  [
    "Local file",
    "Kitchen quote SK0269",
    "file:///Users/sunny.mantri/Documents/Personal/Quote%20SK0269%20Sunny%20Ingleburn.pdf",
  ],
  [
    "Local file",
    "Kitchen quote SK0270 revised",
    "file:///Users/sunny.mantri/Documents/Personal/Quote%20SK0270%20Revised%20Sunny%20Ingleburn.pdf",
  ],
  [
    "Local file",
    "AJJ Tiling Services quote",
    "file:///Users/sunny.mantri/Documents/Personal/AJJ%20TILING%20SERVICES%20sunny.docx",
  ],
];
styleHeader(references.getRange("A1:C1"));
styleTable(references.getRange("A2:C24"));
references.getRange("A1:C24").format.autofitColumns();
references.getRange("A1:C24").format.autofitRows();
references.freezePanes.freezeRows(1);

missing.getUsedRange().clear({ applyTo: "all" });
missing.getRange("A1:D22").values = [
  ["Priority", "Missing item", "Why needed", "Best source"],
  [
    "High",
    "Bank statements for 1 Jul 2024 to 30 Jun 2025",
    "Find TAL premiums, private health payments, loan interest, and other spending",
    "Bank PDF / CSV statements",
  ],
  [
    "High",
    "PAYG income statements",
    "Complete income side of return",
    "MyGov / employer",
  ],
  [
    "High",
    "Investment loan interest statement",
    "Major rental deduction for Ingleburn; ANZ Bank of China repayments were identified as another property",
    "Ingleburn lender annual statement",
  ],
  [
    "High",
    "Original purchase contract + settlement",
    "Needed to finish CGT cost base",
    "Conveyancer / old email",
  ],
  [
    "High",
    "Purchase stamp duty + purchase legal fees",
    "Needed for CGT cost base",
    "Settlement docs",
  ],
  [
    "High",
    "2018 transfer / registration fee receipt",
    "Needed for CGT cost base if paid on purchase",
    "Settlement statement / conveyancer invoice / Revenue NSW",
  ],
  [
    "High",
    "Kitchen / bathroom renovation invoices and payment proof",
    "Needed to decide CGT cost base vs capital works / depreciation treatment",
    "Builder invoices / bank statements / emails",
  ],
  [
    "Medium",
    "Private health annual statement",
    "Needed for PHI section",
    "Insurer annual statement / MyGov prefill",
  ],
  [
    "Medium",
    "Full-year council notices",
    "Complete rental deduction",
    "Council notices / bank statements",
  ],
  [
    "Medium",
    "Missing water quarter if any",
    "Complete rental deduction",
    "Sydney Water / bank statements",
  ],
  [
    "Medium",
    "Landlord insurance payment proof",
    "Support rental deduction",
    "Bank statements",
  ],
  [
    "Medium",
    "Cleaning receipt for $750",
    "Support claim",
    "Invoice / bank transaction",
  ],
  [
    "Medium",
    "Any other Bunnings / repair invoices for the rental",
    "Support repairs claim",
    "Receipts / bank statements",
  ],
  [
    "Medium",
    "Prior year tax return / rental schedule",
    "Helps reconcile depreciation already claimed",
    "Accountant PDFs",
  ],
  [
    "Medium",
    "Check Duo Tax schedule includes later renovations",
    "Needed so depreciation / capital works are not double-counted or missed",
    "Duo Tax report + renovation invoices + accountant review",
  ],
  [
    "Medium",
    "Google One refund completion and work-use split",
    "Needed before claiming any software storage deduction",
    "PayPal / bank statement + your work-use estimate",
  ],
  [
    "Medium",
    "OpenAI / ChatGPT work-use percentage",
    "Need a reasonable basis before claiming the subscription as a work deduction",
    "Your estimate / work diary / accountant advice",
  ],
  [
    "Medium",
    "TAL premium debit evidence or annual premium statement",
    "Needed to prove actual FY 2024–25 insurance payments",
    "Bank statement / TAL statement / myTAL",
  ],
  [
    "Medium",
    "Clarify whether any policy includes income protection / redundancy cover",
    "Life / TPD is usually not deductible, but income protection may be",
    "Policy schedule / broker confirmation / accountant advice",
  ],
  [
    "Medium",
    "Council and Sydney Water notices not yet fully located in Gmail",
    "Need quarterly evidence if you want a document-backed reconciliation",
    "Council / Sydney Water PDFs or bank statement payments",
  ],
  [
    "Medium",
    "Support for the $9,400 general improvement estimate",
    "Needed before treating the user estimate as a defendable CGT cost-base item",
    "Invoices / receipts / bank statements / accountant workpapers",
  ],
];
styleHeader(missing.getRange("A1:D1"));
styleTable(missing.getRange("A2:D22"));
missing.getRange("A1:D22").format.autofitColumns();
missing.getRange("A1:D22").format.autofitRows();
missing.freezePanes.freezeRows(1);

summary.getCell(6, 5).values = [[
  "Raine & Horne FY statement is the primary source. Bank rent deposits in ANZ appear to reconcile and should not be double-counted.",
]];
rental.getCell(1, 8).values = [[
  "Use the Raine & Horne annual statement as primary income support; ANZ rent deposits appear to reconcile only.",
]];
rental.getCell(6, 8).values = [[
  "Need annual interest statement for the Ingleburn loan. Bank of China repayments seen in ANZ were identified by user as 3 Livingstone Ave, not this property.",
]];
rental.getCell(9, 7).values = [["Review"]];
rental.getCell(9, 8).values = [[
  "User said Bunnings may relate to the investment property, but earlier evidence pointed to 3 Livingstone Ave. Confirm item-by-item before claiming.",
]];

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});

const personalCheck = await workbook.inspect({
  kind: "table",
  range: "'Personal & Work'!A1:G23",
  include: "values",
  tableMaxRows: 23,
  tableMaxCols: 7,
});

const preview = await workbook.render({
  sheetName: "Personal & Work",
  range: "A1:G23",
  scale: 2,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(workbookPath);

const htmlSections = [
  {
    id: "summary",
    title: "Summary",
    description: "High-level totals and major gaps for the 2024–25 return.",
    tableId: "summary-table",
    values: summary.getUsedRange().values,
  },
  {
    id: "rental",
    title: "Rental Property",
    description: "Income and deductions for 1/56-60 Ingleburn Road.",
    tableId: "rental-table",
    values: rental.getUsedRange().values,
  },
  {
    id: "cgt",
    title: "CGT Sale",
    description: "Sale-related costs and capital gains working notes.",
    tableId: "cgt-table",
    values: cgt.getUsedRange().values,
  },
  {
    id: "personal",
    title: "Personal & Work",
    description: "Employment income, subscriptions, insurance and work-expense candidates.",
    tableId: "personal-table",
    values: personal.getUsedRange().values,
  },
  {
    id: "missing",
    title: "Missing Info",
    description: "What is still needed to complete the return confidently.",
    tableId: "missing-table",
    values: missing.getUsedRange().values,
  },
  {
    id: "references",
    title: "References",
    description: "Evidence links, source files and ATO guidance.",
    tableId: "references-table",
    values: references.getUsedRange().values,
  },
];
await fs.writeFile(htmlPath, buildHtmlReview(htmlSections), "utf8");

console.log(
  JSON.stringify({
    workbookPath,
    previewPath,
    htmlPath,
    personalCheck: personalCheck.ndjson,
    errors: errors.ndjson,
  }),
);
