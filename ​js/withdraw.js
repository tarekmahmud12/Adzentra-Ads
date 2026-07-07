/**
 * Adzentra Ads - Professional Withdrawal Engine
 * Updated for: Firebase Firestore Architecture & Telegram WebApp UI Dialogs
 */

// ১. ফায়ারস্টোরে উইথড্র রিকোয়েস্ট সাবমিট করার অরিজিনাল ফাংশন
async function requestWithdraw() {
    if (!currentUser) return window.Telegram.WebApp.showAlert("User sessional error! Restart App.");

    const amountInput = document.getElementById('withdraw-amount');
    const methodInput = document.getElementById('payment-method');
    const walletInput = document.getElementById('wallet-address');

    if (!amountInput || !methodInput || !walletInput) return;

    const amount = parseFloat(amountInput.value);
    const method = methodInput.value;
    const wallet = walletInput.value.trim();

    // ১. মিনিমাম উইথড্রাল এমাউন্ট ভ্যালিডেশন
    if (isNaN(amount) || amount < 5) {
        return window.Telegram.WebApp.showAlert("Minimum payout amount is $5.00");
    }

    // ২. কারেন্ট ব্যালেন্স চেক ভ্যালিডেশন (ডাটাবেজ সিকিউরিটি বাফার)
    const currentBalance = parseFloat(currentUser.balance || 0);
    if (amount > currentBalance) {
        return window.Telegram.WebApp.showAlert(`Insufficient balance! Your current balance is $${currentBalance.toFixed(4)}`);
    }

    // ৩. ওয়ালেট এড্রেস ইনপুট ভ্যালিডেশন
    if (!wallet) {
        return window.Telegram.WebApp.showAlert("Please enter a valid wallet address or number.");
    }

    try {
        // ফায়ারস্টোর ট্রানজেকশন যাতে রিকোয়েস্ট সাবমিট হওয়ার সাথে সাথে ইউজারের মেইন ব্যালেন্স থেকে টাকা কেটে নেওয়া হয়
        const userRef = db.collection('publishers').doc(String(currentUser.id));
        
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error("User document does not exist!");

            const freshBalance = parseFloat(userDoc.data().balance || 0);
            if (amount > freshBalance) throw new Error("Insufficient balance detected in secure sync!");

            // ক) ইউজারের ব্যালেন্স থেকে উইথড্রাল এমাউন্ট মাইনাস করা
            transaction.update(userRef, {
                balance: freshBalance - amount
            });

            // খ) 'withdrawals' কালেকশনে নতুন ডকুমেন্ট বা রিকোয়েস্ট এড করা
            const newWithdrawRef = db.collection('withdrawals').doc();
            transaction.set(newWithdrawRef, {
                publisher_id: String(currentUser.id),
                amount: amount,
                method: method,
                wallet: wallet,
                status: 'pending', // pending, approved, rejected
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        // সফল হলে নোটিফিকেশন ও হ্যাপটিক ফিডব্যাক দেওয়া
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        window.Telegram.WebApp.showAlert("Withdrawal request sent successfully! 🚀 It will be reviewed within 24 hours.");
        
        // ইনপুট ফিল্ডগুলো খালি করে দেওয়া
        amountInput.value = '';
        walletInput.value = '';

        // উইথড্রাল হিস্ট্রি তালিকা সাথে সাথে রিফ্রেশ করা
        loadWithdrawHistory();

    } catch (err) {
        console.error("Withdraw Error:", err.message);
        window.Telegram.WebApp.showAlert("Transaction Failed: " + err.message);
    }
}

// ২. ডাটাবেজ থেকে ইউজারের রিয়াল উইথড্রাল হিস্ট্রি লাইভ লোড করা
async function loadWithdrawHistory() {
    const container = document.getElementById('withdraw-list');
    if (!container || !currentUser) return;

    container.innerHTML = '<div style="text-align:center; padding:15px; color: var(--text-dim);">Loading History Logs...</div>';

    try {
        // ফায়ারস্টোর থেকে কারেন্ট ইউজারের উইথড্র হিস্ট্রি ফিল্টার করে আনা (লেটেস্ট রিকোয়েস্ট আগে দেখাবে)
        const snapshot = await db.collection('withdrawals')
            .where('publisher_id', '==', String(currentUser.id))
            .get();

        if (snapshot.empty) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color: var(--text-dim); font-size:13px;">No payout history found.</div>';
            return;
        }

        const withdrawalsList = [];
        snapshot.forEach(doc => {
            const wData = doc.data();
            // সর্টিং এর সুবিধার্থে ক্লায়েন্ট সাইডে টাইমস্ট্যাম্প পুশ করা
            wData.seconds = wData.createdAt ? wData.createdAt.seconds : Math.floor(Date.now() / 1000);
            withdrawalsList.push(wData);
        });

        // টাইমস্ট্যাম্প অনুযায়ী ডিসেন্ডিং সর্ট (নতুন ডাটা উপরে)
        withdrawalsList.sort((a, b) => b.seconds - a.seconds);

        // ডাটা ম্যাপ করে UI টেমপ্লেট জেনারেট করা
        container.innerHTML = withdrawalsList.map(w => {
            // মেথড অনুযায়ী কারেন্সি কোড নির্ধারণ (বিকাশ/নগদ হলে BDT, ক্রিপ্টো হলে USDT)
            const currencySymbol = (w.method === 'Bkash' || w.method === 'Nagad') ? 'BDT' : 'USDT';
            
            // আপনার বর্তমান ডার্ক থিমের ব্যাজ ক্লাসের সাথে স্ট্যাটাস ডাইনামিক ম্যাপিং
            let statusBadgeColor = 'rgba(255, 193, 7, 0.15)'; // Pending (Yellow)
            let statusTextColor = '#ffc107';
            
            if (w.status === 'approved' || w.status === 'success') {
                statusBadgeColor = 'rgba(40, 167, 69, 0.15)'; // Approved (Green)
                statusTextColor = 'var(--success)';
            } else if (w.status === 'rejected') {
                statusBadgeColor = 'rgba(220, 53, 69, 0.15)'; // Rejected (Red)
                statusTextColor = 'var(--danger)';
            }

            return `
                <div class="list-item" style="display:flex; justify-content:space-between; align-items:center; padding:14px; background:rgba(255,255,255,0.02); margin-bottom:8px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; flex-direction:column; gap:3px;">
                        <span style="font-weight:700; font-size:14px; color:#fff;">$${parseFloat(w.amount).toFixed(2)} <span style="font-size:11px; color:var(--text-dim); font-weight:400;">(${w.method})</span></span>
                        <span style="font-size:10px; color:var(--text-dim); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">To: ${w.wallet}</span>
                    </div>
                    <span class="badge ${w.status}" style="background:${statusBadgeColor}; color:${statusTextColor}; padding:5px 12px; border-radius:8px; font-size:11px; font-weight:700; text-transform:uppercase;">
                        ${w.status}
                    </span>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Load Withdraw History Error:", err.message);
        container.innerHTML = '<div style="text-align:center; padding:20px; color: var(--danger);">Failed to load history logs.</div>';
    }
}

// ৩. পেজ ডম এবং সেশন রেডি হলে ইনিশিয়াল লোড সম্পন্ন করা
document.addEventListener('DOMContentLoaded', () => {
    // ২.৫ সেকেন্ড বাফার দেওয়া হলো যাতে app.js এর লিসেনার সেশনটি আগে একটিভ হয়
    setTimeout(() => {
        loadWithdrawHistory();
    }, 2500);
});
