const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Built-in Node tool

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- CONFIGURATION ---
const JWT_SECRET = 'secret_key_123';
// ⚠️ PASTE YOUR MONGODB CONNECTION STRING HERE
const dbURL =process.env.MONGO_URL;

mongoose.connect(dbURL)
.then(() => console.log("✅ Database Connected"))
.catch(err => console.log("❌ DB Error: ", err));

// --- SCHEMAS ---
const UserSchema = new mongoose.Schema({
    firstName: String, 
    lastName: String, 
    // Phone is now REQUIRED and UNIQUE
    phone: { type: String, required: true, unique: true }, 
    email: { type: String }, // Email is now optional
    password: { type: String, required: true },
    userType: { type: String, required: true },
    role: { type: String, default: 'user' },
    isVerified: { type: Boolean, default: true } // Auto-verify since we aren't doing SMS yet
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
// 1. REGISTER (Send OTP)
// 1. REGISTER (Phone Based)
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, phone, email, password, userType } = req.body;
    try {
        // Check if PHONE exists (not email)
        let user = await User.findOne({ phone });
        if (user) return res.json({ success: false, message: "Phone number already registered." });

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // MAGIC ADMIN RULE: This specific phone number becomes Admin
        const role = (phone === '9999999999') ? 'admin' : 'user';

        user = new User({ 
            firstName, lastName, phone, email, 
            password: hashedPassword, userType, role,
            isVerified: true // Skip verification for now (Stability First)
        });
        await user.save();

        const token = jwt.sign({ id: user._id, phone: user.phone, role: role }, JWT_SECRET);
        res.json({ success: true, message: "Account Created!", token, role });

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. LOGIN
// 2. LOGIN (Check Verification)
// 2. LOGIN (Phone Based)
app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body; // Expect phone, not email
    try {
        const user = await User.findOne({ phone });
        if (!user) return res.json({ success: false, message: "Phone number not found." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.json({ success: false, message: "Invalid Password" });

        const token = jwt.sign({ id: user._id, phone: user.phone, role: user.role }, JWT_SECRET);
        res.json({ success: true, message: "Login Successful", token, role: user.role, userType: user.userType });
    } catch (e) { res.status(500).json({ error: e.message }); }
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
        await Property.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Deleted" });
    } catch (e) { res.status(500).json({ error: e.message }); }
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));