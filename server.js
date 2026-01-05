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
const SECRET_KEY = process.env.SECRET_KEY || 'my-secret-key-123';
// ⚠️ PASTE YOUR MONGODB CONNECTION STRING HERE
const dbURL = process.env.MONGO_URL; // Read the secret key

mongoose.connect(dbURL)
.then(() => console.log("✅ Database Connected"))
.catch(err => console.log("❌ DB Error: ", err));

// --- UPDATED USER SCHEMA (Phone is Primary) ---
const userSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true }, // Primary ID
    email: { type: String }, // Optional/Secondary
    password: { type: String, required: true },
    userType: { type: String, enum: ['owner', 'tenant', 'admin'], default: 'tenant' },
    firstName: String,
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
    createdAt: { type: Date, default: Date.now }
});

// --- OTP SCHEMA (Phone Based) ---
const otpSchema = new mongoose.Schema({
    phone: { type: String, required: true },
    otp: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 300 } // Expires in 5 mins
});
const Otp = mongoose.model('Otp', otpSchema);

const User = mongoose.model('User', userSchema);

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

// 1. Register with Phone + OTP
app.post('/api/register', async (req, res) => {
    try {
        let { phone, otp, password, firstName, email, userType } = req.body;
        
        // 1. CLEAN THE PHONE NUMBER (Remove spaces)
        phone = phone.trim();

        console.log(`📝 Registering: ${phone}`); // Debug Log

        // Verify OTP
        const validOtp = await Otp.findOne({ phone, otp });
        if (!validOtp) {
            console.log("❌ Register Failed: Invalid OTP");
            return res.json({ success: false, message: "Invalid or Expired OTP" });
        }

        // Check if user already exists
        const existing = await User.findOne({ phone });
        if(existing) {
             console.log("❌ Register Failed: User already exists");
             return res.json({ success: false, message: "Phone number already registered" });
        }

        // Create User
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ 
            phone, 
            email, 
            firstName, 
            password: hashedPassword, 
            userType 
        });
        await user.save();
        
        // Delete used OTP
        await Otp.deleteMany({ phone });

        console.log(`✅ User Created: ${phone}`);

        const token = jwt.sign({ userId: user._id, role: user.userType }, SECRET_KEY);
        res.json({ success: true, token, role: 'user', userType: user.userType });

    } catch (e) { 
        console.error("Server Error:", e);
        res.status(500).json({ success: false, message: e.message }); 
    }
});

// 3. Login with Phone + Password
app.post('/api/login', async (req, res) => {
    try {
        let { phone, password } = req.body;
        
        // 1. CLEAN THE PHONE NUMBER (Remove spaces)
        phone = phone.trim();

        console.log(`🔐 Login Attempt: ${phone}`); // Debug Log

        const user = await User.findOne({ phone });

        if (!user) {
            console.log("❌ Login Failed: User Not Found in DB");
            return res.json({ success: false, message: "User not found. Please Register." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log("❌ Login Failed: Wrong Password");
            return res.json({ success: false, message: "Wrong Password" });
        }

        console.log(`✅ Login Success: ${phone}`);

        const token = jwt.sign({ userId: user._id, role: user.userType }, SECRET_KEY);
        res.json({ success: true, token, role: 'user', userType: user.userType, email: user.email });

    } catch (e) { 
        console.error("Server Error:", e);
        res.status(500).json({ error: e.message }); 
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

// GET FULL FAVORITE PROPERTIES
app.post('/api/get-favorites-details', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        
        if (!user || !user.favorites || user.favorites.length === 0) {
            return res.json({ success: true, properties: [] });
        }

        // Find all properties whose ID is IN the user's favorite list
        const favProps = await Property.find({ _id: { $in: user.favorites } });
        res.json({ success: true, properties: favProps });

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PHONE AUTH ROUTES ---

// 1. Send OTP (Simulation Mode)
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone, isLogin } = req.body;

        // Check user existence based on flow
        const existingUser = await User.findOne({ phone });
        
        if (!isLogin && existingUser) {
            return res.json({ success: false, message: "Phone already registered. Please Login." });
        }
        if (isLogin && !existingUser) {
            return res.json({ success: false, message: "Phone not found. Please Register first." });
        }

        // Generate 4-digit Code
        const code = Math.floor(1000 + Math.random() * 9000).toString();

        // Save to DB
        await Otp.deleteMany({ phone }); // Clear old OTPs
        await new Otp({ phone, otp: code }).save();

        // --- SIMULATION: LOG TO CONSOLE ---
        console.log(`=========================================`);
        console.log(`🔐 OTP for ${phone} is: ${code}`);
        console.log(`=========================================`);
        // ----------------------------------

        // NOTE: Later, replace the console.log above with a real SMS API call (e.g., Twilio/Fast2SMS)
        
        res.json({ success: true, message: "OTP sent! Check Server Console." });

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Register with Phone + OTP
app.post('/api/register', async (req, res) => {
    try {
        const { phone, otp, password, firstName, email, userType } = req.body;

        // Verify OTP
        const validOtp = await Otp.findOne({ phone, otp });
        if (!validOtp) return res.json({ success: false, message: "Invalid or Expired OTP" });

        // Create User
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ 
            phone, 
            email, 
            firstName, 
            password: hashedPassword, 
            userType 
        });
        await user.save();
        
        // Delete used OTP
        await Otp.deleteMany({ phone });

        // Generate Token
        const token = jwt.sign({ userId: user._id, role: user.userType }, SECRET_KEY);
        res.json({ success: true, token, role: 'user', userType: user.userType });

    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 3. Login with Phone + Password
app.post('/api/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const user = await User.findOne({ phone });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.json({ success: false, message: "Invalid Phone or Password" });
        }

        const token = jwt.sign({ userId: user._id, role: user.userType }, SECRET_KEY);
        // Include email in response so frontend can save it if needed
        res.json({ success: true, token, role: 'user', userType: user.userType, email: user.email });

    } catch (e) { res.status(500).json({ error: e.message }); }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));