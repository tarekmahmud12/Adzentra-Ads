/**
 * Adzentra Ads - Professional Dashboard Logic (v2.1)
 * Updated: Sidebar Support, Detailed Analytics, & Global UI Sync
 */

// ১. স্মার্ট লিংক জেনারেশন (উন্নত লজিক)
async function handleLinkCreation() {
    const urlInput = document.getElementById('target-url');
    const resultArea = document.getElementById('result-area'); // যদি থাকে
    const finalLinkInput = document.getElementById('final-link'); // যদি থাকে
    
    const originalUrl = urlInput.value.trim();
    
    if(!originalUrl || !originalUrl.startsWith('http')) {
        return window.Telegram.WebApp.showAlert("❌ Please enter a valid URL (starting with http/https)");
    }

    try {
        const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // আপনার Vercel/Backend URL
        const backendBaseURL = "https://your-vercel-app.vercel.app/r/"; 
        const finalSmartLink = backendBaseURL + shortCode;

        const { error } = await supabase
            .from('links')
            .insert([{ 
                original_url: originalUrl, 
                short_code: shortCode,
                publisher_id: currentUser.id,
                created_at: new Date()
            }]);

        if(error) throw error;

        // UI আপডেট ও এলার্ট
        if(resultArea) resultArea.style.display = 'block';
        if(finalLinkInput) finalLinkInput.value = finalSmartLink;
        
        urlInput.value = "";
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        window.Telegram.WebApp.showAlert("🚀 Smart Link Created!\n" + finalSmartLink);

    } catch (err) {
        console.error("Link Creation Error:", err.message);
        window.Telegram.WebApp.showAlert("Error: Could not save link.");
    }
}

// ২. ডাটাবেজ থেকে রিয়েল-টাইম স্ট্যাটাস এবং এনালাইটিক্স লোড করা
async function loadStats() {
    if (!currentUser) return;

    try {
        const today = new Date().toISOString().split('T')[0];

        // ক) আজকের এবং মোট ক্লিক ডাটা আনা
        const { data: statsData, error: statsError } = await supabase
            .from('clicks')
            .select('*')
            .eq('publisher_id', currentUser.id);

        // খ) প্রোফাইল ডাটা রিফ্রেশ করা
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (statsError || profileError) throw statsError || profileError;

        // ৩. ক্যালকুলেশন লজিক
        const todayClicksArr = statsData.filter(c => c.created_at.startsWith(today));
        const totalClicks = statsData.length;
        const todayClicks = todayClicksArr.length;
        const earningsToday = todayClicksArr.reduce((sum, c) => sum + parseFloat(c.publisher_share || 0), 0);
        
        // ৪. গ্লোবাল UI আপডেট (Sidebar, Header এবং সব সেকশন)
        updateText('balance-val', `$${parseFloat(profile.balance || 0).toFixed(4)}`);
        updateText('top-balance', `$${parseFloat(profile.balance || 0).toFixed(4)}`);
        updateText('p-balance', `$${parseFloat(profile.balance || 0).toFixed(4)}`);
        
        // ড্যাশবোর্ড কার্ডস
        updateText('today-clicks', todayClicks);
        updateText('total-clicks-val', totalClicks);
        updateText('lifetime-val', `$${parseFloat(profile.lifetime_earnings || 0).toFixed(2)}`);

        // প্রোফাইল সেকশন
        updateText('p-name', profile.full_name);
        updateText('p-id', profile.id);
        updateText('p-username', `@${profile.username || 'user'}`);

        // ৫. এনালাইটিক্স টেবিল আপডেট (Statistics Section)
        renderAnalyticsTable(statsData);

        // ৬. রেফারেল লিংক আপডেট
        const refLinkInput = document.getElementById('ref-link');
        if(refLinkInput) {
            refLinkInput.value = `https://t.me/AdzentraAdsBot?start=ref_${profile.id}`;
        }

    } catch (err) {
        console.error("Dashboard Sync Error:", err.message);
    }
}

// ৭. এনালাইটিক্স টেবিল রেন্ডারিং ফাংশন
function renderAnalyticsTable(data) {
    const tableBody = document.getElementById('analytics-table-body');
    if(!tableBody) return;

    // গ্রুপ ডাটা বাই ডেট (Date wise grouping)
    const grouped = data.reduce((acc, curr) => {
        const date = curr.created_at.split('T')[0];
        if(!acc[date]) acc[date] = { imp: 0, clicks: 0, rev: 0 };
        acc[date].imp += 1; // Assuming each row is an impression/click
        acc[date].clicks += curr.is_click ? 1 : 0;
        acc[date].rev += parseFloat(curr.publisher_share || 0);
        return acc;
    }, {});

    let html = '';
    Object.keys(grouped).sort().reverse().slice(0, 7).forEach(date => {
        const row = grouped[date];
        const cpm = row.imp > 0 ? (row.rev / row.imp) * 1000 : 0;
        html += `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 12px 5px;">${date}</td>
                <td style="padding: 12px 5px;">${row.imp}</td>
                <td style="padding: 12px 5px;">${row.clicks}</td>
                <td style="padding: 12px 5px;">$${cpm.toFixed(3)}</td>
                <td style="padding: 12px 5px; color: var(--success); font-weight:700;">$${row.rev.toFixed(4)}</td>
            </tr>
        `;
    });
    tableBody.innerHTML = html || '<tr><td colspan="5" style="text-align:center; padding:20px;">No Data Found</td></tr>';
}

// ৮. ক্লিপবোর্ড কপি (Haptic Feedback সহ)
function copyToClipboard(id) {
    const copyText = document.getElementById(id);
    if(!copyText) return;

    copyText.select();
    navigator.clipboard.writeText(copyText.value);
    
    window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    window.Telegram.WebApp.showAlert("Copied to Clipboard! ✅");
}

// ৯. হেল্পার ফাংশনসমূহ
function updateText(id, val) {
    const el = document.getElementById(id);
    if(el) el.innerText = val;
}

// ১০. অটো রিফ্রেশ (প্রতি ৩০ সেকেন্ডে)
setInterval(loadStats, 30000);
