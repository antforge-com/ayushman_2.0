import { db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Navigation
const main = document.getElementById('main-content');
document.getElementById('addMaterialBtn').onclick = renderAddMaterial;
document.getElementById('productPriceBtn').onclick = renderProductPrice;
// ...add more navigation as needed

// Initial load
renderProductPrice();

// --- Add Material Page ---
function renderAddMaterial() {
  main.innerHTML = `
    <div class="card">
      <h2>Add Materials</h2>
      <form id="materialForm">
        <label>Material</label><br>
        <input name="material" required placeholder="Enter Material Name"><br>
        <label>Dealer</label><br>
        <input name="dealer" required placeholder="Enter Dealer Name"><br>
        <label>Quantity</label><br>
        <input name="quantity" type="number" min="1" required><br>
        <label>Price/Kg</label><br>
        <input name="pricePerKg" type="number" min="0" required><br>
        <label>Price</label><br>
        <input name="price" type="number" min="0" required><br>
        <label>GST Amount</label><br>
        <input name="gst" type="number" min="0" required><br>
        <label>Hamali</label><br>
        <input name="hamali" type="number" min="0" required><br>
        <button class="btn" type="submit">+ Add Purchase</button>
      </form>
      <div id="addMaterialMsg"></div>
    </div>
  `;
  document.getElementById('materialForm').onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.quantity = Number(data.quantity);
    data.pricePerKg = Number(data.pricePerKg);
    data.price = Number(data.price);
    data.gst = Number(data.gst);
    data.hamali = Number(data.hamali);
    try {
      await addDoc(collection(db, "materials"), data);
      document.getElementById('addMaterialMsg').textContent = "Material added!";
      e.target.reset();
    } catch (err) {
      document.getElementById('addMaterialMsg').textContent = "Error: " + err.message;
    }
  };
}

// --- Product Price Calculator Page ---
async function renderProductPrice() {
  // Fetch materials for dropdowns
  const materialsSnap = await getDocs(query(collection(db, "materials"), orderBy("material")));
  const materials = [];
  materialsSnap.forEach(doc => materials.push({ id: doc.id, ...doc.data() }));

  main.innerHTML = `
    <div class="card">
      <h2>Product Price Calculator</h2>
      <div id="materialRows"></div>
      <button class="btn" id="addRowBtn">+ Add Material</button>
      <div class="flex-row">
        <div>Total Material Cost: <span id="totalMaterialCost">Rs. 0</span></div>
      </div>
    </div>
    <div class="card">
      <h3>Bottle Information</h3>
      <label>No. of Bottles</label>
      <input id="numBottles" type="number" min="1" value="1">
      <label>Cost per Bottle</label>
      <input id="costPerBottle" type="number" min="0" value="0">
      <div>Total Bottle Cost: <span id="totalBottleCost">Rs. 0</span></div>
      <div>Total Cost: <span id="totalCost">Rs. 0</span></div>
      <button class="btn" id="calcBtn">Calculate Product Price</button>
    </div>
    <div class="card" id="pricingResults" style="display:none"></div>
  `;

  let materialRows = [];
  function renderRows() {
    const rowsHtml = materialRows.map((row, idx) => `
      <div class="flex-row" style="margin-bottom:8px">
        <select class="materialSelect" data-idx="${idx}">
          <option value="">Select Material</option>
          ${materials.map(m => `<option value="${m.id}" ${row.materialId===m.id?'selected':''}>${m.material}</option>`).join('')}
        </select>
        <input class="costInput" data-idx="${idx}" type="number" min="0" placeholder="Cost/kg" value="${row.costPerKg||''}">
        <input class="qtyInput" data-idx="${idx}" type="number" min="0" placeholder="Qty" value="${row.quantity||''}">
        <span class="rowTotal">Rs. ${row.totalCost||0}</span>
        <button class="btn btn-danger" data-idx="${idx}" onclick="this.closest('.flex-row').remove(); materialRows.splice(${idx},1); updateTotals();">Remove</button>
      </div>
    `).join('');
    document.getElementById('materialRows').innerHTML = rowsHtml;
    document.querySelectorAll('.materialSelect').forEach(sel => sel.onchange = onRowChange);
    document.querySelectorAll('.costInput').forEach(inp => inp.oninput = onRowChange);
    document.querySelectorAll('.qtyInput').forEach(inp => inp.oninput = onRowChange);
    updateTotals();
  }
  function onRowChange(e) {
    const idx = +e.target.dataset.idx;
    const row = materialRows[idx];
    if (e.target.classList.contains('materialSelect')) {
      row.materialId = e.target.value;
      const mat = materials.find(m => m.id === row.materialId);
      if (mat) row.costPerKg = mat.pricePerKg;
    }
    if (e.target.classList.contains('costInput')) row.costPerKg = +e.target.value;
    if (e.target.classList.contains('qtyInput')) row.quantity = +e.target.value;
    row.totalCost = (row.costPerKg || 0) * (row.quantity || 0);
    renderRows();
  }
  function updateTotals() {
    let total = materialRows.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    document.getElementById('totalMaterialCost').textContent = `Rs. ${total.toFixed(2)}`;
    const numBottles = +document.getElementById('numBottles').value;
    const costPerBottle = +document.getElementById('costPerBottle').value;
    const bottleCost = numBottles * costPerBottle;
    document.getElementById('totalBottleCost').textContent = `Rs. ${bottleCost.toFixed(2)}`;
    document.getElementById('totalCost').textContent = `Rs. ${(total + bottleCost).toFixed(2)}`;
  }
  document.getElementById('addRowBtn').onclick = () => {
    materialRows.push({ materialId: '', costPerKg: 0, quantity: 0, totalCost: 0 });
    renderRows();
  };
  document.getElementById('numBottles').oninput = updateTotals;
  document.getElementById('costPerBottle').oninput = updateTotals;
  document.getElementById('calcBtn').onclick = () => {
    const totalMaterial = materialRows.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const numBottles = +document.getElementById('numBottles').value;
    const costPerBottle = +document.getElementById('costPerBottle').value;
    const bottleCost = numBottles * costPerBottle;
    const baseCost = totalMaterial + bottleCost;
    const margin1 = baseCost * 1.13;
    const margin2 = margin1 * 0.12;
    const totalSellingPrice = baseCost + margin1 + margin2;
    const grossPerBottle = totalSellingPrice / numBottles;
    document.getElementById('pricingResults').style.display = '';
    document.getElementById('pricingResults').innerHTML = `
      <div class="grid-2">
        <div>
          <h3>Base Cost (C)</h3>
          <div>₹${baseCost.toFixed(2)}</div>
          <small>Total ingredient + bottle cost</small>
        </div>
        <div>
          <h3>Margin 1 (M1)</h3>
          <div>₹${margin1.toFixed(2)}</div>
          <small>C × 113%</small>
        </div>
        <div>
          <h3>Margin 2 (M2)</h3>
          <div>₹${margin2.toFixed(2)}</div>
          <small>(C + M1) × 12%</small>
        </div>
        <div>
          <h3>Total Selling Price</h3>
          <div>₹${totalSellingPrice.toFixed(2)}</div>
          <small>C + M1 + M2 (for ${numBottles} bottles)</small>
        </div>
        <div>
          <h3>Gross Selling Price per Bottle</h3>
          <div>₹${grossPerBottle.toFixed(2)}</div>
          <small>(C + M1 + M2) ÷ ${numBottles}</small>
        </div>
      </div>
    `;
  };
  // Add one row by default
  materialRows.push({ materialId: '', costPerKg: 0, quantity: 0, totalCost: 0 });
  renderRows();
}