/**
 * Adzentra Ads - Professional Dashboard Logic (v2.3)
 * Features: Multi-Link Generation, Custom Alias, Global UI Sync, & Real-time Analytics
 */

// ১. স্মার্ট লিংক জেনারেশন (কাস্টম নাম ও মাল্টি-লিংক সাপোর্ট সহ)
async function handleLinkCreation() {
    const urlInput = document.getElementById('target-url');
    const aliasInput = document.getElementById('link-alias'); // HTML-এ এই আইডিটি থাকতে হবে
    const resultArea = document.getElementById('result-area'); 
    const finalLinkInput = document.getElementById('final-link'); 
    
    const originalUrl = urlInput.value.trim();
    let alias = aliasInput ? aliasInput.value.trim() : "";
    
    // ভ্যালিডেশন
    if(!originalUrl || !originalUrl.startsWith('http')) {
        return window.Telegram.WebApp.showAlert("❌ Please enter a valid Ad URL (starting with http/https)!");
    }

    // যদি ইউজার নাম না দেয়, তবে ডিফল্ট হিসেবে ১ থেকে ১০০০ এর মধ্যে একটি সংখ্যা দিবে
    if (!alias) {
        alias = Math.floor(Math.random() * 1000) + 1;
    }

    try {
        // ইউনিক শর্ট কোড জেনারেট (Tracking ID)
        const shortCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        const finalCode = `${shortCode}_${alias}`;
        
        // আপনার Vercel Backend URL
        const backendBaseURL = "https://adzentra-kworig5a4-md-tarek-s-projects.vercel.app/r/"; 
        const finalTrackingLink = backendBaseURL + finalCode;

        // সুপাবাস 'links' টেবিলে সেভ করা
        const { error } = await supabase
            .from('links')
            .insert([{ 
                original_url: originalUrl, 
                short_code: finalCode,
                publisher_id: currentUser.id,
                created_at: new Date()
            }]);

        if(error) throw error;

        // UI আপডেট ও এলার্ট
        if(resultArea) resultArea.style.display = 'block';
        if(finalLinkInput) finalLinkInput.value = finalTrackingLink;
        
        // ইনপুট রিসেট
        urlInput.value = "";
        if(aliasInput) aliasInput.value = "";

        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        window.Telegram.WebApp.showAlert("🚀 Smart Link Created Successfully!");

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
        
        // রেভিনিউ ক্যালকুলেশন
        const earningsToday = todayClicksArr.reduce((sum, c) => sum + parseFloat(c.publisher_share || 0), 0);
        
        // ৪. গ্লোবাল UI আপডেট
        updateText('balance-val', `$${parseFloat(profile.balance || 0).toFixed(4)}`);
        updateText('top-balance', `$${parseFloat(profile.balance || 0).toFixed(4)}`);
        updateText('p-balance', `$${parseFloat(profile.balance || 0).toFixed(4)}`);
        
        // ড্যাশবোর্ড কার্ডস আপডেট
        updateText('dash-imp', totalImpressions);
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
        if(!acc[date]) acc[date] = { imp: 0, rev: 0 };
        acc[date].imp += 1; 
        acc[date].rev += parseFloat(curr.publisher_share || 0);
        return acc;
    }, {});

    let html = '';
    const sortedDates = Object.keys(grouped).sort().reverse().slice(0, 7);

    sortedDates.forEach(date => {
        const row = grouped[date];
        const cpm = row.imp > 0 ? (row.rev / row.imp) * 1000 : 0;
        html += `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 12px 5px;">${date}</td>
                <td style="padding: 12px 5px;">${row.imp}</td>
                <td style="padding: 12px 5px;">${row.imp}</td> 
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
    copyText.setSelectionRange(0, 99999); // মোবাইলের জন্য
    navigator.clipboard.writeText(copyText.value);
    
    window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    window.Telegram.WebApp.showAlert("Link Copied to Clipboard! ✅");
}

// ৯. হেল্পার ফাংশন
function updateText(id, val) {
    const el = document.getElementById(id);
    if(el) el.innerText = val;
}

// ১০. অটো রিফ্রেশ (প্রতি ৩০ সেকেন্ডে)
setInterval(loadStats, 30000);
