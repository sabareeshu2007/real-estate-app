const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- CONFIGURATION ---
// REPLACE WITH YOUR REAL CREDENTIALS
const JWT_SECRET = 'your_super_secret_key_123'; 
const dbURL = 'mongodb+srv://sabareeshu2007_db_user:Sabareesh$2007@cluster0.nanwaap.mongodb.net/?appName=Cluster0';

mongoose.connect(dbURL)
.then(() => console.log("✅ Database Connected"))
.catch(err => console.log("❌ DB Error: ", err));

// --- SCHEMAS ---
const UserSchema = new mongoose.Schema({
    firstName: String, // Added
    lastName: String,  // Added
    phone: String,     // Added
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userType: { type: String, required: true } // 'owner' or 'tenant'
});
const User = mongoose.model('User', UserSchema);

const PropertySchema = new mongoose.Schema({
    ownerEmail: String,
    firstName: String,
    phone: String,
    houseNo: String,
    street: String,
    area: String,
    city: String,
    lat: Number,
    lng: Number,
    status: { type: String, default: 'Pending Verification' },
    createdAt: { type: Date, default: Date.now },
    lastChecked: { type: Date, default: Date.now }
});
const Property = mongoose.model('Property', PropertySchema);

// --- AUTH ROUTES (SPLIT) ---

// 1. REGISTER (Sign Up)
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, phone, email, password, userType } = req.body;
    try {
        // Check if user exists
        let user = await User.findOne({ email });
        if (user) return res.json({ success: false, message: "User already exists. Please Login." });

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create New User
        user = new User({ 
            firstName, lastName, phone, email, 
            password: hashedPassword, 
            userType 
        });
        await user.save();

        // Create Token
        const token = jwt.sign({ id: user._id, email: user.email, type: userType }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ success: true, message: "Account Created!", token, userType });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. LOGIN (Sign In)
app.post('/api/login', async (req, res) => {
    const { email, password, userType } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "User not found. Please Sign Up." });

        // Verify Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.json({ success: false, message: "Invalid Credentials" });

        // Verify correct portal (e.g. Tenant trying to login as Owner)
        if(user.userType !== userType) return res.json({ success: false, message: `Please login as ${user.userType}` });

        const token = jwt.sign({ id: user._id, email: user.email, type: user.userType }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ success: true, message: "Login Successful", token, userType: user.userType });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- APP ROUTES ---

app.post('/api/list-property', async (req, res) => {
    try {
        const newProperty = new Property(req.body);
        await newProperty.save();
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/my-properties', async (req, res) => {
    try {
        const props = await Property.find({ ownerEmail: req.query.email });
        res.json({ success: true, properties: props });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/search-properties', async (req, res) => {
    try {
        const query = req.query.query;
        if (!query) return res.json({ success: true, properties: [] });
        const regex = new RegExp(query, "i");
        const properties = await Property.find({ $or: [{ city: regex }, { area: regex }, { street: regex }] });
        res.json({ success: true, properties });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));