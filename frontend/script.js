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
                type: 'line',
                data: {
                    labels: allLabels,
                    datasets: [{
                        label: 'Units Sold',
                        data: allData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        pointBackgroundColor: pointColors,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        fill: true,
                        segment: {
                            borderDash: ctx => ctx.p0DataIndex === allData.length - 2 ? [5, 5] : undefined
                        }
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
            aiText.textContent = result.aiAnalysis || "Analysis not available.";
            
        } catch (error) {
            console.error("Prediction API failed:", error);
            alert("Error connecting to server. Make sure the backend is running on port 8000.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Generate Prediction";
        }
    });

    // Initial render
    renderTable();
});
