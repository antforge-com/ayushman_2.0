import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const materialsList = document.getElementById('materialsList');

async function fetchMaterials() {
  try {
    const materialsSnap = await getDocs(query(collection(db, "materials"), orderBy("material")));
    if (materialsSnap.empty) {
      materialsList.innerHTML = '<p style="text-align:center;color:#991b1b;font-size:1.1rem;">No materials found.</p>';
      return;
    }
    let html = '';
    materialsSnap.forEach(doc => {
      const d = doc.data();
      const total = (Number(d.price || 0) + Number(d.gst || 0) + Number(d.hamali || 0));
      html += `
        <div style="background:#f9f8f3;border-radius:10px;border:1px solid #e0e0e0;padding:22px 20px 18px 20px;margin-bottom:22px;">
          <div style="font-size:1.15rem;font-weight:700;color:#234123;margin-bottom:10px;letter-spacing:0.5px;">${d.material || 'Item Name'}</div>
          <div style="width:100%;background:transparent;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:600;">Dealer:</span>
              <span style="min-width:120px;text-align:right;">${d.dealer || 'Dealer'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:600;">Quantity:</span>
              <span style="min-width:120px;text-align:right;">${d.quantity || 'Quantity of item'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:600;">Price per kg:</span>
              <span style="min-width:120px;text-align:right;">${d.pricePerKg || 'Price per kg'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:600;">Price :</span>
              <span style="min-width:120px;text-align:right;">${d.price || 'Price'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:600;">GST:</span>
              <span style="min-width:120px;text-align:right;">${d.gst || 'GST'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:600;">Hamali:</span>
              <span style="min-width:120px;text-align:right;">${d.hamali || 'Hamali'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:6px;border-top:1px solid #e0e0e0;">
              <span style="font-weight:600;">Total:</span>
              <span style="min-width:120px;text-align:right;font-weight:700;">${total ? total.toLocaleString() : 'Total'}</span>
            </div>
          </div>
        </div>
      `;
    });
    materialsList.innerHTML = html;
  } catch (err) {
    console.error('Firebase error:', err);
    materialsList.innerHTML = '<p style="text-align:center;color:#991b1b;font-size:1.1rem;">Error loading materials.</p>';
  }
}

fetchMaterials();
