/**
 * Adzentra Ads - Professional Analytics Engine
 * Updated for: Daily Performance Table, GEO tracking & Multi-Device Sync
 */

// ১. মেইন অ্যানালিটিক্স লোডার
async function loadFullAnalytics() {
    if (!currentUser) return;

    // লোডিং অবস্থা দেখানো (ঐচ্ছিক)
    const tableBody = document.getElementById('analytics-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Loading Data...</td></tr>';

    try {
        // সুপাবাস থেকে সকল ডাটা আনা
        const { data: analyticsData, error } = await supabase
            .from('clicks')
            .select('*')
            .eq('publisher_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // ডাটা প্রসেস করা
        const stats = processAnalytics(analyticsData);

        // UI আপডেট করা (নতুন HTML আইডি অনুযায়ী)
        renderDailyTable(stats.daily);
        updateTopStats(stats.totals);
        
        // যদি এক্সট্রা সেকশন থাকে (GEO/Device)
        if(document.getElementById('geo-table-body')) renderGeoTable(stats.geo);

    } catch (err) {
        console.error("Analytics Load Error:", err.message);
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--danger);">Failed to load statistics.</td></tr>';
    }
}

// ২. ডাটা প্রসেসিং ফাংশন
function processAnalytics(data) {
    const daily = {};
    const geo = {};
    const totals = { impressions: data.length, clicks: 0, revenue: 0 };

    data.forEach(item => {
        // তারিখ বের করা
        const date = item.created_at.split('T')[0];
        const rev = parseFloat(item.publisher_share || 0);
        const isClick = item.is_click || false;

        // Daily Performance ক্যালকুলেশন
        if (!daily[date]) daily[date] = { imp: 0, clicks: 0, revenue: 0 };
        daily[date].imp++;
        if (isClick) daily[date].clicks++;
        daily[date].revenue += rev;

        // GEO Stats
        const country = item.country_code || 'Unknown';
        if (!geo[country]) geo[country] = { clicks: 0, revenue: 0 };
        if (isClick) geo[country].clicks++;
        geo[country].revenue += rev;

        // Totals update
        if (isClick) totals.clicks++;
        totals.revenue += rev;
    });

    return { daily, geo, totals };
}

// ৩. Daily Performance টেবিল রেন্ডার (আপনার নতুন HTML কোড অনুযায়ী)
function renderDailyTable(dailyData) {
    const tableBody = document.getElementById('analytics-table-body');
    if (!tableBody) return;

    let html = '';
    // তারিখ অনুযায়ী ডিসেন্ডিং অর্ডারে সাজানো (নতুনগুলো আগে)
    const sortedDates = Object.keys(dailyData).sort().reverse();

    sortedDates.forEach(date => {
        const row = dailyData[date];
        // CPM ক্যালকুলেশন: (Revenue / Impressions) * 1000
        const cpm = row.imp > 0 ? (row.revenue / row.imp * 1000).toFixed(3) : "0.000";
        
        html += `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 12px 5px;">${date}</td>
                <td style="padding: 12px 5px;">${row.imp}</td>
                <td style="padding: 12px 5px;">${row.clicks}</td>
                <td style="padding: 12px 5px;">$${cpm}</td>
                <td style="padding: 12px 5px; color: var(--success); font-weight:700;">$${row.revenue.toFixed(4)}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = html || '<tr><td colspan="5" style="text-align:center; padding:20px;">No data found for the selected period.</td></tr>';
}

// ৪. অ্যানালিটিক্স সেকশনের উপরের কার্ডগুলো আপডেট করা
function updateTopStats(totals) {
    // ড্যাশবোর্ড এবং অ্যানালিটিক্স সেকশনের টপ কার্ড সিঙ্ক
    document.querySelectorAll('#total-imp-val, .analytics-imp-card').forEach(el => el.innerText = totals.impressions);
    document.querySelectorAll('#total-click-val, .analytics-click-card').forEach(el => el.innerText = totals.clicks);
}

// ৫. জিও টেবিল রেন্ডার (যদি থাকে)
function renderGeoTable(geoData) {
    const geoBody = document.getElementById('geo-table-body');
    if (!geoBody) return;

    let html = '';
    Object.keys(geoData).forEach(country => {
        const item = geoData[country];
        html += `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 12px 5px;">📍 ${country}</td>
                <td style="padding: 12px 5px;">${item.clicks}</td>
                <td style="padding: 12px 5px; color: var(--success);">$${item.revenue.toFixed(4)}</td>
            </tr>
        `;
    });
    geoBody.innerHTML = html;
}

// ৬. সেকশন সুইচ হলে অটো লোড করার লজিক
// এটি আপনার showSection() ফাংশন থেকে কল হওয়া উচিত
function onAnalyticsSectionOpen() {
    loadFullAnalytics();
}

// ইনিশিয়াল কল
document.addEventListener('DOMContentLoaded', () => {
    // যদি সরাসরি ইউজার এনালাইটিক্স পেজে থাকে
    if (document.getElementById('analytics-section')?.classList.contains('active-section')) {
        loadFullAnalytics();
    }
});
