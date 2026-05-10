/**
 * Adzentra Ads - Dashboard Logic
 * Handling: Smart Link Creation & Real-time Stats Loading
 */

// ১. স্মার্ট লিংক জেনারেশন ফাংশন
async function createLink() {
    const urlInput = document.getElementById('target-url');
    const resultArea = document.getElementById('result-area');
    const finalLinkInput = document.getElementById('final-link');
    
    const url = urlInput.value.trim();
    
    // ভ্যালিডেশন
    if(!url) {
        return window.Telegram.WebApp.showAlert("Please enter a valid destination URL!");
    }

    try {
        // ৬ অক্ষরের ইউনিক শর্ট কোড তৈরি
        const shortCode = Math.random().toString(36).substring(2, 8);
        
        // সুপাবাসে ডাটা ইনসার্ট
        const { data, error } = await supabase
            .from('smart_links')
            .insert([{ 
                original_url: url, 
                short_code: shortCode,
                publisher_id: currentUser.id // আপনার ডাটাবেজ কলাম অনুযায়ী publisher_id বা user_id দিন
            }]);

        if(error) throw error;

        // সাকসেস হলে UI আপডেট
        const generatedLink = `https://adzentra.pro/r/${shortCode}`;
        
        if (resultArea && finalLinkInput) {
            resultArea.style.display = 'block';
            finalLinkInput.value = generatedLink;
            window.Telegram.WebApp.showAlert("Smart Link Created Successfully! 🚀");
        } else {
            // যদি ইনডেক্স পেজের SPA এলিমেন্ট ব্যবহার করেন
            alert("Link Created: " + generatedLink);
        }

        // ইনপুট ফিল্ড খালি করা
        urlInput.value = "";

    } catch (err) {
        console.error("Link Creation Error:", err.message);
        window.Telegram.WebApp.showAlert("Error: Could not create link. Try again.");
    }
}

// ২. রিয়েল-টাইম স্ট্যাটাস এবং আর্নিং লোড করা
async function loadStats() {
    if (!currentUser) return;

    try {
        // ক্লিকস টেবিল থেকে ডাটা আনা (আজকের ডাটা ফিল্টার করা যেতে পারে)
        const { data: clicks, error } = await supabase
            .from('clicks')
            .select('*')
            .eq('publisher_id', currentUser.id);

        if (error) throw error;

        if (clicks) {
            // পাবলিশার আর্নিং ক্যালকুলেশন (৬৫% পাবলিশার শেয়ার লজিক)
            let totalClicks = clicks.length;
            let totalEarnings = clicks.reduce((sum, click) => sum + parseFloat(click.publisher_share || 0), 0);
            
            // CPM ক্যালকুলেশন: (Total Earning / Total Clicks) * 1000
            let avgCPM = totalClicks > 0 ? (totalEarnings / totalClicks) * 1000 : 1.50;

            // UI-তে ডাটা বসানো
            updateStatUI('today-clicks', totalClicks);
            updateStatUI('today-earning', `$${totalEarnings.toFixed(4)}`);
            updateStatUI('cpm-val', `$${avgCPM.toFixed(2)}`);
            updateStatUI('balance-val', `$${parseFloat(currentUser.balance || 0).toFixed(4)}`);
        }

    } catch (err) {
        console.error("Stats Loading Error:", err.message);
    }
}

// ৩. ছোট হেল্পার ফাংশন UI আপডেট করার জন্য
function updateStatUI(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

// ৪. পেজ লোড বা ড্যাশবোর্ড সেকশন ওপেন হলে স্ট্যাটাস রিফ্রেশ
document.addEventListener('DOMContentLoaded', () => {
    // যদি SPA হয়, তবে প্রতিবার ড্যাশবোর্ড ক্লিক করলে loadStats() কল করবেন
    if (currentUser) {
        loadStats();
    }
});
