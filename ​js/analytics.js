/**
 * Adzentra Ads - Professional Analytics Engine
 * Updated for: Firebase Firestore Architecture, GEO tracking & Multi-Device Sync
 */

// ১. মেইন অ্যানালিটিক্স লোডার (ফায়ারস্টোর ভার্সন)
async function loadFullAnalytics() {
    if (!currentUser) return;

    // ডাটা রেন্ডার হওয়ার আগে লোডিং অবস্থা দেখানো
    const tableBody = document.getElementById('analytics-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color: var(--text-dim);">Loading Secure Analytics Data...</td></tr>';

    try {
        // ফায়ারস্টোরের 'rewards' কালেকশন থেকে কারেন্ট ইউজারের রিয়েল রেভিনিউ লগ ফিল্টার করে আনা
        const snapshot = await db.collection('rewards')
            .where('publisherId', '==', String(currentUser.id))
            .get();

        const analyticsData = [];
        snapshot.forEach(doc => {
            analyticsData.push(doc.data());
        });

        // ফায়ারস্টোর থেকে প্রাপ্ত অরিজিনাল ডাটা প্রসেস করা
        const stats = processAnalytics(analyticsData);

        // UI টেবিল এবং কার্ডগুলো রিয়েল ডাটা দ্বারা আপডেট করা
        renderDailyTable(stats.daily);
        updateTopStats(stats.totals);
        
        // যদি এক্সট্রা সেকশন থাকে (GEO/Country)
        if (document.getElementById('geo-table-body')) {
            renderGeoTable(stats.geo);
        }

    } catch (err) {
        console.error("Analytics Load Error:", err.message);
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--danger);">Failed to sync live statistics.</td></tr>';
    }
}

// ২. ডাটা প্রসেসিং ফাংশন (ফায়ারস্টোর টাইমস্ট্যাম্প ফ্রেন্ডলি)
function processAnalytics(data) {
    const daily = {};
    const geo = {};
    const totals = { impressions: data.length, clicks: data.length, revenue: 0 }; // প্রতি রিওয়ার্ড বা অ্যাকশন ১টি ইমপ্রেশন ও ক্লিক কাউন্ট করে

    data.forEach(item => {
        // ফায়ারস্টোর সার্ভার টাইমস্ট্যাম্প থেকে ডেট ফরম্যাট (YYYY-MM-DD) বের করা
        let date = 'Today';
        if (item.completedAt && item.completedAt.seconds) {
            date = new Date(item.completedAt.seconds * 1000).toISOString().split('T')[0];
        }
        
        const rev = parseFloat(item.amount || 0);

        // Daily Performance ক্যালকুলেশন
        if (!daily[date]) daily[date] = { imp: 0, clicks: 0, revenue: 0 };
        daily[date].imp++;
        daily[date].clicks++;
        daily[date].revenue += rev;

        // GEO/Country Stats ট্র্যাকিং (ডিফল্ট গ্লোবাল ট্রাফিক 'Global Channel' হিসেবে ট্র্যাক হবে)
        const country = item.country || 'Global Traffic';
        if (!geo[country]) geo[country] = { clicks: 0, revenue: 0 };
        geo[country].clicks++;
        geo[country].revenue += rev;

        // টোটাল রেভিনিউ যোগ করা
        totals.revenue += rev;
    });

    return { daily, geo, totals };
}

// ৩. Daily Performance টেবিল রেন্ডার
function renderDailyTable(dailyData) {
    const tableBody = document.getElementById('analytics-table-body');
    if (!tableBody) return;

    let html = '';
    // তারিখ অনুযায়ী ডিসেন্ডিং অর্ডারে সাজানো (লেটেস্ট ডাটা উপরে থাকবে)
    const sortedDates = Object.keys(dailyData).sort().reverse().slice(0, 30); // সর্বোচ্চ শেষ ৩০ দিন দেখাবে

    sortedDates.forEach(date => {
        const row = dailyData[date];
        // CPM ক্যালকুলেশন: (Revenue / Impressions) * 1000
        const cpm = row.imp > 0 ? (row.revenue / row.imp * 1000).toFixed(3) : "0.000";
        
        html += `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                <td style="padding: 12px 5px;">${date}</td>
                <td style="padding: 12px 5px;">${row.imp}</td>
                <td style="padding: 12px 5px;">${row.clicks}</td>
                <td style="padding: 12px 5px;">$${cpm}</td>
                <td style="padding: 12px 5px; color: var(--success); font-weight:700;">$${row.revenue.toFixed(4)}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = html || '<tr><td colspan="5" style="text-align:center; padding:20px; color: var(--text-dim);">No performance log found for this user.</td></tr>';
}

// ৪. অ্যানালিটিক্স সেকশনের উপরের কার্ডগুলো আপডেট করা (রিয়েল-টাইম কাউন্ট)
function updateTopStats(totals) {
    // ড্যাশবোর্ড এবং অ্যানালিটিক্স সেকশনের টপ ইমপ্রেশন ও ক্লিক কার্ড সিঙ্ক
    document.querySelectorAll('#total-imp-val, .analytics-imp-card').forEach(el => {
        el.innerText = totals.impressions;
    });
    document.querySelectorAll('#total-click-val, .analytics-click-card').forEach(el => {
        el.innerText = totals.clicks;
    });
}

// ৫. জিও/কান্ট্রি টেবিল রেন্ডার
function renderGeoTable(geoData) {
    const geoBody = document.getElementById('geo-table-body');
    if (!geoBody) return;

    let html = '';
    Object.keys(geoData).forEach(country => {
        const item = geoData[country];
        html += `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                <td style="padding: 12px 5px;">📍 ${country}</td>
                <td style="padding: 12px 5px;">${item.clicks}</td>
                <td style="padding: 12px 5px; color: var(--success); font-weight:700;">$${item.revenue.toFixed(4)}</td>
            </tr>
        `;
    });
    geoBody.innerHTML = html;
}

// ৬. সেকশন সুইচ হলে অটো লোড করার লজিক (এটি app.js এর showSection ফাংশন থেকে কল করা হয়েছে)
function onAnalyticsSectionOpen() {
    loadFullAnalytics();
}

// ইনিশিয়াল ডম লোডার কল
document.addEventListener('DOMContentLoaded', () => {
    // ২ সেকেন্ড পর চেক করবে যদি ডাইরেক্ট অ্যানালিটিক্স সেকশনে থাকে
    setTimeout(() => {
        if (document.getElementById('analytics-section')?.style.display === 'block') {
            loadFullAnalytics();
        }
    }, 2000);
});
