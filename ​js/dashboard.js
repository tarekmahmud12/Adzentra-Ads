/**
 * Adzentra Ads - Professional Dashboard Logic (v2.4)
 * Updated: Firebase Firestore Architecture with Real-time Logs Sync
 */

// আপনার ব্যাকএন্ড ডোমেইন (শেষে /r/ সহ)
const BACKEND_URL = "https://adzentra-kworig5a4-md-tarek-s-projects.vercel.app/r/";

// ১. অটোমেটিক স্মার্ট লিংক জেনারেট করার ফায়ারস্টোর ফাংশন
async function handleLinkCreation() {
    if (!currentUser) return window.Telegram.WebApp.showAlert("User not loaded!");

    try {
        // ইউনিক শর্ট কোড এবং ডিফল্ট নাম তৈরি
        const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const defaultName = "Link_" + (Math.floor(Math.random() * 900) + 100);
        
        // Monetag বা অন্য নেটওয়ার্কের ডিফল্ট ডাইরেক্ট লিংক ব্যাকএন্ডে হ্যান্ডেল হবে
        const defaultOriginalUrl = "MONETAG_DIRECT_LINK_HERE"; 

        // ফায়ারস্টোরের 'smart_links' কালেকশনে রিয়েল ডাটা ইনসার্ট
        await db.collection('smart_links').add({
            publisher_id: String(currentUser.id),
            short_code: shortCode,
            original_url: defaultOriginalUrl,
            alias: defaultName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        window.Telegram.WebApp.showAlert("🚀 New Smart Link Created!");
        
        // লিংক লিস্ট সাথে সাথে রিফ্রেশ করা
        loadUserLinks();

    } catch (err) {
        console.error("Creation Error:", err.message);
        window.Telegram.WebApp.showAlert("Error: Could not generate link.");
    }
}

// ২. ফায়ারস্টোর ডাটাবেজ থেকে ইউজারের তৈরি করা সব লিংক লাইভ লোড করা
async function loadUserLinks() {
    const tableBody = document.getElementById('links-list-body');
    if (!tableBody || !currentUser) return;

    try {
        const snapshot = await db.collection('smart_links')
            .where('publisher_id', '==', String(currentUser.id))
            .get();

        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-dim);">No links found. Click above to generate!</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const item = doc.data();
            const docId = doc.id; // ডক আইডি এডিটের জন্য ব্যবহৃত হবে
            const fullLink = BACKEND_URL + item.short_code;
            
            html += `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <td style="padding: 12px 5px;">
                        <span id="name-text-${docId}" style="font-weight:600; font-size:13px;">${item.alias || 'Unnamed'}</span>
                        <i class="fa-solid fa-pen" style="font-size:10px; cursor:pointer; color:var(--primary); margin-left:5px;" onclick="editLinkName('${docId}', '${item.alias || ''}')"></i>
                    </td>
                    <td style="padding: 12px 5px;">
                        <input type="text" readonly value="${fullLink}" id="link-val-${docId}" 
                               style="width:100px; font-size:10px; border:none; background:rgba(255,255,255,0.05); color:#fff; padding:5px; border-radius:5px;">
                    </td>
                    <td style="padding: 12px 5px; text-align:right;">
                        <button onclick="copyToClipboardCustom('link-val-${docId}')" 
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

// ৩. লিংকের নাম/alias এডিট করার অরিজিনাল ফায়ারস্টোর ফাংশন
async function editLinkName(docId, oldName) {
    const newName = prompt("Enter a nickname for this link:", oldName);
    if (newName === null || newName.trim() === "" || newName === oldName) return;

    try {
        await db.collection('smart_links').doc(docId).update({
            alias: newName.trim()
        });
        
        loadUserLinks(); // ডাটা আপডেট শেষে তালিকা রিফ্রেশ
    } catch (err) {
        window.Telegram.WebApp.showAlert("Failed to update name.");
    }
}

// ৪. ডাটাবেজ থেকে অরিজিনাল এনালাইটিক্স লগ এবং লাইভ ব্যালেন্স লোড করা
async function loadStats() {
    if (!currentUser) return;

    try {
        // ১. ইউজারের লেটেস্ট প্রোফাইল ডাটা রিড করা
        const userDoc = await db.collection('publishers').doc(String(currentUser.id)).get();
        if (!userDoc.exists) return;
        const profile = userDoc.data();

        // ২. ইউজারের রিয়েল রেভিনিউ লগ বা রিওয়ার্ডস কালেকশন থেকে ডাটা আনা
        const rewardsSnapshot = await db.collection('rewards')
            .where('publisherId', '==', String(currentUser.id))
            .get();

        const allRewards = [];
        rewardsSnapshot.forEach(doc => {
            allRewards.push(doc.data());
        });

        // ৩. ব্যালেন্স UI আপডেট
        const balance = parseFloat(profile.balance || 0).toFixed(4);
        updateText('balance-val', `$${balance}`);
        updateText('top-balance', `$${balance}`);
        updateText('p-balance', `$${balance}`);
        
        // ৪. ইমপ্রেশন ও লাইফটাইম কার্ড রিয়েল ডাটা দ্বারা আপডেট
        updateText('dash-imp', profile.impressions || 0);
        updateText('total-imp-val', profile.impressions || 0);
        updateText('dash-clicks', profile.clicks || 0);
        updateText('total-click-val', profile.clicks || 0);
        updateText('lifetime-val', `$${parseFloat(profile.total_earned || 0).toFixed(4)}`);

        // ৫. প্রোফাইল ইনফো প্যানেল
        updateText('p-name', profile.full_name);
        updateText('p-id', profile.id);
        updateText('p-username', `@${profile.username || 'user'}`);

        // ৬. এনালাইটিক্স হিস্ট্রি টেবিল জেনারেট করা
        renderAnalyticsTable(allRewards);

    } catch (err) {
        console.error("Dashboard Sync Error:", err.message);
    }
}

// ৫. এনালাইটিক্স দৈনিক পারফরম্যান্স টেবিল রেন্ডারিং লজিক (রিয়েল ডাটাবেজ গ্রুপিং)
function renderAnalyticsTable(rewardsData) {
    const tableBody = document.getElementById('analytics-table-body');
    if (!tableBody) return;

    // তারিখ অনুযায়ী ডাটা একসাথে গ্রুপ করার মেকানিজম
    const grouped = rewardsData.reduce((acc, curr) => {
        let date = 'Today';
        if (curr.completedAt) {
            // Firebase Timestamp কে ISO ডেট ফর্মেটে রূপান্তর
            date = new Date(curr.completedAt.seconds * 1000).toISOString().split('T')[0];
        }
        if (!acc[date]) acc[date] = { imp: 0, rev: 0 };
        
        acc[date].imp += 1; // প্রতিটি রিওয়ার্ড লগ ১টি ইমপ্রেশন ও ১টি ক্লিক কাউন্ট করে
        acc[date].rev += parseFloat(curr.amount || 0);
        return acc;
    }, {});

    let html = '';
    const sortedDates = Object.keys(grouped).sort().reverse().slice(0, 7); // সর্বোচ্চ শেষ ৭ দিন দেখাবে

    sortedDates.forEach(date => {
        const row = grouped[date];
        const cpm = row.imp > 0 ? (row.rev / row.imp) * 1000 : 0;
        
        html += `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                <td style="padding: 12px 5px;">${date}</td>
                <td style="padding: 12px 5px;">${row.imp}</td>
                <td style="padding: 12px 5px;">${row.imp}</td> 
                <td style="padding: 12px 5px;">$${cpm.toFixed(3)}</td>
                <td style="padding: 12px 5px; color: var(--success); font-weight:700;">$${row.rev.toFixed(4)}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html || '<tr><td colspan="5" style="text-align:center; padding:20px; color: var(--text-dim);">No Data Found</td></tr>';
}

// ৬. ক্লিপবোর্ড কপি ফাংশন
function copyToClipboardCustom(id) {
    const copyText = document.getElementById(id);
    if (!copyText) return;
    
    copyText.select();
    copyText.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(copyText.value);
    
    window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    window.Telegram.WebApp.showAlert("Link Copied! 📋");
}

// ৭. হেল্পার টেক্সট চেঞ্জার ফাংশন
function updateText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

// ৮. ইনিশিয়াল লোড সিঙ্কিং
document.addEventListener('DOMContentLoaded', () => {
    // ফায়ারবেস অ্যাপ ও অথ সেশন পুরোপুরি লোড হতে ২ সেকেন্ড বাফার টাইম
    setTimeout(() => {
        loadStats();
        loadUserLinks();
    }, 2000);
});

// প্রতি ৩০ সেকেন্ড পর পর ড্যাশবোর্ডের মূল ব্যালেন্স স্ট্যাটাস ব্যাকগ্রাউন্ডে চেক হবে
setInterval(loadStats, 30000);
