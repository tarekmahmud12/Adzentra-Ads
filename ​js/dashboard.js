/**
 * Adzentra Ads - Professional Dashboard Logic (v2.2)
 * Tracking Layer Integration & Global UI Sync
 */

// ১. স্মার্ট লিংক জেনারেশন (উন্নত ট্র্যাকিং লজিক যুক্ত)
async function handleLinkCreation() {
    const urlInput = document.getElementById('target-url');
    const resultArea = document.getElementById('result-area'); 
    const finalLinkInput = document.getElementById('final-link'); 
    
    const originalUrl = urlInput.value.trim();
    
    // ভ্যালিডেশন: এখানে পাবলিশার তার Monetag/Adsterra স্মার্ট লিঙ্ক দিবে
    if(!originalUrl || !originalUrl.startsWith('http')) {
        return window.Telegram.WebApp.showAlert("❌ Please enter a valid Ad URL!");
    }

    try {
        // ইউনিক শর্ট কোড জেনারেট (Tracking ID)
        const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // আপনার Vercel Backend URL (যেখানে ভিজিটর প্রথমে হিট করবে)
        // উদাহরণ: https://adzentra-api.vercel.app/r/
        const backendBaseURL = "https://your-vercel-app.vercel.app/r/"; 
        const finalTrackingLink = backendBaseURL + shortCode;

        // সুপাবাস 'links' টেবিলে সেভ করা
        const { error } = await supabase
            .from('links')
            .insert([{ 
                original_url: originalUrl, // এটিই আপনার Advertiser Link (Monetag/Adsterra)
                short_code: shortCode,
                publisher_id: currentUser.id,
                created_at: new Date()
            }]);

        if(error) throw error;

        // UI আপডেট
        if(resultArea) resultArea.style.display = 'block';
        if(finalLinkInput) finalLinkInput.value = finalTrackingLink;
        
        urlInput.value = "";
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        window.Telegram.WebApp.showAlert("🚀 Tracking Link Created!\nShare this link to earn.");

    } catch (err) {
        console.error("Link Creation Error:", err.message);
        window.Telegram.WebApp.showAlert("Error: Could not save tracking link.");
    }
}

// ২. ডাটাবেজ থেকে রিয়েল-টাইম স্ট্যাটাস এবং এনালাইটিক্স লোড করা
async function loadStats() {
    if (!currentUser) return;

    try {
        const today = new Date().toISOString().split('T')[0];

        // ক) 'clicks' টেবিল থেকে পাবলিশারের সব ট্রাফিক ডাটা আনা
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
        const todayClicksArr = statsData ? statsData.filter(c => c.created_at.startsWith(today)) : [];
        const totalImpressions = statsData ? statsData.length : 0;
        const todayImpressions = todayClicksArr.length;
        
        // রেভিনিউ ক্যালকুলেশন (পাবলিশার শেয়ার এর যোগফল)
        const earningsToday = todayClicksArr.reduce((sum, c) => sum + parseFloat(c.publisher_share || 0), 0);
        
        // ৪. গ্লোবাল UI আপডেট
        updateText('balance-val', `$${parseFloat(profile.balance || 0).toFixed(4)}`);
        updateText('top-balance', `$${parseFloat(profile.balance || 0).toFixed(4)}`);
        updateText('p-balance', `$${parseFloat(profile.balance || 0).toFixed(4)}`);
        
        // ড্যাশবোর্ড কার্ডস আপডেট
        updateText('dash-imp', totalImpressions); // Impressions/Total Clicks
        updateText('today-imp', todayImpressions); 
        updateText('lifetime-val', `$${parseFloat(profile.lifetime_earnings || 0).toFixed(2)}`);

        // প্রোফাইল সেকশন
        updateText('p-name', profile.full_name);
        updateText('p-id', profile.id);
        updateText('p-username', `@${profile.username || 'user'}`);

        // ৫. এনালাইটিক্স টেবিল রেন্ডার
        renderAnalyticsTable(statsData || []);

    } catch (err) {
        console.error("Dashboard Sync Error:", err.message);
    }
}

// ৭. এনালাইটিক্স টেবিল রেন্ডারিং
function renderAnalyticsTable(data) {
    const tableBody = document.getElementById('analytics-table-body');
    if(!tableBody) return;

    const grouped = data.reduce((acc, curr) => {
        const date = curr.created_at.split('T')[0];
        if(!acc[date]) acc[date] = { imp: 0, clicks: 0, rev: 0 };
        acc[date].imp += 1; 
        acc[date].rev += parseFloat(curr.publisher_share || 0);
        return acc;
    }, {});

    let html = '';
    Object.keys(grouped).sort().reverse().slice(0, 7).forEach(date => {
        const row = grouped[date];
        const cpm = row.imp > 0 ? (row.rev / row.imp) * 1000 : 0;
        html += `
            <tr>
                <td>${date}</td>
                <td>${row.imp}</td>
                <td>${row.imp}</td> <td>$${cpm.toFixed(3)}</td>
                <td style="color: var(--success); font-weight:700;">$${row.rev.toFixed(4)}</td>
            </tr>
        `;
    });
    tableBody.innerHTML = html || '<tr><td colspan="5" style="text-align:center; padding:20px;">No Data Found</td></tr>';
}

// ৮. ক্লিপবোর্ড কপি
function copyToClipboard(id) {
    const copyText = document.getElementById(id);
    if(!copyText) return;
    copyText.select();
    navigator.clipboard.writeText(copyText.value);
    window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    window.Telegram.WebApp.showAlert("Link Copied! 📋");
}

function updateText(id, val) {
    const el = document.getElementById(id);
    if(el) el.innerText = val;
}

setInterval(loadStats, 30000);
