// js/withdraw.js
async function requestWithdraw() {
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const method = document.getElementById('payment-method').value;
    const wallet = document.getElementById('wallet-address').value;

    if (amount < 5) return alert("Minimum payout is $5");

    // Supabase API Call
    const { data, error } = await supabase
        .from('withdrawals')
        .insert([{ 
            publisher_id: user.id, 
            amount: amount, 
            wallet: wallet, 
            method: method,
            status: 'pending' 
        }]);

    if (!error) {
        alert("Withdrawal request sent successfully!");
        loadWithdrawHistory();
    }
}

async function loadWithdrawHistory() {
    const { data } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('publisher_id', user.id)
        .order('created_at', { ascending: false });

    const container = document.getElementById('withdraw-list');
    container.innerHTML = data.map(w => `
        <div class="list-item">
            <span>${w.amount} USDT</span>
            <span class="badge ${w.status}">${w.status}</span>
        </div>
    `).join('');
}
