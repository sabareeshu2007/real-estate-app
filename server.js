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
const dbURL = 'mongodb+srv://sabareeshu2007_db_user:Sabareesh$2007@cluster0.nanwaap.mongodb.net/?appName=Cluster0';

mongoose.connect(dbURL)
.then(() => console.log("✅ Database Connected"))
.catch(err => console.log("❌ DB Error: ", err));

// --- SCHEMAS ---
const UserSchema = new mongoose.Schema({
    firstName: String, lastName: String, phone: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userType: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const PropertySchema = new mongoose.Schema({
    ownerEmail: String,
    // Contact Info
    firstName: String, phone: String,
    // Address Details
    houseNo: String, street: String, area: String,
    city: String, state: String, country: String,
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
    status: { type: String, default: 'Pending Verification' },
    createdAt: { type: Date, default: Date.now }
});
const Property = mongoose.model('Property', PropertySchema);

// --- ROUTES ---

// 1. REGISTER
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, phone, email, password, userType } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.json({ success: false, message: "User already exists." });

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ firstName, lastName, phone, email, password: hashedPassword, userType });
        await user.save();

        const token = jwt.sign({ id: user._id, email: user.email, type: userType }, JWT_SECRET);
        res.json({ success: true, message: "Account Created!", token });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. LOGIN
app.post('/api/login', async (req, res) => {
    const { email, password, userType } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "User not found." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.json({ success: false, message: "Invalid Password" });

        if(user.userType !== userType) return res.json({ success: false, message: `Please login as ${user.userType}` });

        const token = jwt.sign({ id: user._id, email: user.email, type: user.userType }, JWT_SECRET);
        res.json({ success: true, message: "Login Successful", token });
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
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 6. UPDATE PROPERTY
app.put('/api/update-property/:id', async (req, res) => {
    try {
        await Property.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 7. SEARCH (For Tenant Map)
app.get('/api/search-properties', async (req, res) => {
    try {
        const query = req.query.query;
        if (!query) return res.json({ success: true, properties: [] });
        const regex = new RegExp(query, "i");
        const props = await Property.find({ $or: [{ city: regex }, { area: regex }, { street: regex }] });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));