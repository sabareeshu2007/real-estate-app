    // --- CONFIG ---
        // ⚠️ REPLACE WITH YOUR RENDER URL
        // Note: I've added a setupEventListeners() function at the bottom of the script to centralize event handling.
        const API_URL = 'https://real-estate-app-925m.onrender.com/api'; // REPLACE
        const CLOUD_NAME = 'dfsotxfxg';      // REPLACE
        const UPLOAD_PRESET = 'estate'; // REPLACE 

        let currentUserType = 'owner';
        let ownerMap, tenantMap, detailMap; 
        let selectedLat, selectedLng, ownerMarker;
        let isLoginMode = true, isEditing = false, editingId = null;
        let currentImages = {}; // Stores the current photos while editing
        let allMyProperties = []; // Stores full property data
        let searchFilters = { listingType: '', propertyType: '', price: 0, sqft: 0 };
        let adminChart = null; // Global variable to hold chart instance

        // --- ADVANCED FILTER STATE ---
        let activeFilters = {
            listingType: '', // Default
            propertyType: '',
            price: 0,
            sqft: 0,
            furnishing: '',
            buildingType: '',
            parking: ''
        };

        // 1. Tab Selection (Buy/Rent/Commercial)
        function setSearchTab(el, val) {
            // 1. Remove 'active' from ALL tabs
            document.querySelectorAll('.tab-item, .ft-btn').forEach(tab => tab.classList.remove('active'));

            // 2. Add 'active' to CLICKED tab
            el.classList.add('active');

            // Also activate its counterpart on the other page if it exists
            const otherTab = document.querySelector(`.tab-item[data-value="${val}"], .ft-btn[data-value="${val}"]`);
            if (otherTab && otherTab !== el) {
                otherTab.classList.add('active');
            }

            // Style is now handled by CSS, but we can force it if needed
            // el.style.borderBottom = "3px solid #ff4757"; 
            // el.style.opacity = "1";

            // 3. Update Logic
            activeFilters.listingType = val;
            console.log("Switched to:", val);
        }

        // 2. Chip Selection (Single Select Logic)
        function selectSingle(containerId, btn, value) {
            const container = document.getElementById(containerId);
            
            // UI: Remove 'selected' from all siblings, add to clicked
            container.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
            btn.classList.add('selected');

            // LOGIC: Map the Container ID to the specific Filter Variable
            if (containerId.includes('look')) activeFilters.listingType = value;
            if (containerId.includes('prop')) activeFilters.propertyType = value;
            if (containerId.includes('furnish')) activeFilters.furnishing = value;
            if (containerId.includes('build')) activeFilters.buildingType = value;
            if (containerId.includes('park')) activeFilters.parking = value;

            console.log("Filter Updated:", activeFilters); // Debugging
        }

        // Map container ID to state variable
        function updateFilterState(id, val) {
            if(id.includes('prop')) activeFilters.propertyType = val;
            if(id.includes('furnish')) activeFilters.furnishing = val;
            if(id.includes('build')) activeFilters.buildingType = val;
            if(id.includes('park')) activeFilters.parking = val;
            if(id.includes('look')) activeFilters.listingType = val;
        }

        // 3. Slider Update
        function updateRangeLabel(id, val, pre, post) {
            document.getElementById(id).innerText = val == 0 ? "Any" : pre + Number(val).toLocaleString() + post;
            if (id === 'disp-price') activeFilters.price = val;
            if (id === 'disp-sqft') activeFilters.sqft = val;
        }

        // --- LOADING HELPERS ---
            function showLoading(msg = "Please wait...") {
                document.getElementById('loading-msg').innerText = msg;
                document.getElementById('loading-overlay').classList.remove('hidden');
            }
            function hideLoading() {
                document.getElementById('loading-overlay').classList.add('hidden');
            }

        // --- NAVIGATION LOGIC ---
        function goHome() {
            // Hide App Sections
            document.getElementById('app-section').classList.add('hidden');
            document.getElementById('admin-dashboard').classList.add('hidden');
            
            // Show Home with Animation
            const home = document.getElementById('home-page');
            home.classList.remove('hidden');
            home.classList.add('animate-view'); // <--- Animate Home
            
            loadFeatured();
        }

        function showAuth(type) {
            currentUserType = type; // 'owner' or 'tenant'

            // 1. Hide ALL Sections first
            const sections = ['home-page', 'property-page', 'app-section', 'owner-section', 'tenant-section', 'auth-section', 'admin-dashboard'];
            sections.forEach(id => document.getElementById(id).classList.add('hidden'));

            // 2. Decide what to show
            const token = localStorage.getItem('token');
            
            // Always show the App Container
            const appSection = document.getElementById('app-section');
            appSection.classList.remove('hidden');
            appSection.classList.add('animate-view'); // <--- ADD ANIMATION HERE

            if (token) {
                // --- LOGGED IN ---
                if (type === 'owner') {
                    document.getElementById('owner-section').classList.remove('hidden');
                    document.getElementById('owner-section').classList.add('animate-view'); // Animate Dashboard
                    initOwnerMap();
                    loadMyListings();
                } else { // Tenant
                    document.getElementById('tenant-section').classList.remove('hidden');
                    document.getElementById('tenant-section').classList.add('animate-view'); // Animate Search
                    initTenantMap();
                }
            } else {
                // --- NOT LOGGED IN (Show Login Form) ---
                const authSection = document.getElementById('auth-section');
                authSection.classList.remove('hidden');
                authSection.classList.add('animate-view'); // Animate Login Form
                
                // Change Title based on what they clicked to make it obvious
                const title = document.getElementById('auth-title');
                if(type === 'owner') {
                    title.innerText = "Owner Login / List Property";
                    title.style.color = "#e67e22"; // Orange for Owner
                } else {
                    title.innerText = "Tenant Login";
                    title.style.color = "#6C63FF"; // Purple for Tenant
                }
            }
        }

        function triggerTenantSearch() {
            const homeInput = document.getElementById('home-search-input');
            const term = homeInput ? homeInput.value : '';

            if(!term) {
                alert("Please enter an area name");
                return;
            }

            // Switch to Tenant View
            showAuth('tenant'); 

            // Transfer text to BOTH potential tenant inputs
            const tenantInput1 = document.getElementById('search-query');
            const tenantInput2 = document.getElementById('f-loc');
            
            if(tenantInput1) tenantInput1.value = term;
            if(tenantInput2) tenantInput2.value = term;

            // Clear the home input so it doesn't interfere later
            if(homeInput) homeInput.value = '';

            // Run search
            searchProperties();
        }

        function closePropertyPage() {
            document.getElementById('property-page').classList.add('hidden');
            document.getElementById('app-section').classList.remove('hidden');
        }

        // --- AUTH & TOGGLE ---
        function toggleAuthMode() {
            isLoginMode = !isLoginMode;
            document.getElementById('auth-title').innerText = isLoginMode ? "Welcome Back" : "Create Account";
            document.getElementById('signup-fields').classList.toggle('hidden');
            document.getElementById('switch-text').innerText = isLoginMode ? "New here? Create Account" : "Already have an account? Login";
        }

        async function handleAuth() {
            // 1. Get Inputs
            const email = document.getElementById('email-input').value;
            const password = document.getElementById('pass-input').value;
            
            // 2. Validate
            if(!email || !email.includes('@')) return alert("Please enter a valid email");
            if(!password) return alert("Please enter password");

            const endpoint = isLoginMode ? '/login' : '/register';
            
            // 3. Build Payload
            // CRITICAL: We must send the currentUserType ('owner' or 'tenant') 
            // so the backend knows what role to assign/check.
            let payload = { email, password, userType: currentUserType };
            
            if(!isLoginMode) { 
                payload.firstName = document.getElementById('reg-name').value;
                payload.phone = document.getElementById('reg-phone').value;
                if(!payload.firstName) return alert("Enter Name");
            }

            try {
                showLoading(isLoginMode ? "Logging in..." : "Creating Account...");
                
                const res = await fetch(`${API_URL}${endpoint}`, { 
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify(payload) 
                });
                
                const data = await res.json();
                
                if(data.success) { 
                    // SUCCESS: Save credentials
                    localStorage.setItem('token', data.token); 
                    
                    // IMPORTANT: Save the role and type correctly
                    localStorage.setItem('role', data.role || 'user');
                    localStorage.setItem('type', currentUserType); // Force save the type we just used
                    localStorage.setItem('email', email);
                    
                    // Redirect
                    checkSession(); 
                } else { 
                    // FAILURE: Show error and STOP
                    alert(data.message); 
                    // Do NOT call checkSession() here
                }
            } catch(e) { 
                console.error(e); // See exact error in console
                alert("Connection Error. Check console for details."); 
            } 
            finally { hideLoading(); }
        }

        function checkSession() {
            const token = localStorage.getItem('token');
            const role = localStorage.getItem('role');
            
            if(token) {
                // Hide Home/Auth
                document.getElementById('home-page').classList.add('hidden');
                document.getElementById('auth-section').classList.add('hidden');
                document.getElementById('logout-btn').classList.remove('hidden');

                // CHECK ROLE
                if (role === 'admin') {
                    // Show Admin Dashboard
                    document.getElementById('admin-dashboard').classList.remove('hidden');
                    document.getElementById('app-section').classList.add('hidden'); // Hide normal app
                    loadAdminData();
                } else {
                    // Show Normal App
                    document.getElementById('app-section').classList.remove('hidden');
                    if(localStorage.getItem('type') === 'owner') {
                        document.getElementById('owner-section').classList.remove('hidden');
                        initOwnerMap();
                        loadMyListings();
                    } else {
                        document.getElementById('tenant-section').classList.remove('hidden');
                        initTenantMap();
                    }
                }
            } else { goHome(); }
        }
        function handleLogout() { localStorage.clear(); location.reload(); }

        // --- UPLOAD ---
        async function uploadFile(inputId) {
            const fileInput = document.getElementById(inputId);
            if(!fileInput || fileInput.files.length === 0) return "";
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('upload_preset', UPLOAD_PRESET);
            try {
                const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
                const data = await res.json();
                return data.secure_url;
            } catch(e) { return ""; }
        }

        // --- OWNER FUNCTIONS ---
        function initOwnerMap() {
            if(ownerMap) return;
            ownerMap = L.map('owner-map').setView([13.0827, 80.2707], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(ownerMap);
            ownerMap.on('click', e => {
                selectedLat = e.latlng.lat; selectedLng = e.latlng.lng;
                if(ownerMarker) ownerMap.removeLayer(ownerMarker);
                ownerMarker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(ownerMap);
                document.getElementById('coords-display').style.display = 'block';
            });
            setTimeout(() => ownerMap.invalidateSize(), 500);
        }

        async function searchOwnerMap() {
            const q = document.getElementById('owner-map-search').value;
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}, Chennai`);
            const data = await res.json();
            if(data.length > 0) ownerMap.setView([data[0].lat, data[0].lon], 14);
        }

        async function submitListing() {
            const btn = document.getElementById('submit-btn');
            const originalText = btn.innerText;
            btn.innerText = "Processing..."; 
            btn.disabled = true;
            
            // Show Loading Spinner (if available)
            if(typeof showLoading === "function") showLoading("Saving changes...");

            try {
                // 1. Upload Images
                const [newOuter, newHall, newBed, newKitchen, newBath] = await Promise.all([
                    uploadFile('img-outer'),
                    uploadFile('img-hall'),
                    uploadFile('img-bed'),
                    uploadFile('img-kitchen'),
                    uploadFile('img-bath')
                ]);

                // 2. Merge Images safely
                const finalImages = {
                    outer: newOuter || (currentImages && currentImages.outer) || "",
                    hall: newHall || (currentImages && currentImages.hall) || "",
                    bedroom: newBed || (currentImages && currentImages.bedroom) || "",
                    kitchen: newKitchen || (currentImages && currentImages.kitchen) || "",
                    bathroom: newBath || (currentImages && currentImages.bathroom) || ""
                };

                // 3. Get Amenities (Safe Mode)
                const amenities = [];
                const checkboxes = document.querySelectorAll('.amenity-chk:checked');
                if(checkboxes) {
                    checkboxes.forEach(c => amenities.push(c.value));
                }

                // 4. Helper to get value safely
                const val = (id) => {
                    const el = document.getElementById(id);
                    return el ? el.value : "";
                };

                // 5. Build Form Data (CORRECTED IDs)
                const form = {
                    ownerEmail: localStorage.getItem('email'),
                    firstName: document.getElementById('fname').value,
                    phone: document.getElementById('phone').value,
                    houseNo: document.getElementById('house').value,
                    street: val('house'), 
                    area: document.getElementById('area').value,
                    city: document.getElementById('city').value,
                    price: document.getElementById('price').value,
                    sqft: document.getElementById('sqft').value, 
                    bedrooms: document.getElementById('beds').value,
                    bathrooms: document.getElementById('baths').value,
                    furnishing: document.getElementById('o-furnish').value,
                    // ✅ FIXED THESE TWO LINES:
                    listingType: document.getElementById('o-listingType').value, // Was 'o-listType'
                    parking: document.getElementById('o-parking').value,         // Was 'o-park'
                    propertyType: document.getElementById('o-propType').value,
                    buildingType: document.getElementById('o-buildType').value,
                    description: document.getElementById('desc').value,
                    amenities: amenities,
                    images: finalImages,
                    lat: selectedLat, 
                    lng: selectedLng
                };

                // 6. Basic Validation
                if(!form.firstName || !form.price) {
                    throw new Error("Please fill required fields (Name, Price)");
                }
                
                // Only enforce Map Pin if creating NEW, not updating
                if(!isEditing && (!form.lat || !form.lng)) {
                    throw new Error("Please Pin Location on Map");
                }

                // 7. Send to Server
                let endpoint = '/list-property';
                let method = 'POST';

                if (isEditing && editingId) {
                    endpoint = `/update-property/${editingId}`;
                    method = 'PUT';
                }

                const res = await fetch(`${API_URL}${endpoint}`, {
                    method: method, 
                    headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify(form)
                });
                
                const result = await res.json();
                
                if(result.success) {
                    alert("Success! Saved successfully.");
                    cancelEdit(); // Reset form
                    loadMyListings(); // Refresh list without reloading page
                    document.getElementById('my-listings-body').scrollIntoView({behavior: "smooth"});
                } else {
                    throw new Error(result.error || "Server rejected request");
                }

            } catch(e) {
                console.error(e);
                alert("Error saving: " + e.message);
                btn.innerText = originalText;
                btn.disabled = false;
                if(typeof hideLoading === "function") hideLoading();
            }
        }
        function editProp(id) {
            // 1. Debugging: Check if we have the data
            console.log("Editing ID:", id);
            console.log("All Properties:", allMyProperties);

            // 2. Find the property in our global list
            // We use .find() to look through the array we saved in loadMyListings()
            const p = allMyProperties.find(prop => prop._id === id);
            
            if (!p) {
                alert("Error: Property data not found. Please refresh and try again.");
                return;
            }

            // 3. Fill Text Fields (Safety Checks added)
            // We use || "" to make sure we don't put "undefined" in the box
            document.getElementById('fname').value = p.firstName || "";
            document.getElementById('phone').value = p.phone || "";
            document.getElementById('house').value = p.houseNo || "";
            document.getElementById('street').value = p.street || "";
            document.getElementById('area').value = p.area || "";
            document.getElementById('city').value = p.city || "Chennai";
            document.getElementById('price').value = p.price || "";
            document.getElementById('sqft').value = p.sqft || "";
            
            // Dropdowns need to match the <option> values exactly
            document.getElementById('beds').value = p.bedrooms || ""; 
            document.getElementById('baths').value = p.bathrooms || "";
            document.getElementById('furnish').value = p.furnishing || "";
            document.getElementById('desc').value = p.description || "";
            document.getElementById('o-listingType').value = p.listingType || "Rent";
            document.getElementById('o-propType').value = p.propertyType || "Apartment";
            document.getElementById('o-buildType').value = p.buildingType || "Independent";
            document.getElementById('o-parking').value = p.parking || "Reserved";    
            // 4. Handle Images (The "No File Chosen" Fix)
            // We cannot set the file input. We must show the PREVIEW instead.
            currentImages = p.images || {}; 
            
            // Helper list to loop through all 5 types
            ['outer', 'hall', 'bed', 'kitchen', 'bath'].forEach(type => {
                // Handle naming differences (e.g., 'bed' vs 'bedroom')
                let dbKey = type;
                if(type === 'bed') dbKey = 'bedroom';
                if(type === 'bath') dbKey = 'bathroom';

                const url = currentImages[dbKey];
                const previewBox = document.getElementById(`preview-${type}`);
                
                if (url) {
                    // If we have an image, SHOW the preview box
                    previewBox.style.display = 'block';
                    previewBox.querySelector('img').src = url;
                } else {
                    // If no image, hide the preview
                    previewBox.style.display = 'none';
                }
            });

            // 5. Handle Amenities Checkboxes
            // Reset all first
            document.querySelectorAll('.amenity-chk').forEach(chk => chk.checked = false);
            // Check the ones saved in DB
            if (p.amenities) {
                p.amenities.forEach(am => {
                    // Find the checkbox with this value and check it
                    const chk = document.querySelector(`.amenity-chk[value="${am}"]`);
                    if(chk) chk.checked = true;
                });
            }

            // 6. Set Map Location
            selectedLat = p.lat; 
            selectedLng = p.lng;
            if(ownerMarker) ownerMap.removeLayer(ownerMarker);
            if(p.lat && p.lng) {
                ownerMarker = L.marker([p.lat, p.lng]).addTo(ownerMap);
                ownerMap.setView([p.lat, p.lng], 14);
            }

            // 7. Toggle UI to Edit Mode
            isEditing = true; 
            editingId = id;
            document.getElementById('form-title').innerText = "✏️ Edit Listing";
            document.getElementById('submit-btn').innerText = "Update Listing";
            document.getElementById('cancel-edit-btn').classList.remove('hidden');
            
            // Scroll up to the form
            document.getElementById('listing-form-card').scrollIntoView({behavior:"smooth"});
        }
        function cancelEdit() {
            isEditing = false; editingId = null;
            document.querySelectorAll('#listing-form-card input, textarea').forEach(i => i.value = '');
            document.getElementById('form-title').innerText = "List New Property";
            document.getElementById('submit-btn').innerText = "Submit Listing";
            document.getElementById('submit-btn').disabled = false;
            document.getElementById('cancel-edit-btn').classList.add('hidden');
        }

        async function loadMyListings() {
            const res = await fetch(`${API_URL}/my-properties?email=${localStorage.getItem('email')}`);
            const data = await res.json();
            
            // SAVE DATA GLOBALLY
            allMyProperties = data.properties;

            document.getElementById('my-listings-body').innerHTML = data.properties.map(p => `
                <tr>
                    <td><b>${p.area}</b></td>
                    <td><span class="status-badge">${p.status || 'Pending'}</span></td>
                    <td>
                        <button class="btn-sm bg-orange btn-edit" data-id="${p._id}">Edit</button>
                        <button class="btn-sm bg-red btn-delete" data-id="${p._id}">Del</button>
                    </td>
                </tr>
            `).join('');
        }
        // --- DELETE FUNCTION ---
        async function delProp(id) {
            // 1. Debugging: Check if ID is received
            console.log("Clicking delete for ID:", id);
            
            if (!id || id === 'undefined') {
                return alert("Error: Invalid Property ID. Please refresh.");
            }

            // 2. Confirmation
            if(!confirm("Are you sure you want to delete this listing permanently?")) return;

            // 3. Send Request
            try {
                const res = await fetch(`${API_URL}/delete-property/${id}`, {
                    method: 'DELETE'
                });
                const data = await res.json();

                if (data.success) {
                    alert("🗑️ Property Deleted Successfully");
                    loadMyListings(); // Refresh the table
                } else {
                    alert("Server Error: " + (data.error || "Unknown error"));
                }
            } catch (e) {
                console.error(e);
                alert("Network Error: Could not reach server.");
            }
        }

        // --- TENANT FUNCTIONS ---
        function initTenantMap() {
            const mapContainer = document.getElementById('tenant-map');
            if (!mapContainer) return; // Safety check: exit if the map container element doesn't exist

            const resizeMap = () => {
                // This function will be called to resize the map.
                // Using a timeout ensures this runs after the current JS execution stack is clear,
                // giving the browser a chance to paint layout changes.
                setTimeout(() => {
                    if (tenantMap) {
                        tenantMap.invalidateSize();
                    }
                }, 150); // A short delay is usually sufficient.
            };

            // If the map instance already exists, we just need to tell it to resize.
            if (tenantMap) {
                resizeMap();
                return;
            }

            // If it's the first time, create the map.
            tenantMap = L.map(mapContainer).setView([13.0827, 80.2707], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(tenantMap);

            // After creating the map, we still need to resize it because its container was likely hidden.
            resizeMap();
        }

        async function searchProperties() {
            if(typeof showLoading === 'function') showLoading("Searching...");
            
            // 1. GET THE RIGHT SEARCH TEXT
            // We check the "Sidebar Input" (f-loc) AND "Top Bar Input" (search-query)
            // We prioritize the one that actually has text in it.
            const sidebarInput = document.getElementById('f-loc');
            const topbarInput = document.getElementById('search-query');
            const homeInput = document.getElementById('home-search-input');
            
            let q = '';

            if (sidebarInput && sidebarInput.value.trim() !== '') {
                q = sidebarInput.value;
            } else if (topbarInput && topbarInput.value.trim() !== '') {
                q = topbarInput.value;
            } else if (homeInput && homeInput.value.trim() !== '') {
                // Only use Home Input if we are ON the Home Page
                if(!document.getElementById('home-page').classList.contains('hidden')) {
                    q = homeInput.value;
                }
            }

            console.log("Searching for:", q); // Debugging: Check console to see what it grabbed

            // 2. BUILD URL
            let url = `${API_URL}/search-properties?query=${q}`;
            
            // Add Filters (if they exist)
            if(typeof activeFilters !== 'undefined') {
                if(activeFilters.listingType) url += `&listingType=${activeFilters.listingType}`;
                if(activeFilters.propertyType) url += `&propertyType=${activeFilters.propertyType}`;
                if(activeFilters.price > 0) url += `&maxPrice=${activeFilters.price}`;
                if(activeFilters.sqft > 0) url += `&maxSqft=${activeFilters.sqft}`;
                if(activeFilters.furnishing) url += `&furnishing=${activeFilters.furnishing}`;
                if(activeFilters.parking) url += `&parking=${activeFilters.parking}`;
                if(activeFilters.buildingType) url += `&buildingType=${activeFilters.buildingType}`;
            }

            try {
                const res = await fetch(url);
                const data = await res.json();
                
                // Clear Map
                if (tenantMap) {
                    tenantMap.eachLayer(l => { if(l instanceof L.Marker) tenantMap.removeLayer(l); });
                }

                if(data.properties.length > 0) {
                     // Move map to first result
                     if(tenantMap && data.properties[0].lat) {
                         tenantMap.setView([data.properties[0].lat, data.properties[0].lng], 14);
                     }
                     
                     data.properties.forEach(p => { 
                         if(tenantMap && p.lat) {
                             const m = L.marker([p.lat, p.lng]).addTo(tenantMap);
                             m.on('click', () => openPropertyPage(p)); 
                         }
                     });
                     
                     // Mobile Alert
                     if(window.innerWidth < 768) alert(`Found ${data.properties.length} properties!`);
                } else { 
                    alert("No properties found for '" + q + "'"); 
                }
            } catch(e) { console.error(e); } 
            finally { if(typeof hideLoading === 'function') hideLoading(); }
        }
        // --- PROPERTY PAGE LOGIC ---
        function openPropertyPage(p) {
            document.getElementById('app-section').classList.add('hidden');
            document.getElementById('property-page').classList.remove('hidden');
            window.scrollTo(0,0);

            document.getElementById('dt-title').innerText = `${p.bedrooms || 2} BHK in ${p.area}`;
            document.getElementById('dt-addr').innerText = `📍 ${p.houseNo || ''}, ${p.area}, ${p.city}`;
            document.getElementById('dt-price').innerText = Number(p.price).toLocaleString();
            document.getElementById('dt-owner').innerText = p.firstName;
            document.getElementById('dt-sqft').innerText = p.sqft || '-';
            document.getElementById('dt-beds').innerText = p.bedrooms || '-';
            document.getElementById('dt-baths').innerText = p.baths || '-';
            document.getElementById('dt-desc').innerText = p.description || "";
            document.getElementById('dt-call').href = `tel:${p.phone}`;
            const message = `Hi ${p.firstName}, I saw your ${p.bedrooms || 2} BHK property in ${p.area} listed on EstatePro for ₹${Number(p.price).toLocaleString()}. Is it still available?`;
            const encodedMsg = encodeURIComponent(message);
            document.getElementById('dt-wa').href = `https://wa.me/91${p.phone}?text=${encodedMsg}`;
            document.getElementById('dt-sv').href = `https://www.google.com/maps?layer=c&cbll=${p.lat},${p.lng}`;

            // --- NEW 5-IMAGE LOGIC (PASTED HERE) ---
            const i = p.images || {};
            const def = 'https://via.placeholder.com/800x600?text=No+Image';

            // Fill Desktop Grid
            document.getElementById('dt-img-1').src = i.outer || (p.imageUrl || def);
            document.getElementById('dt-img-2').src = i.hall || def;
            document.getElementById('dt-img-3').src = i.bedroom || def;
            document.getElementById('dt-img-4').src = i.kitchen || def;
            document.getElementById('dt-img-5').src = i.bathroom || def;

            // Fill Mobile Scroll
            document.getElementById('m-img-1').src = i.outer || (p.imageUrl || def);
            document.getElementById('m-img-2').src = i.hall || def;
            document.getElementById('m-img-3').src = i.bedroom || def;
            document.getElementById('m-img-4').src = i.kitchen || def;
            document.getElementById('m-img-5').src = i.bathroom || def;
            // ---------------------------------------

            const am = document.getElementById('dt-amenities'); am.innerHTML = '';
            if(p.amenities) p.amenities.forEach(a => am.innerHTML += `<span class="amenity-tag">✅ ${a}</span>`);

            if(detailMap) detailMap.remove();
            detailMap = L.map('detail-map').setView([p.lat, p.lng], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(detailMap);
            L.marker([p.lat, p.lng]).addTo(detailMap);
            
            // *** ADDED FIX ***
            // The map is in a hidden container, so we must invalidate its size after it becomes visible.
            setTimeout(() => {
                if (detailMap) detailMap.invalidateSize();
            }, 150);
        }

        // --- HOME PAGE LOGIC ---
        async function loadFeatured() {
            try {
                const res = await fetch(`${API_URL}/featured-properties`);
                const data = await res.json();
                document.getElementById('featured-list').innerHTML = data.properties.map(p => {
                    const img = (p.images && p.images.outer) ? p.images.outer : (p.imageUrl || 'https://via.placeholder.com/300x200');
                    return `<div class="prop-card" onclick="showAuth('tenant')">
                        <img src="${img}" class="prop-img">
                        <div class="prop-info">
                            <h3 style="margin:0; color:var(--primary);">₹ ${Number(p.price).toLocaleString()}</h3>
                            <p style="color:#666;">${p.bedrooms || 2} BHK in ${p.area}</p>
                        </div>
                    </div>`;
                }).join('');
            } catch(e) {}
        }

        // --- EMI ---
        function calculateEMI() {
            const P = document.getElementById('loan-amount').value;
            if(!P) return;
            const R = 8.5/12/100; const N = 240;
            const emi = P * R * (Math.pow(1+R, N) / (Math.pow(1+R, N)-1));
            document.getElementById('emi-val').innerText = "₹ " + Math.round(emi).toLocaleString();
        }

        function openLightbox(src) {
            // Only open if it's a valid image link
            if(src && src.includes('http')) {
                document.getElementById('lightbox-img').src = src;
                document.getElementById('lightbox').classList.remove('hidden');
                // Ensure it's visible by forcing display style
                document.getElementById('lightbox').style.display = 'flex';
            }
        }

        function closeLightbox() { 
            document.getElementById('lightbox').classList.add('hidden'); 
            document.getElementById('lightbox').style.display = 'none';
        }

        function updateAuthUI() {
            document.getElementById('auth-title').innerText = isLoginMode ? "Welcome Back" : "Create Account";
            document.getElementById('signup-fields').classList.toggle('hidden', isLoginMode);
            document.getElementById('switch-text').innerText = isLoginMode ? "New here? Create Account" : "Already have an account? Login";
            document.getElementById('auth-btn').innerText = isLoginMode ? "Login" : "Create Account";
        }

        function setupEventListeners() {
            // --- Navigation ---
            document.getElementById('logo').addEventListener('click', goHome);
            document.getElementById('nav-home').addEventListener('click', goHome);
            document.getElementById('nav-list-property').addEventListener('click', () => showAuth('owner'));
            document.getElementById('nav-login').addEventListener('click', () => showAuth('tenant'));
            document.getElementById('logout-btn').addEventListener('click', handleLogout);

            // --- Home Page Search ---
            document.getElementById('hero-filter-btn').addEventListener('click', toggleFilter);
            document.getElementById('hero-search-btn').addEventListener('click', triggerTenantSearch);
            document.querySelector('.search-tabs').addEventListener('click', (e) => {
                if (e.target.classList.contains('tab-item')) {
                    setSearchTab(e.target, e.target.dataset.value);
                }
            });

            // --- Auth Page ---
            document.getElementById('auth-btn').addEventListener('click', handleAuth);
            document.getElementById('switch-text').addEventListener('click', toggleAuthMode);
            document.getElementById('auth-back-home').addEventListener('click', goHome);

            // --- Owner Dashboard ---
            document.getElementById('refresh-listings-btn').addEventListener('click', loadMyListings);
            document.getElementById('submit-btn').addEventListener('click', submitListing);
            document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
            document.getElementById('owner-map-search-btn').addEventListener('click', searchOwnerMap);

            // Event Delegation for "My Listings" table
            document.getElementById('my-listings-body').addEventListener('click', (e) => {
                const target = e.target.closest('button'); // Find the button that was clicked
                if (!target) return;

                const id = target.dataset.id;
                if (target.classList.contains('btn-edit')) {
                    editProp(id);
                } else if (target.classList.contains('btn-delete')) {
                    delProp(id);
                }
            });

            // Event Delegation for Image Removal
            document.querySelector('.upload-grid').addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-remove-img')) {
                    const previewBox = e.target.closest('.img-preview-box');
                    if (previewBox && previewBox.dataset.type) {
                        deleteSpecificImage(previewBox.dataset.type);
                    }
                }
            });

            // --- Tenant/Search Page ---
            document.getElementById('tenant-search-btn').addEventListener('click', searchProperties);
            document.getElementById('tenant-back-btn').addEventListener('click', goHome);
            document.querySelector('.filter-tabs').addEventListener('click', (e) => {
                if (e.target.classList.contains('ft-btn')) {
                    setSearchTab(e.target, e.target.dataset.value);
                }
            });

            // --- Property Detail Page ---
            document.getElementById('property-page-back-btn').addEventListener('click', closePropertyPage);

            // --- Modals (Lightbox & Filter) ---
            document.getElementById('lightbox').addEventListener('click', closeLightbox);
            document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
            document.getElementById('filter-modal-close').addEventListener('click', toggleFilter);
            document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
        }

        function deleteSpecificImage(type) {
            // 1. Remove from our memory
            currentImages[type] = ""; 
            
            // 2. Hide from UI
            document.getElementById(`preview-${type}`).style.display = 'none';
            
            // 3. Clear the file input (in case they selected something then deleted it)
            document.getElementById(`img-${type}`).value = "";
        }
        function toggleFilter() {
            document.getElementById('filter-modal').classList.toggle('hidden');
        }

        function selectOpt(groupId, el, value) {
            const group = document.getElementById(groupId);

            // Check if we are clicking the same button to "Unselect" it
            if (el.classList.contains('selected')) {
                el.classList.remove('selected');
                // Reset that specific filter
                if(groupId === 'f-listing') searchFilters.listingType = '';
                if(groupId === 'f-prop') searchFilters.propertyType = '';
                return;
            }

            // Otherwise, select the new one
            group.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('selected'));
            el.classList.add('selected');

            if(groupId === 'f-listing') searchFilters.listingType = value;
            if(groupId === 'f-prop') searchFilters.propertyType = value;
        }

        function updateRange(id, val, pre='', post='') {
            document.getElementById(id).innerText = val == 0 ? "Any" : pre + Number(val).toLocaleString() + post;
            if(id === 'price-val') searchFilters.price = val;
            if(id === 'sqft-val') searchFilters.sqft = val;
        }

        function applyFilters() {
            toggleFilter(); // Close modal
            showAuth('tenant'); // Go to tenant view
            // Trigger search immediately
            setTimeout(searchProperties, 500); 
        }
        // --- ADMIN FUNCTIONS ---
        async function loadAdminData() {
            try {
                const res = await fetch(`${API_URL}/admin/all-properties`);
                const data = await res.json();
                
                // 1. Update Text Stats
                document.getElementById('stat-users').innerText = data.stats.users;
                document.getElementById('stat-props').innerText = data.stats.listings;

                // 2. Populate Table
                const tbody = document.getElementById('admin-table-body');
                tbody.innerHTML = data.properties.map(p => {
                    const img = (p.images && p.images.outer) ? `<img src="${p.images.outer}" width="50" style="border-radius:4px;">` : 'No Img';
                    const verifyBtn = p.isVerified 
                        ? `<span class="status-badge" style="background:#def7ec; color:green;">Verified</span>` 
                        : `<button class="btn-sm bg-orange" onclick="verifyProp('${p._id}')">Verify</button>`;
                    
                    return `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:10px;">${img}</td>
                        <td>
                            <b>${p.area}</b><br>
                            <span style="font-size:12px; color:#666;">${p.listingType} • ₹${p.price}</span>
                        </td>
                        <td>${p.firstName}<br><small>${p.ownerEmail}</small></td>
                        <td>${verifyBtn}</td>
                        <td><button style="color:red; background:none; border:none; cursor:pointer;" onclick="deleteProp('${p._id}')"><i class="fas fa-trash"></i></button></td>
                    </tr>`;
                }).join('');

                // 3. DRAW CHART (New Logic)
                const rentCount = data.properties.filter(p => p.listingType === 'Rent').length;
                const buyCount = data.properties.filter(p => p.listingType === 'Buy').length;

                const ctx = document.getElementById('listingChart').getContext('2d');
                
                // Destroy old chart if refreshing
                if(adminChart) adminChart.destroy();

                adminChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['For Rent', 'For Sale'],
                        datasets: [{
                            data: [rentCount, buyCount],
                            backgroundColor: ['#6C63FF', '#2A2A72'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                });

            } catch(e) { console.error(e); }
        }

        async function verifyProp(id) {
            if(!confirm("Verify this property?")) return;
            await fetch(`${API_URL}/admin/verify/${id}`, { method: 'PUT' });
            loadAdminData();
        }
        function checkPendingSearch() { 
            console.log("Search checked"); 
        }
        // Re-using your existing deleteProp function, make sure it calls loadAdminData() if admin
        // (You can just use the delete button to call deleteProp, it works for both)

        // INIT
        setupEventListeners();
        loadFeatured();
        checkSession();