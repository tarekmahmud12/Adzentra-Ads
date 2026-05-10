// js/referral.js
function copyReferralLink() {
    const refCode = user.referral_code;
    const refLink = `https://adzentra.pro/register?ref=${refCode}`;
    navigator.clipboard.writeText(refLink);
    alert("Referral link copied!");
}

async function loadReferralStats() {
    const { data, count } = await supabase
        .from('publishers')
        .select('*', { count: 'exact' })
        .eq('referred_by', user.id);

    document.getElementById('total-referrals').innerText = count;
    // Calculate 5% earnings from referred users
    const commission = user.referral_earnings || 0;
    document.getElementById('ref-income').innerText = `$${commission.toFixed(2)}`;
}
