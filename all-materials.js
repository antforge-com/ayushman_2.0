import { db, auth, appId, initializeFirebase, collection, onSnapshot, query, where, Timestamp } from './firebase-config.js';
import { doc, updateDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const materialsListContainer = document.getElementById('materialsList');
const searchBtn = document.getElementById('searchBtn');
const searchModal = document.getElementById('searchModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const searchOptions = document.getElementById('searchOptions');
const searchByMaterialBtn = document.getElementById('searchByMaterialBtn');
const searchByDateBtn = document.getElementById('searchByDateBtn');
const materialSearchForm = document.getElementById('materialSearchForm');
const dateSearchForm = document.getElementById('dateSearchForm');
const statusMessageDiv = document.getElementById('statusMessage');

// New Modal Elements for Edit and Delete
const editModal = document.getElementById('editModal');
const closeEditModalBtn = document.getElementById('closeEditModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editForm = document.getElementById('editForm');

const deleteModal = document.getElementById('deleteModal');
const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

// New History Modal Elements
const historyModal = document.getElementById('historyModal');
const closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
const historyListContainer = document.getElementById('historyList');

let unsubscribe = null; // Firestore listener के लिए unsubscribe function store करने के लिए variable.
let selectedMaterialIdForDeletion = null;
let allMaterials = []; // सभी material purchases को store करने के लिए एक global array.


/**
 * User ko message dikhata hai.
 * @param {string} message Dikhane wala message.
 * @param {string} type Message ka prakar ('success', 'error', 'info').
 */
function showMessage(message, type) {
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = `message-box message-${type}`;
    statusMessageDiv.classList.remove('hidden');
    setTimeout(() => {
        statusMessageDiv.classList.add('hidden');
    }, 5000);
}

/**
 * जांच करता है कि उपयोगकर्ता प्रमाणित (authenticated) है या नहीं और डेटा श्रोता (listener) ko सेट करता है।
 */
const setupAuthCheck = async () => {
    try {
        await initializeFirebase();
    } catch (err) {
        console.error("Firebase initialization failed:", err);
        materialsListContainer.innerHTML = '<div class="message-box message-error">Error connecting to the database.</div>';
        return;
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            setupMaterialListener(user.uid);
        } else {
            console.log("No user is signed in. Redirecting to login page.");
            window.location.href = 'login.html';
        }
    });
};

/**
 * वर्तमान उपयोगकर्ता के लिए materials collection पर एक real-time listener सेट करता है।
 * @param {string} currentUserId - वर्तमान में login हुए उपयोगकर्ता का ID.
 * @param {object} optionalQuery - एक वैकल्पिक Firestore query जो एक filter लागू करने के लिए है।
 */
const setupMaterialListener = (currentUserId, optionalQuery = []) => {
    if (unsubscribe) {
        unsubscribe(); // पिछले listener से unsubscribe करें
    }

    if (!db || !currentUserId) {
        console.error("Database or user ID not available.");
        materialsListContainer.innerHTML = '<div class="message-box message-error">Could not retrieve data. Please log in again.</div>';
        return;
    }

    const collectionPath = `/artifacts/${appId}/users/${currentUserId}/materials`;
    let baseQuery = collection(db, collectionPath);
    let finalQuery = query(baseQuery, ...optionalQuery);
    
    unsubscribe = onSnapshot(finalQuery, (snapshot) => {
        allMaterials = []; // global array को रीसेट करें
        snapshot.forEach(doc => {
            allMaterials.push({ id: doc.id, ...doc.data() });
        });

        // नए timestamp के अनुसार client-side पर सामग्री को sort करें।
        allMaterials.sort((a, b) => {
            const timestampA = a.timestamp ? a.timestamp.toDate() : new Date(0);
            const timestampB = b.timestamp ? b.timestamp.toDate() : new Date(0);
            return timestampB - timestampA;
        });
        
        // केवल नवीनतम खरीद प्रदर्शित करें
        const latestMaterials = getLatestMaterials(allMaterials);
        displayMaterials(latestMaterials);
    }, (error) => {
        console.error("Error listening to materials: ", error);
        materialsListContainer.innerHTML = '<div class="message-box message-error">Error loading data.</div>';
    });
};

/**
 * सभी सामग्री प्रविष्टियों में से प्रत्येक सामग्री के लिए नवीनतम खरीद प्राप्त करता है।
 * @param {Array} materials - सभी सामग्री प्रविष्टियों की सूची।
 * @returns {Array} प्रत्येक सामग्री के लिए नवीनतम खरीद की सूची।
 */
const getLatestMaterials = (materials) => {
    const latest = {};
    materials.forEach(item => {
        if (!latest[item.material] || (latest[item.material].timestamp && item.timestamp && latest[item.material].timestamp.toDate() < item.timestamp.toDate())) {
            latest[item.material] = item;
        }
    });
    return Object.values(latest);
};


/**
 * UI में सामग्रियों को गतिशील रूप से प्रदर्शित (dynamically display) करता है।
 * @param {Array} materials - प्रदर्शित होने वाली सामग्रियों की सूची।
 */
const displayMaterials = (materials) => {
    if (materials.length === 0) {
        materialsListContainer.innerHTML = '<div class="message-box">No materials have been added yet.</div>';
        return;
    }

    const materialCards = materials.map(item => {
        const date = item.timestamp ? item.timestamp.toDate().toLocaleDateString() : 'N/A';
        const time = item.timestamp ? item.timestamp.toDate().toLocaleTimeString() : 'N/A';
        
        const isLowStock = item.stock < item.minQuantity; // Check if current stock is less than the minimum quantity
        const gstNumberDisplay = item.gstNumber ? `<p><strong>GST Number:</strong> <span>${item.gstNumber}</span></p>` : '';
        const descriptionDisplay = item.description ? `<p><strong>Description:</strong> <span>${item.description}</span></p>` : '';

        const purchaseQuantity = item.quantity !== undefined ? `${item.quantity.toFixed(2)}` : 'N/A';
        const purchaseUnit = item.quantityUnit || 'N/A';
        const stock = item.stock !== undefined ? `${item.stock.toFixed(2)}` : 'N/A';
        const pricePerUnit = item.pricePerUnit !== undefined ? `₹${item.pricePerUnit.toFixed(2)}` : 'N/A';
        const updatedCostPerUnit = item.updatedCostPerUnit !== undefined ? `₹${item.updatedCostPerUnit.toFixed(2)}` : 'N/A';
        const price = item.price !== undefined ? `₹${item.price.toFixed(2)}` : 'N/A';
        const gst = item.gst !== undefined ? `₹${item.gst.toFixed(2)}` : 'N/A';
        const hamali = item.hamali !== undefined ? `₹${item.hamali.toFixed(2)}` : 'N/A';
        const transportation = item.transportation !== undefined ? `₹${item.transportation.toFixed(2)}` : 'N/A';
        const total = (item.price !== undefined && item.gst !== undefined && item.hamali !== undefined && item.transportation !== undefined) ? 
                      `₹${(item.price + item.gst + item.hamali + item.transportation).toFixed(2)}` : 'N/A';
        const billPhotoDisplay = item.billPhotoUrl ? `
            <p><strong>Bill Photo:</strong> 
                <a href="${item.billPhotoUrl}" target="_blank" class="text-blue-500 hover:underline">
                    View Photo <i class="fa-solid fa-up-right-from-square"></i>
                </a>
            </p>
        ` : '';

        return `
            <article class="purchase-card">
                <header class="purchase-header flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <h3>${item.material || 'Material Name'}</h3>
                        ${isLowStock ? '<span class="low-quantity-badge">Low Stock!</span>' : ''}
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="card-actions">
                            <button class="action-btn" onclick="openHistoryModal('${item.material}', event)" title="View History">
                                <i class="fa-solid fa-history"></i>
                            </button>
                            <button class="action-btn edit-btn" onclick="editMaterial('${item.id}', event)" title="Edit this purchase">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="action-btn delete-btn" onclick="openDeleteModal('${item.id}', event)" title="Delete this purchase">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                </header>
                <div class="purchase-body">
                    <div class="purchase-details flex flex-col gap-2">
                        <p><strong>Total Stock:</strong> <span>${stock} ${purchaseUnit}</span></p>
                        <p><strong>Average Cost Per Unit:</strong> <span>${updatedCostPerUnit}</span></p>
                        <p><strong>Last Purchase:</strong> <span>${date} at ${time}</span></p>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    materialsListContainer.innerHTML = materialCards;
};

/**
 * Edit modal kholta hai aur form ko material data se populate karta hai.
 * @param {string} materialId - Edit karne ke liye material ka ID.
 * @param {Event} event - event object ko stop karne ke liye.
 */
window.editMaterial = async (materialId, event) => {
    event.stopPropagation(); // Card ko expand hone se rokein
    window.location.href = `add-material.html?editId=${materialId}`;
};

/**
 * Delete confirmation modal kholta hai.
 * @param {string} materialId - Delete karne ke liye material ka ID.
 * @param {Event} event - event object ko stop karne ke liye.
 */
window.openDeleteModal = (materialId, event) => {
    event.stopPropagation(); // Card ko expand hone se rokein
    selectedMaterialIdForDeletion = materialId;
    deleteModal.classList.remove('hidden');
};

/**
 * History modal kholta hai aur specific material ke liye saari purchases dikhata hai.
 * @param {string} materialName - History dekhne ke liye material ka naam.
 * @param {Event} event - event object ko stop karne ke liye.
 */
window.openHistoryModal = (materialName, event) => {
    event.stopPropagation();
    document.getElementById('historyModalTitle').textContent = `${materialName} Purchase History`;
    
    // Filter allMaterials for the selected material
    const history = allMaterials.filter(item => item.material === materialName);

    if (history.length > 0) {
        const historyHtml = history.map(item => {
            const date = item.timestamp ? item.timestamp.toDate().toLocaleString() : 'N/A';
            const purchaseQuantity = item.quantity !== undefined ? `${item.quantity.toFixed(2)}` : 'N/A';
            const purchaseUnit = item.quantityUnit || 'N/A';
            const pricePerUnit = item.pricePerUnit !== undefined ? `₹${item.pricePerUnit.toFixed(2)}` : 'N/A';
            const totalPurchasePrice = item.price !== undefined ? `₹${item.price.toFixed(2)}` : 'N/A';
            const billPhotoDisplay = item.billPhotoUrl ? `
                <a href="${item.billPhotoUrl}" target="_blank" class="text-blue-500 hover:underline">
                    View Bill <i class="fa-solid fa-up-right-from-square"></i>
                </a>
            ` : '';

            return `
                <div class="history-item">
                    <div class="flex-between">
                        <strong>Date:</strong> <span>${date}</span>
                    </div>
                    <div class="flex-between">
                        <strong>Quantity:</strong> <span>${purchaseQuantity} ${purchaseUnit}</span>
                    </div>
                    <div class="flex-between">
                        <strong>Price per unit:</strong> <span>${pricePerUnit}</span>
                    </div>
                    <div class="flex-between">
                        <strong>Total Price:</strong> <span>${totalPurchasePrice}</span>
                    </div>
                    <div class="flex-between" style="margin-top:0.5rem;">
                         ${billPhotoDisplay}
                         <button class="action-btn edit-btn" onclick="editMaterial('${item.id}', event)">
                            <i class="fa-solid fa-pen-to-square"></i> Edit
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        historyListContainer.innerHTML = historyHtml;
    } else {
        historyListContainer.innerHTML = '<p class="text-center italic text-gray-500">No history available for this material.</p>';
    }

    historyModal.classList.remove('hidden');
};

/**
 * Firestore se ek material document delete karta hai.
 */
const deleteMaterial = async () => {
    const user = auth.currentUser;
    if (!user || !selectedMaterialIdForDeletion) {
        showMessage('Error deleting material: Authentication or ID missing.', 'error');
        return;
    }

    try {
        const collectionPath = `/artifacts/${appId}/users/${user.uid}/materials`;
        const docRef = doc(db, collectionPath, selectedMaterialIdForDeletion);
        await deleteDoc(docRef);
        showMessage('Material deleted successfully!', 'success');
        deleteModal.classList.add('hidden');
    } catch (error) {
        console.error("Error deleting material:", error);
        showMessage('Failed to delete material. Please try again.', 'error');
    } finally {
        selectedMaterialIdForDeletion = null;
    }
};

// Modal aur Search Logic
searchBtn.addEventListener('click', () => {
    searchModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    searchModal.classList.add('hidden');
    searchOptions.classList.remove('hidden');
    materialSearchForm.classList.add('hidden');
    dateSearchForm.classList.add('hidden');
});

closeHistoryModalBtn.addEventListener('click', () => {
    historyModal.classList.add('hidden');
});

searchByMaterialBtn.addEventListener('click', () => {
    searchOptions.classList.add('hidden');
    materialSearchForm.classList.remove('hidden');
});

searchByDateBtn.addEventListener('click', () => {
    searchOptions.classList.add('hidden');
    dateSearchForm.classList.remove('hidden');
});

materialSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const materialName = document.getElementById('materialName').value.trim();
    if (materialName) {
        const user = auth.currentUser;
        const searchQueries = [where('material', '==', materialName)];
        setupMaterialListener(user.uid, searchQueries);
        searchModal.classList.add('hidden');
        searchOptions.classList.remove('hidden');
        materialSearchForm.classList.add('hidden');
    }
});

dateSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const purchaseDateStr = document.getElementById('purchaseDate').value;
    if (purchaseDateStr) {
        const startDate = new Date(purchaseDateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(purchaseDateStr);
        endDate.setHours(23, 59, 59, 999);
        
        const user = auth.currentUser;
        const searchQueries = [
            where('timestamp', '>=', Timestamp.fromDate(startDate)),
            where('timestamp', '<=', Timestamp.fromDate(endDate))
        ];
        setupMaterialListener(user.uid, searchQueries);
        searchModal.classList.add('hidden');
        searchOptions.classList.remove('hidden');
        dateSearchForm.classList.add('hidden');
    }
});

// Delete Confirmation & Cancel Listeners
confirmDeleteBtn.addEventListener('click', deleteMaterial);
closeDeleteModalBtn.addEventListener('click', () => deleteModal.classList.add('hidden'));
cancelDeleteBtn.addEventListener('click', () => deleteModal.classList.add('hidden'));

// Drawer toggle logic (reused from index.html)
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('hamburgerBtn');
    const drawer = document.getElementById('drawerNav');
    const backdrop = document.getElementById('backdrop');

    if (btn && drawer && backdrop) {
        function openDrawer() {
            drawer.classList.add('open');
            backdrop.classList.add('open');
            drawer.setAttribute('aria-hidden', 'false');
            btn.setAttribute('aria-expanded', 'true');
            const firstLink = drawer.querySelector('a');
            if (firstLink) firstLink.focus({ preventScroll: true });
            document.body.style.overflow = 'hidden';
        }

        function closeDrawer() {
            drawer.classList.remove('open');
            backdrop.classList.remove('open');
            drawer.setAttribute('aria-hidden', 'true');
            btn.setAttribute('aria-expanded', 'false');
            btn.focus({ preventScroll: true });
            document.body.style.overflow = '';
        }

        btn.addEventListener('click', () => {
            drawer.classList.contains('open') ? closeDrawer() : openDrawer();
        });

        backdrop.addEventListener('click', closeDrawer);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
        });

        drawer.addEventListener('click', (e) => {
            if (e.target.closest('a[href]')) closeDrawer();
        });
    } else {
        console.error('Drawer elements not found. Check your HTML IDs.');
    }
});

// Start the authentication check on page load
window.onload = setupAuthCheck;
