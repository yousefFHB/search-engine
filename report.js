const fs = require("fs");

function printReport(
  pages,
  brokenLinks = [],
  csvFilename = "report.csv",
  brokenLinksFilename = "broken_links.csv",
  htmlFilename = "report.html",
  baseURL = "",
) {
  console.log("=============================");
  console.log("INTERNAL LINKS REPORT");
  console.log("=============================");
  const sortedPages = sortPages(pages);
  for (const page of sortedPages) {
    const url = page[0];
    const count = page[1];
    console.log(`found ${count} links to page: ${url}`);
  }
  console.log("=============================");
  console.log("BROKEN LINKS REPORT");
  console.log("=============================");

  if (!brokenLinks || brokenLinks.length === 0) {
    console.log("✅ No broken links found!");
  } else {
    console.log(`⚠️ Found ${brokenLinks.length} broken link(s):`);
    for (const item of brokenLinks) {
      console.log(
        `❌ [${item.status}] ${item.url} (Found on: ${item.sourceURL})`,
      );
    }
  }

  console.log("=============================");
  console.log("END OF REPORT");
  console.log("=============================");

  if (csvFilename) {
    writeCSVReport(pages, csvFilename);
  }

  if (brokenLinksFilename && brokenLinks && brokenLinks.length > 0) {
    writeBrokenLinksCSV(brokenLinks, brokenLinksFilename);
  }

  if (htmlFilename) {
    writeHTMLReport(pages, brokenLinks, htmlFilename, baseURL);
  }
}

function generateCSV(pages) {
  const sortedPages = sortPages(pages);
  let csv = "URL,Link Count\n";
  for (const page of sortedPages) {
    const url = page[0];
    const count = page[1];
    const escapedUrl =
      url.includes(",") || url.includes('"')
        ? `"${url.replace(/"/g, '""')}"`
        : url;
    csv += `${escapedUrl},${count}\n`;
  }
  return csv;
}

function writeCSVReport(pages, filename = "report.csv") {
  const csvContent = generateCSV(pages);
  fs.writeFileSync(filename, csvContent, "utf-8");
  console.log(`Report exported to Excel/CSV spreadsheet: ${filename}`);
}

function generateBrokenLinksCSV(brokenLinks) {
  let csv = "Broken URL,Status Code / Error,Found On Page\n";
  for (const item of brokenLinks) {
    const escapedUrl =
      item.url.includes(",") || item.url.includes('"')
        ? `"${item.url.replace(/"/g, '""')}"`
        : item.url;
    const escapedSource =
      item.sourceURL.includes(",") || item.sourceURL.includes('"')
        ? `"${item.sourceURL.replace(/"/g, '""')}"`
        : item.sourceURL;
    csv += `${escapedUrl},${item.status},${escapedSource}\n`;
  }
  return csv;
}

function writeBrokenLinksCSV(brokenLinks, filename = "broken_links.csv") {
  const csvContent = generateBrokenLinksCSV(brokenLinks);
  fs.writeFileSync(filename, csvContent, "utf-8");
  console.log(`Broken links exported to Excel/CSV spreadsheet: ${filename}`);
}

function generateHTMLReport(pages, brokenLinks = [], baseURL = "") {
  const sortedPages = sortPages(pages);
  const totalPages = sortedPages.length;
  const totalLinks = sortedPages.reduce((acc, curr) => acc + curr[1], 0);
  const totalBroken = brokenLinks ? brokenLinks.length : 0;
  const topPage = sortedPages.length > 0 ? sortedPages[0] : ["None", 0];
  const generatedDate = new Date().toUTCString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crawl Audit Report ${baseURL ? '- ' + baseURL : ''}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --bg: #0b0f17;
      --card-bg: #111827;
      --card-border: #1f293d;
      --card-hover: #26354f;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-glow: rgba(59, 130, 246, 0.15);
      --success: #10b981;
      --success-glow: rgba(16, 185, 129, 0.15);
      --danger: #f43f5e;
      --danger-glow: rgba(244, 63, 94, 0.15);
      --warning: #f59e0b;
      --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --mono: 'JetBrains Mono', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: var(--font);
      line-height: 1.5;
      padding: 2.5rem 1.5rem;
      min-height: 100vh;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 1.5rem;
      margin-bottom: 2.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--card-border);
    }

    .header-title h1 {
      font-size: 1.85rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .header-title .badge {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      background: var(--primary-glow);
      color: var(--primary);
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .header-meta {
      color: var(--text-muted);
      font-size: 0.875rem;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.35rem;
    }

    .header-meta code {
      font-family: var(--mono);
      color: #cbd5e1;
      background: #1e293b;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      transition: border-color 0.2s, transform 0.2s;
    }

    .kpi-card:hover {
      border-color: var(--card-hover);
      transform: translateY(-2px);
    }

    .kpi-label {
      color: var(--text-muted);
      font-size: 0.8125rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.5rem;
    }

    .kpi-value {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    .kpi-subtext {
      font-size: 0.8125rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
      word-break: break-all;
    }

    .kpi-value.green { color: var(--success); }
    .kpi-value.red { color: var(--danger); }
    .kpi-value.blue { color: var(--primary); }

    /* Charts Section */
    .charts-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.5rem;
      margin-bottom: 2.5rem;
    }

    @media (max-width: 900px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }
      .header-meta {
        align-items: flex-start;
      }
    }

    .chart-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.5rem;
    }

    .chart-header {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1.25rem;
      color: #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .chart-container {
      position: relative;
      height: 280px;
      width: 100%;
    }

    /* Tabs & Controls */
    .section-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .tabs {
      display: flex;
      gap: 0.5rem;
      background: #0f172a;
      padding: 0.25rem;
      border-radius: 8px;
      border: 1px solid var(--card-border);
    }

    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .tab-btn:hover {
      color: var(--text-main);
    }

    .tab-btn.active {
      background: var(--primary);
      color: #ffffff;
      font-weight: 600;
    }

    .search-box {
      position: relative;
      min-width: 280px;
    }

    .search-box input {
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 0.55rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      outline: none;
      transition: border-color 0.2s;
    }

    .search-box input:focus {
      border-color: var(--primary);
    }

    /* Tables */
    .table-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }

    th {
      background: #0f172a;
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.875rem 1.25rem;
      border-bottom: 1px solid var(--card-border);
    }

    td {
      padding: 0.875rem 1.25rem;
      border-bottom: 1px solid var(--card-border);
      color: #e2e8f0;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .url-cell {
      font-family: var(--mono);
      font-size: 0.8125rem;
      color: #93c5fd;
      word-break: break-all;
    }

    .url-cell a {
      color: inherit;
      text-decoration: none;
    }

    .url-cell a:hover {
      text-decoration: underline;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      padding: 0.2rem 0.55rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.75rem;
    }

    .pill-blue {
      background: var(--primary-glow);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .pill-red {
      background: var(--danger-glow);
      color: #fb7185;
      border: 1px solid rgba(244, 63, 94, 0.3);
    }

    .pill-amber {
      background: rgba(245, 158, 11, 0.15);
      color: #fcd34d;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .progress-bar-bg {
      background: #1e293b;
      height: 6px;
      width: 100px;
      border-radius: 3px;
      overflow: hidden;
      display: inline-block;
      vertical-align: middle;
      margin-left: 0.5rem;
    }

    .progress-bar-fill {
      background: var(--primary);
      height: 100%;
      border-radius: 3px;
    }

    .empty-state {
      padding: 3rem 1.5rem;
      text-align: center;
      color: var(--text-muted);
    }

    .hidden {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-title">
        <h1>
          <span>🕸️ Crawl Audit Report</span>
          <span class="badge">Live Report</span>
        </h1>
      </div>
      <div class="header-meta">
        <div>Root URL: <code>${baseURL || (sortedPages[0] ? sortedPages[0][0] : 'N/A')}</code></div>
        <div>Generated: <span>${generatedDate}</span></div>
      </div>
    </header>

    <!-- KPI Section -->
    <section class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Unique Pages</div>
        <div class="kpi-value blue">${totalPages}</div>
        <div class="kpi-subtext">Discovered internally</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Internal Links</div>
        <div class="kpi-value">${totalLinks}</div>
        <div class="kpi-subtext">Mapped across all pages</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Broken Links</div>
        <div class="kpi-value ${totalBroken > 0 ? 'red' : 'green'}">${totalBroken}</div>
        <div class="kpi-subtext">${totalBroken > 0 ? 'Requires attention' : 'All links healthy'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Top Linked Page</div>
        <div class="kpi-value">${topPage[1]} <span style="font-size: 1rem; color: var(--text-muted); font-weight: 400;">links</span></div>
        <div class="kpi-subtext">${topPage[0]}</div>
      </div>
    </section>

    <!-- Charts Section -->
    <section class="charts-grid">
      <div class="chart-card">
        <div class="chart-header">
          <span>Top 10 Most Linked Pages</span>
        </div>
        <div class="chart-container">
          <canvas id="topPagesChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-header">
          <span>Link Health</span>
        </div>
        <div class="chart-container">
          <canvas id="healthChart"></canvas>
        </div>
      </div>
    </section>

    <!-- Section Controls -->
    <div class="section-controls">
      <div class="tabs">
        <button class="tab-btn active" id="tabPagesBtn" onclick="switchTab('pages')">Internal Pages (${totalPages})</button>
        <button class="tab-btn" id="tabBrokenBtn" onclick="switchTab('broken')">Broken Links (${totalBroken})</button>
      </div>
      <div class="search-box">
        <input type="text" id="searchInput" placeholder="Filter URLs..." oninput="filterTables()">
      </div>
    </div>

    <!-- Pages Table -->
    <div id="pagesTableContainer" class="table-card">
      <table>
        <thead>
          <tr>
            <th style="width: 60px;">#</th>
            <th>Page URL</th>
            <th style="width: 220px;">Inbound Links</th>
          </tr>
        </thead>
        <tbody id="pagesTableBody">
          <!-- Populated by JS -->
        </tbody>
      </table>
    </div>

    <!-- Broken Links Table -->
    <div id="brokenTableContainer" class="table-card hidden">
      <table>
        <thead>
          <tr>
            <th>Broken URL</th>
            <th style="width: 140px;">Status</th>
            <th>Found On Page</th>
          </tr>
        </thead>
        <tbody id="brokenTableBody">
          <!-- Populated by JS -->
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const pagesData = ${JSON.stringify(sortedPages)};
    const brokenLinksData = ${JSON.stringify(brokenLinks)};
    const maxLinkCount = pagesData.length > 0 ? pagesData[0][1] : 1;

    // Initialize Charts
    function initCharts() {
      // Bar Chart for Top 10 Pages
      const top10 = pagesData.slice(0, 10);
      const ctxBar = document.getElementById('topPagesChart').getContext('2d');
      new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: top10.map(item => item[0].length > 30 ? '...' + item[0].slice(-27) : item[0]),
          datasets: [{
            label: 'Inbound Links',
            data: top10.map(item => item[1]),
            backgroundColor: '#3b82f6',
            borderRadius: 6,
            hoverBackgroundColor: '#60a5fa'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (tooltipItems) => top10[tooltipItems[0].dataIndex][0]
              }
            }
          },
          scales: {
            x: {
              ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
              grid: { color: '#1e293b' }
            }
          }
        }
      });

      // Health Doughnut Chart
      const ctxDonut = document.getElementById('healthChart').getContext('2d');
      const healthyCount = pagesData.length;
      const brokenCount = brokenLinksData.length;
      new Chart(ctxDonut, {
        type: 'doughnut',
        data: {
          labels: ['Healthy Pages', 'Broken Links'],
          datasets: [{
            data: [healthyCount, brokenCount],
            backgroundColor: ['#10b981', '#f43f5e'],
            borderColor: '#111827',
            borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, padding: 15 }
            }
          },
          cutout: '70%'
        }
      });
    }

    // Render Tables
    function renderPagesTable(filter = '') {
      const tbody = document.getElementById('pagesTableBody');
      const filtered = pagesData.filter(item => item[0].toLowerCase().includes(filter.toLowerCase()));

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No matching pages found</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map((item, index) => {
        const percent = Math.max(8, Math.round((item[1] / maxLinkCount) * 100));
        return \`
          <tr>
            <td style="color: #64748b; font-weight: 500;">\${index + 1}</td>
            <td class="url-cell">
              <a href="\${item[0].startsWith('http') ? item[0] : 'https://' + item[0]}" target="_blank" rel="noopener noreferrer">\${item[0]}</a>
            </td>
            <td>
              <span class="pill pill-blue">\${item[1]} links</span>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: \${percent}%;"></div>
              </div>
            </td>
          </tr>
        \`;
      }).join('');
    }

    function renderBrokenTable(filter = '') {
      const tbody = document.getElementById('brokenTableBody');
      const filtered = brokenLinksData.filter(item => 
        item.url.toLowerCase().includes(filter.toLowerCase()) || 
        item.sourceURL.toLowerCase().includes(filter.toLowerCase())
      );

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No broken links found 🎉</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(item => {
        const is404 = String(item.status).includes('404');
        const pillClass = is404 ? 'pill-red' : 'pill-amber';
        return \`
          <tr>
            <td class="url-cell" style="color: #fda4af;">\${item.url}</td>
            <td><span class="pill \${pillClass}">\${item.status}</span></td>
            <td class="url-cell" style="color: #94a3b8;">\${item.sourceURL}</td>
          </tr>
        \`;
      }).join('');
    }

    function switchTab(tab) {
      const pagesContainer = document.getElementById('pagesTableContainer');
      const brokenContainer = document.getElementById('brokenTableContainer');
      const tabPagesBtn = document.getElementById('tabPagesBtn');
      const tabBrokenBtn = document.getElementById('tabBrokenBtn');

      if (tab === 'pages') {
        pagesContainer.classList.remove('hidden');
        brokenContainer.classList.add('hidden');
        tabPagesBtn.classList.add('active');
        tabBrokenBtn.classList.remove('active');
      } else {
        pagesContainer.classList.add('hidden');
        brokenContainer.classList.remove('hidden');
        tabPagesBtn.classList.remove('active');
        tabBrokenBtn.classList.add('active');
      }
    }

    function filterTables() {
      const query = document.getElementById('searchInput').value;
      renderPagesTable(query);
      renderBrokenTable(query);
    }

    document.addEventListener('DOMContentLoaded', () => {
      initCharts();
      renderPagesTable();
      renderBrokenTable();
    });
  </script>
</body>
</html>`;
}

function writeHTMLReport(pages, brokenLinks, filename = "report.html", baseURL = "") {
  const htmlContent = generateHTMLReport(pages, brokenLinks, baseURL);
  fs.writeFileSync(filename, htmlContent, "utf-8");
  console.log(`Interactive HTML report generated: ${filename}`);
}

function sortPages(pages) {
  const pagesArr = Object.entries(pages);
  pagesArr.sort((a, b) => {
    const aHits = a[1];
    const bHits = b[1];
    return bHits - aHits;
  });
  return pagesArr;
}

module.exports = {
  sortPages,
  printReport,
  generateCSV,
  writeCSVReport,
  generateBrokenLinksCSV,
  writeBrokenLinksCSV,
  generateHTMLReport,
  writeHTMLReport,
};
