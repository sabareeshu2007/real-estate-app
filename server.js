require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- CONFIGURATION ---
const JWT_SECRET = 'secret_key_123';
// ⚠️ PASTE YOUR MONGODB CONNECTION STRING HERE
const dbURL = process.env.MONGO_URL; // Read the secret key

mongoose.connect(dbURL)
.then(() => console.log("✅ Database Connected"))
.catch(err => console.log("❌ DB Error: ", err));

// --- SCHEMAS ---
const UserSchema = new mongoose.Schema({
    firstName: String, lastName: String, phone: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userType: { type: String, required: true },
    role: { type: String, default: 'user' },
    favorites: [String] // <--- ADD THIS LINE (Stores Property IDs)
});
const User = mongoose.model('User', UserSchema);

const PropertySchema = new mongoose.Schema({
    ownerEmail: String,
    // Contact Info
    firstName: String, phone: String,
    // Address Details
    houseNo: String, street: String, area: String,
    city: String, state: String, country: String,
    // --- PASTE THIS INSIDE PropertySchema ---
    listingType: String,  // 'Buy' or 'Rent'
    propertyType: String, // 'Office', 'Shop', 'House'
    buildingType: String, // 'Mall', 'Independent'
    parking: String,      // 'Public', 'Reserved'
    furnishing: String,   // 'Full', 'Semi', 'None'
    // ----------------------------------------
    // Property Specs
    price: Number,
    sqft: Number,
    bedrooms: Number,
    bathrooms: Number,
    furnishing: String,
    description: String,
    amenities: [String], 
    // REPLACEMENT CODE:
    images: {
        outer: String,
        hall: String,
        bedroom: String,
        kitchen: String,
        bathroom: String
    },
    // Map Location
    lat: Number, lng: Number,
    // System Status
    isVerified: { type: Boolean, default: false },
    status: { type: String, default: 'Pending Verification' },
    createdAt: { type: Date, default: Date.now }
});
const Property = mongoose.model('Property', PropertySchema);

// --- ROUTES ---

// 1. REGISTER
// 1. REGISTER (Updated with Admin Rule)
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, phone, email, password, userType } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.json({ success: false, message: "User already exists." });

        const hashedPassword = await bcrypt.hash(password, 10);

        // --- PASTE STARTS HERE ---
        // MAGIC ADMIN RULE: Check if email matches, assign 'admin' role
        const role = (email === 'admin@estatepro.com') ? 'admin' : 'user';

        // Create User WITH role
        user = new User({ 
            firstName, 
            lastName, 
            phone, 
            email, 
            password: hashedPassword, 
            userType, 
            role // <--- Added here
        });
        await user.save();

        // Add role to Token
        const token = jwt.sign({ id: user._id, email: user.email, role: role }, JWT_SECRET);
        
        // Send role back to frontend
        res.json({ success: true, message: "Account Created!", token, role });
        // --- PASTE ENDS HERE ---

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. LOGIN
// SEARCH FOR THIS IN SERVER.JS
// 2. LOGIN (CORRECTED)
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, userType } = req.body;

        // 1. Find user
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "User not found" });

        // 2. Check Password using BCRYPT
        // We compare the typed password with the hashed password in the DB
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) { 
            return res.json({ success: false, message: "Wrong password" });
        }

        // 3. Generate Token
        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET);

        // 4. Send Response
        res.json({ 
            success: true, 
            token: token, 
            role: user.role,       // Admin or User
            userType: user.userType, // <--- ADD THIS LINE (Owner or Tenant)
            name: user.firstName 
        });

    } catch (e) {
        console.log(e);
        res.status(500).json({ success: false, error: "Server Error" });
    }
});

// 3. CREATE LISTING
app.post('/api/list-property', async (req, res) => {
    try {
        const newProperty = new Property(req.body);
        await newProperty.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. GET MY PROPERTIES
app.get('/api/my-properties', async (req, res) => {
    try {
        const props = await Property.find({ ownerEmail: req.query.email });
        res.json({ success: true, properties: props });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. DELETE PROPERTY
app.delete('/api/delete-property/:id', async (req, res) => {
    try {
        const id = req.params.id;
        // Assuming you are using MongoDB/Mongoose
        const result = await Property.findByIdAndDelete(id);
        
        if (result) {
            res.json({ success: true, message: "Property deleted successfully" });
        } else {
            res.status(404).json({ success: false, error: "Property not found" });
        }
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ success: false, error: "Server error during deletion" });
    }
});
// 6. UPDATE PROPERTY
app.put('/api/update-property/:id', async (req, res) => {
    try {
        await Property.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 7. ADVANCED SEARCH ROUTE
app.get('/api/search-properties', async (req, res) => {
    try {
        const { 
            query, maxPrice, maxSqft, 
            listingType, propertyType, furnishing, buildingType, parking 
        } = req.query;
        
        let dbQuery = { status: { $ne: 'Rented' } }; 

        // Text Search
        if (query) {
            const regex = new RegExp(query, "i");
            dbQuery.$or = [{ city: regex }, { area: regex }, { street: regex }];
        }

        // Range Filters
        if (maxPrice) dbQuery.price = { $lte: Number(maxPrice) };
        if (maxSqft) dbQuery.sqft = { $lte: Number(maxSqft) };

        // Dropdown Filters
        if (listingType) dbQuery.listingType = listingType;
        if (propertyType) dbQuery.propertyType = propertyType;
        if (furnishing) dbQuery.furnishing = furnishing;
        if (buildingType) dbQuery.buildingType = buildingType;
        if (parking) dbQuery.parking = parking;

        const props = await Property.find(dbQuery);
        res.json({ success: true, properties: props });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 8. FEATURED (For Home Page)
app.get('/api/featured-properties', async (req, res) => {
    try {
        const props = await Property.find().sort({ createdAt: -1 }).limit(3);
        res.json({ success: true, properties: props });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
// --- ADMIN ROUTES ---
app.get('/api/admin/all-properties', async (req, res) => {
    try {
        const props = await Property.find().sort({ createdAt: -1 });
        const userCount = await User.countDocuments();
        res.json({ success: true, properties: props, stats: { users: userCount, listings: props.length } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/verify/:id', async (req, res) => {
    try {
        const prop = await Property.findById(req.params.id);
        prop.isVerified = !prop.isVerified; // Toggle
        prop.status = prop.isVerified ? 'Verified' : 'Pending';
        await prop.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- TEMPORARY ADMIN FIX ---
// Visit this URL in your browser to turn any user into an admin
app.get('/api/admin-fix/:email', async (req, res) => {
    try {
        const email = req.params.email;
        // Find user and force role to 'admin'
        const updatedUser = await User.findOneAndUpdate(
            { email: email },
            { role: 'admin' },
            { new: true }
        );
        res.json({ success: true, message: "User is now an ADMIN!", user: updatedUser });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// TOGGLE FAVORITE (Add/Remove)
app.post('/api/toggle-favorite', async (req, res) => {
    try {
        const { email, propertyId } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) return res.json({ success: false, message: "User not found" });

        // Initialize array if it doesn't exist
        if (!user.favorites) user.favorites = [];

        const index = user.favorites.indexOf(propertyId);
        let action = '';

        if (index === -1) {
            // Not in list -> ADD it
            user.favorites.push(propertyId);
            action = 'added';
        } else {
            // Already in list -> REMOVE it
            user.favorites.splice(index, 1);
            action = 'removed';
        }

        await user.save();
        res.json({ success: true, action: action, favorites: user.favorites });

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET USER FAVORITES
app.get('/api/user-favorites/:email', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email });
        res.json({ success: true, favorites: user ? user.favorites : [] });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));