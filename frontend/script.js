document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('year').textContent = new Date().getFullYear();

    const DEFAULT_MONTHS = ["January", "February", "March", "April", "May", "June"];
    
    let salesChartInstance = null;
    
    let records = [
        { month: "January", unitsSold: 120, costPricePerUnit: 50, sellingPricePerUnit: 75 },
        { month: "February", unitsSold: 150, costPricePerUnit: 52, sellingPricePerUnit: 78 },
        { month: "March", unitsSold: 140, costPricePerUnit: 51, sellingPricePerUnit: 76 },
    ];

    const tbody = document.getElementById('salesTableBody');
    const addRowBtn = document.getElementById('addRowBtn');
    const salesForm = document.getElementById('salesForm');
    const submitBtn = document.getElementById('submitBtn');

    function renderTable() {
        tbody.innerHTML = '';
        records.forEach((record, index) => {
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td>
                    <input type="text" value="${record.month}" data-index="${index}" data-field="month">
                </td>
                <td>
                    <input type="number" value="${record.unitsSold}" data-index="${index}" data-field="unitsSold">
                </td>
                <td>
                    <input type="number" value="${record.costPricePerUnit}" data-index="${index}" data-field="costPricePerUnit">
                </td>
                <td>
                    <input type="number" value="${record.sellingPricePerUnit}" data-index="${index}" data-field="sellingPricePerUnit">
                </td>
                <td style="text-align: right;">
                    <button type="button" class="btn-icon delete-btn" data-index="${index}" ${records.length <= 1 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add event listeners
        document.querySelectorAll('#salesTableBody input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                const val = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
                records[index][field] = val;
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                if (records.length > 1) {
                    records.splice(index, 1);
                    renderTable();
                }
            });
        });
    }

    addRowBtn.addEventListener('click', () => {
        const nextMonthIndex = records.length % 12;
        const lastRecord = records[records.length - 1];
        
        records.push({
            month: DEFAULT_MONTHS[nextMonthIndex] || `Month ${records.length + 1}`,
            unitsSold: lastRecord ? lastRecord.unitsSold : 100,
            costPricePerUnit: lastRecord ? lastRecord.costPricePerUnit : 50,
            sellingPricePerUnit: lastRecord ? lastRecord.sellingPricePerUnit : 70,
        });
        renderTable();
    });

    // File Upload Logic
    const uploadBtn = document.getElementById('uploadBtn');
    const fileUpload = document.getElementById('fileUpload');

    if (uploadBtn && fileUpload) {
        uploadBtn.addEventListener('click', () => fileUpload.click());

        fileUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = evt.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    
                    if (json.length > 0) {
                        records = json.map(row => {
                            // Try to intelligently map columns even if names slightly differ
                            const getVal = (possibleKeys, def) => {
                                const key = Object.keys(row).find(k => possibleKeys.some(p => k.toLowerCase().includes(p)));
                                return key ? row[key] : def;
                            };

                            return {
                                month: getVal(['month', 'date', 'period'], 'Unknown'),
                                unitsSold: parseFloat(getVal(['unit', 'sold', 'qty', 'quantity'], 0)) || 0,
                                costPricePerUnit: parseFloat(getVal(['cost', 'cogs', 'buying'], 0)) || 0,
                                sellingPricePerUnit: parseFloat(getVal(['sell', 'price', 'revenue'], 0)) || 0
                            };
                        });
                        renderTable();
                    }
                } catch (err) {
                    console.error("Error parsing file:", err);
                    alert("Could not parse file. Please ensure it's a valid CSV or Excel file with Month, Units Sold, Cost Price, and Selling Price columns.");
                }
                // Reset file input
                fileUpload.value = '';
            };
            reader.readAsBinaryString(file);
        });
    }

    const formatCurrency = (val) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val);

    salesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        submitBtn.disabled = true;
        submitBtn.textContent = "Analyzing...";
        
        const emptyState = document.getElementById('emptyState');
        const resultsDashboard = document.getElementById('resultsDashboard');
        const aiLoader = document.getElementById('aiLoader');
        const aiText = document.getElementById('aiText');
        const aiAnalysisCard = document.getElementById('aiAnalysisCard');
        
        // Show dashboard immediately with loading state for AI
        emptyState.classList.add('hidden');
        resultsDashboard.classList.remove('hidden');
        aiText.textContent = '';
        aiLoader.classList.remove('hidden');
        
        try {
            const apiUrl = "/api/predict";
            
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ records })
            });

            if (!response.ok) throw new Error("Failed to fetch prediction");
            
            const result = await response.json();
            
            // Update Dashboard metrics
            document.getElementById('predUnits').textContent = result.predictedUnits;
            document.getElementById('predRevenue').textContent = formatCurrency(result.totalRevenue);
            document.getElementById('predCost').textContent = formatCurrency(result.totalCost);
            
            const profitValue = Math.abs(result.profitOrLoss);
            document.getElementById('predProfit').textContent = formatCurrency(profitValue);
            
            const profitCard = document.getElementById('profitCard');
            const profitLabel = document.getElementById('profitLabel');
            const profitSubtitle = document.getElementById('profitSubtitle');
            const profitIcon = document.getElementById('profitIcon');
            const predProfit = document.getElementById('predProfit');
            
            const aiTitleText = document.getElementById('aiTitleText');
            const aiBadge = document.getElementById('aiBadge');
            const aiIcon = document.getElementById('aiIcon');

            if (result.isLoss) {
                profitLabel.textContent = "Estimated Loss";
                profitSubtitle.textContent = "Need strategy review";
                profitIcon.className = "metric-icon red";
                profitIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>`;
                predProfit.classList.add('text-danger');
                
                aiAnalysisCard.className = "glass-card ai-card danger-bg";
                aiTitleText.textContent = "AI Loss Analysis";
                aiTitleText.classList.add('text-danger');
                aiBadge.className = "badge danger";
                aiIcon.classList.add('text-danger');
                aiIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
            } else {
                profitLabel.textContent = "Estimated Profit";
                profitSubtitle.textContent = "Healthy growth";
                profitIcon.className = "metric-icon green";
                profitIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`;
                predProfit.classList.remove('text-danger');
                
                aiAnalysisCard.className = "glass-card ai-card success-bg";
                aiTitleText.textContent = "Strategic Insights";
                aiTitleText.classList.remove('text-danger');
                aiBadge.className = "badge default";
                aiIcon.classList.remove('text-danger');
                aiIcon.classList.add('text-primary');
                aiIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="22" y1="12" x2="9" y2="12"/></svg>`;
            }
            
            // Update Chart
            if (salesChartInstance) {
                salesChartInstance.destroy();
            }
            
            const ctx = document.getElementById('salesChart').getContext('2d');
            const allLabels = [...result.historicalLabels, result.predictedLabel];
            const allData = [...result.historicalData, result.predictedUnits];
            
            const pointColors = result.historicalData.map(() => '#3b82f6');
            pointColors.push(result.isLoss ? '#ef4444' : '#22c55e');

            salesChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: allLabels,
                    datasets: [{
                        label: 'Units Sold',
                        data: allData,
                        backgroundColor: pointColors,
                        borderRadius: 4,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });

            aiLoader.classList.add('hidden');
            if (result.aiAnalysis) {
                aiText.innerHTML = marked.parse(result.aiAnalysis);
            } else {
                aiText.textContent = "Analysis not available.";
            }
            
        } catch (error) {
            console.error("Prediction API failed:", error);
            alert("Error connecting to server. Make sure the backend is running on port 8000.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Generate Prediction";
        }
    });

    // Logout Handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/login.html';
            } catch (error) {
                console.error("Logout failed:", error);
            }
        });
    }

    // Navigation Handler
    const navDashboard = document.getElementById('navDashboard');
    const navReports = document.getElementById('navReports');
    const navHistory = document.getElementById('navHistory');
    const dashboardSection = document.getElementById('dashboardSection');
    const reportsSection = document.getElementById('reportsSection');
    const historySection = document.getElementById('historySection');
    const featuresSection = document.getElementById('featuresSection');

    function switchTab(tab) {
        if(navDashboard) navDashboard.classList.remove('active');
        if(navReports) navReports.classList.remove('active');
        if(navHistory) navHistory.classList.remove('active');
        
        if(dashboardSection) dashboardSection.classList.add('hidden');
        if(reportsSection) reportsSection.classList.add('hidden');
        if(historySection) historySection.classList.add('hidden');
        if(featuresSection) featuresSection.classList.add('hidden');

        if (tab === 'reports') {
            if(navReports) navReports.classList.add('active');
            if(reportsSection) reportsSection.classList.remove('hidden');
            generateDetailedReport();
        } else if (tab === 'history') {
            if(navHistory) navHistory.classList.add('active');
            if(historySection) historySection.classList.remove('hidden');
            fetchAndRenderHistory();
        } else {
            if(navDashboard) navDashboard.classList.add('active');
            if(dashboardSection) dashboardSection.classList.remove('hidden');
            if(featuresSection) featuresSection.classList.remove('hidden');
        }
    }

    if (navReports) {
        navReports.addEventListener('click', (e) => { e.preventDefault(); switchTab('reports'); });
        navDashboard.addEventListener('click', (e) => { e.preventDefault(); switchTab('dashboard'); });
        if (navHistory) navHistory.addEventListener('click', (e) => { e.preventDefault(); switchTab('history'); });
    }

    async function fetchAndRenderHistory() {
        const historyContainer = document.getElementById('historyTableContainer');
        historyContainer.innerHTML = '<div class="skeleton-loader"><div class="skeleton-line" style="height:40px;width:100%"></div></div>';
        
        try {
            const res = await fetch('/api/history');
            if (!res.ok) throw new Error("Failed to fetch history");
            const data = await res.json();
            
            if (data.history.length === 0) {
                historyContainer.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--text-muted);">No history available yet.</p>';
                return;
            }

            let tableHTML = `<table style="width: 100%; text-align: left; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="padding: 10px; border-bottom: 2px solid hsl(var(--border));">ID</th>
                        <th style="padding: 10px; border-bottom: 2px solid hsl(var(--border));">Predicted Units</th>
                        <th style="padding: 10px; border-bottom: 2px solid hsl(var(--border));">Revenue</th>
                        <th style="padding: 10px; border-bottom: 2px solid hsl(var(--border));">Outcome</th>
                    </tr>
                </thead>
                <tbody>`;
                
            data.history.forEach(item => {
                const color = item.is_loss ? "hsl(var(--danger))" : "hsl(var(--success))";
                const label = item.is_loss ? "Loss" : "Profit";
                
                tableHTML += `
                    <tr>
                        <td style="padding: 12px 10px; border-bottom: 1px solid hsl(var(--border) / 0.5);">#${item.id}</td>
                        <td style="padding: 12px 10px; border-bottom: 1px solid hsl(var(--border) / 0.5);">${item.predicted_units}</td>
                        <td style="padding: 12px 10px; border-bottom: 1px solid hsl(var(--border) / 0.5);">${formatCurrency(item.total_revenue)}</td>
                        <td style="padding: 12px 10px; border-bottom: 1px solid hsl(var(--border) / 0.5); font-weight: bold; color: ${color};">${label}</td>
                    </tr>`;
            });
            
            tableHTML += `</tbody></table>`;
            historyContainer.innerHTML = tableHTML;

        } catch (error) {
            console.error(error);
            historyContainer.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--danger);">Error loading history.</p>';
        }
    }

    function generateDetailedReport() {
        const reportsEmptyState = document.getElementById('reportsEmptyState');
        const reportsContent = document.getElementById('reportsContent');
        const reportsTableContainer = document.getElementById('reportsTableContainer');
        const reportsSummaryGrid = document.getElementById('reportsSummaryGrid');
        
        if (!records || records.length === 0 || document.getElementById('emptyState').classList.contains('hidden') === false) {
            reportsEmptyState.classList.remove('hidden');
            reportsContent.classList.add('hidden');
            return;
        }
        
        reportsEmptyState.classList.add('hidden');
        reportsContent.classList.remove('hidden');
        
        let tableHTML = `<table style="width: 100%; text-align: left; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="padding: 10px; border-bottom: 2px solid hsl(var(--border)); color: hsl(var(--text-muted)); font-weight: 500;">Month</th>
                    <th style="padding: 10px; border-bottom: 2px solid hsl(var(--border)); color: hsl(var(--text-muted)); font-weight: 500;">Units Sold</th>
                    <th style="padding: 10px; border-bottom: 2px solid hsl(var(--border)); color: hsl(var(--text-muted)); font-weight: 500;">Revenue</th>
                    <th style="padding: 10px; border-bottom: 2px solid hsl(var(--border)); color: hsl(var(--text-muted)); font-weight: 500;">MoM Growth</th>
                </tr>
            </thead>
            <tbody>`;
            
        let totalRev = 0;
        let prevUnits = 0;
        let bestMonth = { month: "", units: 0 };
        let worstMonth = { month: "", units: Infinity };
        
        records.forEach((r, idx) => {
            const rev = r.unitsSold * r.sellingPricePerUnit;
            totalRev += rev;
            
            let growthStr = "-";
            if (idx > 0) {
                const diff = r.unitsSold - prevUnits;
                const percent = prevUnits > 0 ? ((diff / prevUnits) * 100).toFixed(1) : 0;
                const color = diff >= 0 ? "hsl(var(--success))" : "hsl(var(--danger))";
                const sign = diff > 0 ? "+" : "";
                growthStr = `<span style="color: ${color}; font-weight: 600;">${sign}${diff} units (${sign}${percent}%)</span>`;
            }
            
            if (r.unitsSold > bestMonth.units) { bestMonth = { month: r.month, units: r.unitsSold }; }
            if (r.unitsSold < worstMonth.units) { worstMonth = { month: r.month, units: r.unitsSold }; }
            
            tableHTML += `
                <tr>
                    <td style="padding: 12px 10px; border-bottom: 1px solid hsl(var(--border) / 0.5);">${r.month}</td>
                    <td style="padding: 12px 10px; border-bottom: 1px solid hsl(var(--border) / 0.5);">${r.unitsSold}</td>
                    <td style="padding: 12px 10px; border-bottom: 1px solid hsl(var(--border) / 0.5);">${formatCurrency(rev)}</td>
                    <td style="padding: 12px 10px; border-bottom: 1px solid hsl(var(--border) / 0.5);">${growthStr}</td>
                </tr>`;
            
            prevUnits = r.unitsSold;
        });
        
        tableHTML += `</tbody></table>`;
        reportsTableContainer.innerHTML = tableHTML;
        
        const avgUnits = records.length > 0 ? (records.reduce((acc, r) => acc + r.unitsSold, 0) / records.length).toFixed(0) : 0;
        
        reportsSummaryGrid.innerHTML = `
            <div class="metric-card">
                <span class="metric-title">Best Performing Month</span>
                <h4 class="metric-value">${bestMonth.month}</h4>
                <span class="metric-subtitle">${bestMonth.units} units sold</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">Lowest Performing Month</span>
                <h4 class="metric-value">${worstMonth.month}</h4>
                <span class="metric-subtitle">${worstMonth.units} units sold</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">Average Monthly Sales</span>
                <h4 class="metric-value">${avgUnits}</h4>
                <span class="metric-subtitle">Units per month</span>
            </div>
            <div class="metric-card">
                <span class="metric-title">Total Historical Revenue</span>
                <h4 class="metric-value" style="color: hsl(var(--primary));">${formatCurrency(totalRev)}</h4>
                <span class="metric-subtitle">Sum of all months</span>
            </div>
        `;
        
        let growthMonths = 0;
        let declineMonths = 0;
        records.forEach((r, idx) => {
            if (idx > 0) {
                const prev = records[idx-1].unitsSold;
                if (r.unitsSold > prev) growthMonths++;
                if (r.unitsSold < prev) declineMonths++;
            }
        });
        
        const reportsTextContainer = document.getElementById('reportsTextContainer');
        if (reportsTextContainer) {
            reportsTextContainer.innerHTML = `
                <p>Based on the historical data provided, the business generated a total revenue of <strong>${formatCurrency(totalRev)}</strong> over ${records.length} months.</p>
                <p>The highest sales volume was achieved in <strong>${bestMonth.month}</strong> with <strong>${bestMonth.units} units</strong> sold, while the lowest was in <strong>${worstMonth.month}</strong> with <strong>${worstMonth.units} units</strong>.</p>
                <p>Looking at month-over-month performance, the business experienced growth in <strong>${growthMonths}</strong> transitions and decline in <strong>${declineMonths}</strong> transitions. The average sales volume stabilized at approximately <strong>${avgUnits} units</strong> per month.</p>
                <p>This comprehensive view helps identify seasonal trends and overall business trajectory. Use the dashboard's AI insights to understand the strategic impact of these numbers on your future predictions.</p>
            `;
        }
    }

    // Initial render
    renderTable();
});
