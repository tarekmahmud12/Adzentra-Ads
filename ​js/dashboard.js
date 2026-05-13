/**
 * Adzentra Ads - Professional Dashboard Logic (v2.4)
 * Features: Auto-Link Generation, Multi-Link List, Alias Editing & Analytics
 */

// আপনার ব্যাকএন্ড ডোমেইন (শেষে /r/ সহ)
const BACKEND_URL = "https://adzentra-kworig5a4-md-tarek-s-projects.vercel.app/r/";

// ১. অটোমেটিক স্মার্ট লিংক জেনারেট করার ফাংশন
async function handleLinkCreation() {
    if (!currentUser) return window.Telegram.WebApp.showAlert("User not loaded!");

    try {
        // ইউনিক শর্ট কোড এবং ডিফল্ট নাম তৈরি
        const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const defaultName = "Link_" + (Math.floor(Math.random() * 900) + 100);
        
        // নোট: ইউজার ইনপুট ছাড়াই জেনারেট হচ্ছে। অরিজিনাল ইউআরএল হিসেবে ব্যাকএন্ড ডিফল্ট ব্যবহার হবে।
        const defaultOriginalUrl = "MONETAG_DIRECT_LINK_HERE"; 

        const { error } = await supabase
            .from('links')
            .insert([{ 
                publisher_id: currentUser.id,
                short_code: shortCode,
                original_url: defaultOriginalUrl,
                alias: defaultName, // লিংকের নাম সেভ করার জন্য
                created_at: new Date()
            }]);

        if (error) throw error;

        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        window.Telegram.WebApp.showAlert("🚀 New Smart Link Created!");
        
        // লিস্ট রিফ্রেশ করা
        loadUserLinks();

    } catch (err) {
        console.error("Creation Error:", err.message);
        window.Telegram.WebApp.showAlert("Error: Could not generate link.");
    }
}

// ২. ডাটাবেজ থেকে ইউজারের সব লিংক লোড করা
async function loadUserLinks() {
    const tableBody = document.getElementById('links-list-body');
    if (!tableBody || !currentUser) return;

    try {
        const { data, error } = await supabase
            .from('links')
            .select('*')
            .eq('publisher_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-dim);">No links found. Click above to generate!</td></tr>';
            return;
        }

        let html = '';
        data.forEach(item => {
            const fullLink = BACKEND_URL + item.short_code;
            html += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 12px 5px;">
                        <span id="name-text-${item.id}" style="font-weight:600; font-size:13px;">${item.alias || 'Unnamed'}</span>
                        <i class="fa-solid fa-pen" style="font-size:10px; cursor:pointer; color:var(--primary); margin-left:5px;" onclick="editLinkName(${item.id}, '${item.alias || ''}')"></i>
                    </td>
                    <td style="padding: 12px 5px;">
                        <input type="text" readonly value="${fullLink}" id="link-val-${item.id}" 
                               style="width:100px; font-size:10px; border:none; background:#f0f2f5; padding:5px; border-radius:5px;">
                    </td>
                    <td style="padding: 12px 5px; text-align:right;">
                        <button onclick="copyToClipboardCustom('link-val-${item.id}')" 
                                style="background:var(--primary); color:white; border:none; padding:5px 10px; border-radius:6px; font-size:11px; cursor:pointer;">
                            Copy
                        </button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;

    } catch (err) {
        console.error("Load Links Error:", err);
    }
}

// ৩. লিংকের নাম এডিট করার ফাংশন
async function editLinkName(id, oldName) {
    const newName = prompt("Enter a nickname for this link:", oldName);
    if (newName === null || newName.trim() === "" || newName === oldName) return;

    try {
        const { error } = await supabase
            .from('links')
            .update({ alias: newName.trim() })
            .eq('id', id);

        if (error) throw error;
        loadUserLinks(); // আপডেট শেষে লিস্ট রিফ্রেশ
    } catch (err) {
        window.Telegram.WebApp.showAlert("Failed to update name.");
    }
}

// ৪. ডাটাবেজ থেকে এনালাইটিক্স এবং ব্যালেন্স লোড করা
async function loadStats() {
    if (!currentUser) return;

    try {
        const today = new Date().toISOString().split('T')[0];

        const { data: statsData, error: statsError } = await supabase
            .from('clicks')
            .select('*')
            .eq('publisher_id', currentUser.id);

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (statsError || profileError) throw statsError || profileError;

        const todayClicksArr = statsData ? statsData.filter(c => c.created_at.startsWith(today)) : [];
        const totalImpressions = statsData ? statsData.length : 0;
        const todayImpressions = todayClicksArr.length;
        
        updateText('balance-val', `$${parseFloat(profile.balance || 0).toFixed(4)}`);
        updateText('top-balance', `$${parseFloat(profile.balance || 0).toFixed(4)}`);
        updateText('p-balance', `$${parseFloat(profile.balance || 0).toFixed(4)}`);
        
        updateText('dash-imp', totalImpressions);
        updateText('total-imp-val', totalImpressions); // এনালাইটিক্স সেকশনের জন্য
        updateText('lifetime-val', `$${parseFloat(profile.lifetime_earnings || 0).toFixed(2)}`);

        updateText('p-name', profile.full_name);
        updateText('p-id', profile.id);
        updateText('p-username', `@${profile.username || 'user'}`);

        renderAnalyticsTable(statsData || []);

    } catch (err) {
        console.error("Dashboard Sync Error:", err.message);
    }
}

// ৫. এনালাইটিক্স টেবিল রেন্ডারিং
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

// ৬. ক্লিপবোর্ড কপি ফাংশন
function copyToClipboardCustom(id) {
    const copyText = document.getElementById(id);
    if(!copyText) return;
    
    copyText.select();
    copyText.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(copyText.value);
    
    window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    window.Telegram.WebApp.showAlert("Link Copied! 📋");
}

// ৭. হেল্পার ফাংশনসমূহ
function updateText(id, val) {
    const el = document.getElementById(id);
    if(el) el.innerText = val;
}

// ৮. ইনিশিয়াল লোড এবং অটো রিফ্রেশ
document.addEventListener('DOMContentLoaded', () => {
    // ইউজারের ডাটা লোড হওয়ার জন্য ২ সেকেন্ড সময় দেওয়া হলো
    setTimeout(() => {
        loadStats();
        loadUserLinks();
    }, 2000);
});

setInterval(loadStats, 30000);
