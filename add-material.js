// add-material.js
// Firebase se jaruri modules ko import karein.
import { db, auth } from './firebase/firebase-config.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const materialForm = document.getElementById('materialForm');
    const addMaterialMsg = document.getElementById('addMaterialMsg');

    // Forms ke inputs ko access karein.
    const qtyInput = document.getElementById('quantity');
    const pricePerUnitInput = document.getElementById('pricePerKg');
    const priceInput = document.getElementById('price');
    const unitSelect = document.getElementById('unit');
    const priceLabel = document.querySelector("label[for='pricePerKg']");

    // Unit ke aadhar par label ko update karein.
    function updatePriceLabel() {
        if (unitSelect.value === 'kg') {
            priceLabel.textContent = "Price per Kg";
        } else {
            priceLabel.textContent = "Price per Gram";
        }
        autoCalculatePrice();
    }

    // Input changes hone par total price automatic calculate karein.
    function autoCalculatePrice() {
        const qty = Number(qtyInput.value) || 0;
        const pricePerUnit = Number(pricePerUnitInput.value) || 0;
        const unit = unitSelect.value;
        let total = 0;

        // Yahan par price per unit ke hisab se total calculate kiya gaya hai.
        if (unit === 'kg') {
            // Agar unit 'kg' hai, to quantity ko price per kg se multiply karein.
            total = qty * pricePerUnit; 
        } else if (unit === 'gm') {
            // Agar unit 'gm' hai, to quantity ko price per gm se multiply karein.
            total = qty * pricePerUnit; 
        }
        priceInput.value = total.toFixed(2);
    }

    // Inputs par event listeners add karein taki changes ko track kiya ja sake.
    qtyInput.addEventListener('input', autoCalculatePrice);
    pricePerUnitInput.addEventListener('input', autoCalculatePrice);
    unitSelect.addEventListener('change', updatePriceLabel);

    if (materialForm) {
        materialForm.onsubmit = async (e) => {
            e.preventDefault();
            addMaterialMsg.classList.add('hidden');

            // Authentication check karein.
            if (!auth.currentUser) {
                addMaterialMsg.textContent = "Error: Authentication not ready. Please try again.";
                addMaterialMsg.classList.remove('hidden', 'message-success');
                addMaterialMsg.classList.add('message-error');
                return;
            }

            const formData = new FormData(e.target);
            const data = {};
            for (let [key, value] of formData.entries()) {
                if (['quantity', 'pricePerKg', 'price', 'gst', 'hamali'].includes(key)) {
                    data[key] = Number(value);
                } else {
                    data[key] = value;
                }
            }
            
            // Ab data ko Firestore ke liye tayyar karein.
            const quantityValue = Number(formData.get('quantity')) || 0;
            const pricePerUnitValue = Number(formData.get('pricePerKg')) || 0;
            const unit = formData.get('unit');

            // Unit ko ek consistent format (grams) mein convert karein.
            let quantityInGrams = quantityValue;
            let pricePerKgForDb = pricePerUnitValue;
            if (unit === 'kg') {
                quantityInGrams = quantityValue * 1000;
                pricePerKgForDb = pricePerUnitValue; // already per kg
            } else if (unit === 'gm') {
                quantityInGrams = quantityValue; // already in grams
                pricePerKgForDb = pricePerUnitValue * 1000; // convert per gm to per kg
            }

            // Total price calculate karein.
            const gst = data.gst || 0;
            const hamali = data.hamali || 0;
            data.total = (pricePerKgForDb * (quantityInGrams / 1000)) + gst + hamali;
            
            // Data ko Firestore ke liye update karein.
            data.quantity = quantityInGrams;
            data.unit = "grams";
            data.pricePerKg = pricePerKgForDb;

            // User ID add karein.
            data.userId = auth.currentUser.uid;

            try {
                console.log("Saving material document:", data);
                await addDoc(collection(db, "materials"), data);

                addMaterialMsg.textContent = "Material added successfully!";
                addMaterialMsg.classList.remove('hidden', 'message-error');
                addMaterialMsg.classList.add('message-success');
                e.target.reset();
                priceInput.value = '';
                updatePriceLabel(); 
            } catch (err) {
                console.error("Error adding document:", err);
                addMaterialMsg.textContent = "Error adding material: " + err.message;
                addMaterialMsg.classList.remove('hidden', 'message-success');
                addMaterialMsg.classList.add('message-error');
            }
        };

        // Page load hone par label ko initialize karein.
        updatePriceLabel();
    } else {
        console.error("Material form not found!");
    }
});
