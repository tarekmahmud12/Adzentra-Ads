// js/analytics.js
async function loadGeoStats() {
    const { data } = await supabase
        .from('geo_stats')
        .select('country, clicks, earnings')
        .eq('publisher_id', user.id);

    const table = document.getElementById('geo-table');
    table.innerHTML = data.map(item => `
        <tr>
            <td>${item.country}</td>
            <td>${item.clicks}</td>
            <td>$${item.earnings}</td>
        </tr>
    `).join('');
}
