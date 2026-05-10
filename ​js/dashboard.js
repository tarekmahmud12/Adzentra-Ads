/**
 * Adzentra Ads - Professional Dashboard Logic (v2.0)
 * Features: Smart Link, Real-time Stats, Fraud Check, Referral System, & Geo-Analytics
 */

// ১. স্মার্ট লিংক জেনারেশন (উন্নত লজিক)
async function handleLinkCreation() {
    const urlInput = document.getElementById('target-url');
    const resultArea = document.getElementById('result-area');
    const finalLinkInput = document.getElementById('final-link');
    
    const originalUrl = urlInput.value.trim();
    
    if(!originalUrl || !originalUrl.startsWith('http')) {
        return window.Telegram.WebApp.showAlert("❌ Please enter a valid URL (starting with http/https)");
    }

    try {
        // ৬ অক্ষরের ইউনিক শর্ট কোড
        const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // আপনার Vercel/Backend এর মেইন URL (এটাই পাবলিশার শেয়ার করবে)
        const backendBaseURL = "https://your-vercel-app.vercel.app/r/"; 
        const finalSmartLink = backendBaseURL + shortCode;

        // সুপাবাসে ডাটা সেভ
        const { error } = await supabase
            .from('links')
            .insert([{ 
                original_url: originalUrl, 
                short_code: shortCode,
                publisher_id: currentUser.id,
                created_at: new Date()
            }]);

        if(error) throw error;

        // UI আপডেট
        resultArea.style.display = 'block';
        finalLinkInput.value = finalSmartLink;
        urlInput.value = "";
        
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        window.Telegram.WebApp.showAlert("🚀 Smart Link Created Successfully!");

    } catch (err) {
        console.error("Link Creation Error:", err.message);
        window.Telegram.WebApp.showAlert("Error: Could not save link.");
    }
}

// ২. ডাটাবেজ থেকে রিয়েল-টাইম স্ট্যাটাস লোড করা
async function loadStats() {
    if (!currentUser) return;

    try {
        // আজকের তারিখ বের করা (Today's Stats এর জন্য)
        const today = new Date().toISOString().split('T')[0];

        // ক) আজকের ক্লিক এবং ইনকাম আনা
        const { data: todayClicks, error: clickError } = await supabase
            .from('clicks')
            .select('*')
            .eq('publisher_id', currentUser.id)
            .gte('created_at', today);

        // খ) রেফারেল ইনকাম ক্যালকুলেট করা (৫% কমিশন)
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('balance, referral_earnings, lifetime_earnings, traffic_score')
            .eq('id', currentUser.id)
            .single();

        if (clickError || profileError) throw clickError || profileError;

        // ৩. ক্যালকুলেশন লজিক
        let clicksCount = todayClicks ? todayClicks.length : 0;
        let earningsToday = todayClicks ? todayClicks.reduce((sum, c) => sum + parseFloat(c.publisher_share || 0), 0) : 0;
        
        // এভারেজ CPM বের করা
        let avgCPM = clicksCount > 0 ? (earningsToday / clicksCount) * 1000 : 0;

        // ৪. UI আপডেট (index.html এর আইডি অনুযায়ী)
        updateText('balance-val', `$${parseFloat(profileData.balance || 0).toFixed(4)}`);
        updateText('top-balance', `$${parseFloat(profileData.balance || 0).toFixed(4)}`);
        updateText('today-clicks', clicksCount);
        updateText('today-earning', `$${earningsToday.toFixed(4)}`);
        updateText('cpm-val', `$${avgCPM.toFixed(2)}`);
        updateText('ref-earning', `$${parseFloat(profileData.referral_earnings || 0).toFixed(4)}`);
        updateText('lifetime-val', `$${parseFloat(profileData.lifetime_earnings || 0).toFixed(4)}`);
        
        // ৫. ট্রাফিক কোয়ালিটি স্কোর সেট করা
        const scoreEl = document.getElementById('traffic-score');
        if(scoreEl) {
            scoreEl.innerText = profileData.traffic_score || "Excellent";
            scoreEl.style.color = getScoreColor(profileData.traffic_score);
        }

        // ৬. রেফারেল লিংক জেনারেট করা
        const refLinkInput = document.getElementById('ref-link');
        if(refLinkInput) {
            refLinkInput.value = `https://t.me/AdzentraAdsBot?start=${currentUser.id}`;
        }

    } catch (err) {
        console.error("Dashboard Sync Error:", err.message);
    }
}

// ৭. অটোমেটিক রিফ্রেশ লজিক (প্রতি ৩০ সেকেন্ডে ডাটা আপডেট হবে)
setInterval(loadStats, 30000);

// ৮. ক্লিপবোর্ড কপি ফাংশন
function copyToClipboard(id) {
    const copyText = document.getElementById(id);
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    
    window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    
    // বাটন টেক্সট সাময়িক পরিবর্তন (Feedback)
    const btn = event.currentTarget;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
}

// ৯. হেল্পার ফাংশনসমূহ
function updateText(id, val) {
    const el = document.getElementById(id);
    if(el) el.innerText = val;
}

function getScoreColor(score) {
    if(score === 'Low') return '#ff4757';
    if(score === 'Good') return '#f1c40f';
    return '#2ecc71'; // Excellent
}

// ১০. সেটিং সেভ করা (Withdrawal Method)
async function saveSettings() {
    const wallet = document.getElementById('wallet-address').value.trim();
    if(!wallet) return window.Telegram.WebApp.showAlert("Please enter a wallet address.");

    try {
        const { error } = await supabase
            .from('profiles')
            .update({ withdrawal_method: wallet })
            .eq('id', currentUser.id);

        if(error) throw error;
        window.Telegram.WebApp.showAlert("✅ Payment info saved successfully!");
    } catch (err) {
        window.Telegram.WebApp.showAlert("Error saving settings.");
    }
}
