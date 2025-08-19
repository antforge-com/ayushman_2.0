import { db, auth, appId, initializeFirebase, collection, onSnapshot, query, where, Timestamp } from './firebase-config.js';
import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const productPricesListContainer = document.getElementById('productPricesList');
const statusMessageDiv = document.getElementById('statusMessage');

// Modal Elements
const deleteModal = document.getElementById('deleteModal');
const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

// New Search Modal Elements
const searchBtn = document.getElementById('searchBtn');
const searchModal = document.getElementById('searchModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const searchOptions = document.getElementById('searchOptions');
const searchByProductBtn = document.getElementById('searchByProductBtn');
const searchByDateBtn = document.getElementById('searchByDateBtn');
const productSearchForm = document.getElementById('productSearchForm');
const dateSearchForm = document.getElementById('dateSearchForm');

let unsubscribe = null; // Variable to store the unsubscribe function for the Firestore listener.
let selectedProductIdForDeletion = null;


/**
 * Displays a message to the user.
 * @param {string} message The message to display.
 * @param {string} type The type of message ('success', 'error', 'info').
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
 * Checks if the user is authenticated and sets up the data listener.
 */
const setupAuthCheck = async () => {
    try {
        await initializeFirebase();
    } catch (err) {
        console.error("Firebase initialization failed:", err);
        productPricesListContainer.innerHTML = '<div class="message-box message-error">Error connecting to the database.</div>';
        return;
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            setupProductPriceListener(user.uid);
        } else {
            console.log("No user is signed in. Redirecting to login page.");
            window.location.href = 'login.html';
        }
    });
};

/**
 * Sets up a real-time listener for the products collection for the current user.
 * @param {string} currentUserId - The ID of the currently logged-in user.
 * @param {object} optionalQuery - An optional Firestore query to apply a filter.
 * @param {string} searchProductName - Case-insensitive search के लिए product का नाम.
 */
const setupProductPriceListener = (currentUserId, optionalQuery = [], searchProductName = null) => {
    if (unsubscribe) {
        unsubscribe(); // Unsubscribe from the previous listener
    }

    if (!db || !currentUserId) {
        console.error("Database or user ID not available.");
        productPricesListContainer.innerHTML = '<div class="message-box message-error">Could not retrieve data. Please log in again.</div>';
        return;
    }

    // FIX: सीधे user-specific collection path का उपयोग करें
    const collectionPath = `artifacts/${appId}/users/${currentUserId}/products`;
    let baseQuery = collection(db, collectionPath);
    let finalQuery = query(baseQuery, ...optionalQuery);
    
    unsubscribe = onSnapshot(finalQuery, (snapshot) => {
        let productPrices = [];
        snapshot.forEach(doc => {
            productPrices.push({ id: doc.id, ...doc.data() });
        });

        if (searchProductName) {
            const lowerCaseSearch = searchProductName.toLowerCase();
            productPrices = productPrices.filter(item => 
                item.name && item.name.toLowerCase().includes(lowerCaseSearch)
            );
        }

        // Sort data on the client-side alphabetically by product name
        productPrices.sort((a, b) => {
            const nameA = a.name ? a.name.toLowerCase() : '';
            const nameB = b.name ? b.name.toLowerCase() : '';
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        });

        displayProductPrices(productPrices);
    }, (error) => {
        console.error("Error listening to product prices: ", error);
        productPricesListContainer.innerHTML = '<div class="message-box message-error">Error loading data.</div>';
    });
};

/**
 * Dynamically displays product prices in the UI.
 * @param {Array} productPrices - The list of product prices to display.
 */
const displayProductPrices = (productPrices) => {
    if (productPrices.length === 0) {
        productPricesListContainer.innerHTML = '<div class="message-box">No product prices have been calculated yet.</div>';
        return;
    }

    const productCards = productPrices.map(item => {
        const date = item.timestamp ? item.timestamp.toDate().toLocaleDateString() : 'N/A';
        const time = item.timestamp ? item.timestamp.toDate().toLocaleTimeString() : 'N/A';

        const calculations = item.calculations || {};
        const materialsUsed = item.materialsUsed || [];
        const bottleInfo = item.bottleInfo || {};

        const baseCost = calculations.baseCost !== undefined ? `₹${calculations.baseCost.toFixed(2)}` : 'N/A';
        const margin1 = calculations.margin1 !== undefined ? `₹${calculations.margin1.toFixed(2)}` : 'N/A';
        const margin2 = calculations.margin2 !== undefined ? `₹${calculations.margin2.toFixed(2)}` : 'N/A';
        const totalSellingPrice = calculations.totalSellingPrice !== undefined ? `₹${calculations.totalSellingPrice.toFixed(2)}` : 'N/A';
        const grossPerBottle = calculations.grossPerBottle !== undefined ? `₹${calculations.grossPerBottle.toFixed(2)}` : 'N/A';

        const bottleCost = bottleInfo.numBottles !== undefined && bottleInfo.costPerBottle !== undefined ? `₹${(bottleInfo.numBottles * bottleInfo.costPerBottle).toFixed(2)}` : 'N/A';
        const totalMaterialCost = materialsUsed.reduce((sum, material) => sum + (material.totalCost || 0), 0).toFixed(2);
        
        const ingredientsList = materialsUsed.map(material => `
            <li>
                <span>${material.materialName || 'N/A'}</span>
                <span>${material.quantity} ${material.unit}</span>
            </li>
        `).join('');

        return `
            <article class="price-card">
                <header class="price-header flex justify-between items-center" data-id="${item.id}">
                    <div class="flex items-center gap-2">
                        <h3>${item.name || `Price Calculation ${date}`}</h3>
                    </div>
                    <div class="flex items-center gap-4">
                         <div class="card-actions">
                            <button class="action-btn delete-btn" onclick="openDeleteModal('${item.id}', event)">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                        <span style="font-weight:700;">${grossPerBottle} per bottle</span>
                        <i class="fa-solid fa-chevron-down toggle-icon"></i>
                    </div>
                </header>
                <div class="price-body hidden" id="details-${item.id}">
                    <div class="price-details flex flex-col gap-2">
                        <h4>Calculations</h4>
                        <p><strong>Total Material Cost:</strong> <span>₹${totalMaterialCost}</span></p>
                        <p><strong>Total Bottle Cost:</strong> <span>${bottleCost}</span></p>
                        <p><strong>Base Cost:</strong> <span>${baseCost}</span></p>
                        <p><strong>Margin 1 (113%):</strong> <span>${margin1}</span></p>
                        <p><strong>Margin 2 (12%):</strong> <span>${margin2}</span></p>
                        <p><strong>Total Selling Price:</strong> <span>${totalSellingPrice}</span></p>
                        <p><strong>Gross Price per Bottle:</strong> <span>${grossPerBottle}</span></p>

                        <h4>Ingredients Used</h4>
                        <ul>
                            ${ingredientsList}
                        </ul>
                        
                        <p style="margin-top:1rem;"><strong>Calculated on:</strong> <span>${date} at ${time}</span></p>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    productPricesListContainer.innerHTML = productCards;

    // Add event listeners to each card header
    document.querySelectorAll('.price-header').forEach(header => {
        header.addEventListener('click', (event) => {
            const cardBody = document.getElementById(`details-${header.dataset.id}`);
            const isExpanded = cardBody.classList.contains('expanded');
            
            // Toggle the visibility of the details section
            cardBody.classList.toggle('expanded');
            header.classList.toggle('expanded');
            
            // Toggle the icon
            const icon = header.querySelector('.toggle-icon');
            if (icon) {
                icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        });
    });
};

/**
 * Opens the delete confirmation modal.
 * @param {string} productId - The ID of the product price to delete.
 * @param {Event} event - The event object to stop propagation.
 */
window.openDeleteModal = (productId, event) => {
    event.stopPropagation(); // Prevent card from expanding
    selectedProductIdForDeletion = productId;
    deleteModal.classList.remove('hidden');
};

/**
 * Deletes a product price document from Firestore.
 */
const deleteProductPrice = async () => {
    const user = auth.currentUser;
    if (!user || !selectedProductIdForDeletion) {
        showMessage('Error deleting product price: Authentication or ID missing.', 'error');
        return;
    }

    try {
        // FIX: सीधे user-specific collection path का उपयोग करें
        const collectionPath = `artifacts/${appId}/users/${user.uid}/products`;
        const docRef = doc(db, collectionPath, selectedProductIdForDeletion);
        await deleteDoc(docRef);
        showMessage('Product price deleted successfully!', 'success');
        deleteModal.classList.add('hidden');
    } catch (error) {
        console.error("Error deleting product price:", error);
        showMessage('Failed to delete product price. Please try again.', 'error');
    } finally {
        selectedProductIdForDeletion = null;
    }
};

// Delete Confirmation & Cancel Listeners
confirmDeleteBtn.addEventListener('click', deleteProductPrice);
closeDeleteModalBtn.addEventListener('click', () => deleteModal.classList.add('hidden'));
cancelDeleteBtn.addEventListener('click', () => deleteModal.classList.add('hidden'));

// Search Modal Listeners
searchBtn.addEventListener('click', () => {
    searchModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    searchModal.classList.add('hidden');
    searchOptions.classList.remove('hidden');
    productSearchForm.classList.add('hidden');
    dateSearchForm.classList.add('hidden');
    
    const user = auth.currentUser;
    if (user) {
        setupProductPriceListener(user.uid);
    }
});

searchByProductBtn.addEventListener('click', () => {
    searchOptions.classList.add('hidden');
    productSearchForm.classList.remove('hidden');
});

searchByDateBtn.addEventListener('click', () => {
    searchOptions.classList.add('hidden');
    dateSearchForm.classList.remove('hidden');
});

productSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const productName = document.getElementById('productName').value.trim();
    const user = auth.currentUser;
    if (user) {
        const searchQueries = [];
        setupProductPriceListener(user.uid, searchQueries, productName);
        searchModal.classList.add('hidden');
    }
});

dateSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const purchaseDateStr = document.getElementById('purchaseDate').value;
    const user = auth.currentUser;
    if (purchaseDateStr && user) {
        const startDate = new Date(purchaseDateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(purchaseDateStr);
        endDate.setHours(23, 59, 59, 999);
        
        const searchQueries = [
            where('timestamp', '>=', Timestamp.fromDate(startDate)),
            where('timestamp', '<=', Timestamp.fromDate(endDate))
        ];
        setupProductPriceListener(user.uid, searchQueries);
        searchModal.classList.add('hidden');
    } else if (user) {
        setupProductPriceListener(user.uid);
        searchModal.classList.add('hidden');
    }
});


// Drawer toggle logic
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('hamburgerBtn');
    const drawer = document.getElementById('drawerNav');
    const backdrop = document.getElementById('backdrop');
    const logoutLink = document.getElementById('logoutLink');

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
    
    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await signOut(auth);
                console.log("User signed out successfully.");
                window.location.href = 'login.html';
            } catch (error) {
                console.error("Error signing out: ", error);
            }
        });
    }
});

// Start the authentication check on page load
window.onload = setupAuthCheck;
