const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Built-in Node tool
const nodemailer = require('nodemailer');

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
    userType: { type: String, required: true },
    role: { type: String, default: 'user' },
    resetToken: String,
    resetTokenExpiry: Date,
    isVerified: { type: Boolean, default: false },
    otp: String
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

// EMAIL CONFIGURATION
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com', // Replace or use process.env.EMAIL_USER
        pass: 'your-app-password'     // Replace or use process.env.EMAIL_PASS
    }
});

// --- ROUTES ---

// 1. REGISTER
// 1. REGISTER (Updated with Admin Rule)
// 1. REGISTER (Send OTP)
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, phone, email, password, userType } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.json({ success: false, message: "User exists." });

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const role = (email === 'admin@estatepro.com') ? 'admin' : 'user';

        user = new User({ 
            firstName, lastName, phone, email, 
            password: hashedPassword, userType, role,
            otp: otp, // Save OTP to DB
            isVerified: false 
        });
        await user.save();

        // Send Email
        const mailOptions = {
            from: '"EstatePro Team" <no-reply@estatepro.com>',
            to: email,
            subject: 'Verify your Account',
            text: `Your Verification Code is: ${otp}`
        };
        
        // Use your existing transporter
        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: "OTP Sent to Email!", requireOtp: true, email: email });

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 1.2 RESEND OTP
app.post('/api/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.json({ success: false, message: "User not found" });
        if (user.isVerified) return res.json({ success: false, message: "Account already verified. Please Login." });

        // Generate New OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        await user.save();

        // Send Email
        const mailOptions = {
            from: '"EstatePro Team" <no-reply@estatepro.com>',
            to: email,
            subject: 'New Verification Code',
            text: `Your New Code is: ${otp}`
        };
        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: "New Code Sent!" });

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 1.5 VERIFY OTP
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.json({ success: false, message: "User not found" });
        
        if (user.otp === otp) {
            user.isVerified = true;
            user.otp = undefined; // Clear OTP after use
            await user.save();

            // Login successful now
            const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET);
            res.json({ success: true, message: "Account Verified!", token, role: user.role });
        } else {
            res.json({ success: false, message: "Invalid Code" });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. LOGIN
// 2. LOGIN (Check Verification)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "User not found." });

        // BLOCK IF NOT VERIFIED
        if (!user.isVerified) return res.json({ success: false, message: "Please verify your email first." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.json({ success: false, message: "Invalid Password" });

        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET);
        res.json({ success: true, message: "Login Successful", token, role: user.role });
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

// 9. FORGOT PASSWORD REQUEST
app.post('/api/forgot-password', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) return res.json({ success: false, message: "User not found" });

        // Generate Token
        const token = crypto.randomBytes(20).toString('hex');

        // Save to DB (Expires in 1 hour)
        user.resetToken = token;
        user.resetTokenExpiry = Date.now() + 3600000; 
        await user.save();

        // Create Link (Points to your frontend)
        // NOTE: In production, change http://localhost... to your Render URL
        const resetLink = `https://real-estate-app-nine-sepia.vercel.app/?resetToken=${token}`;

        // Send Email
        const mailOptions = {
            from: 'EstatePro Security',
            to: user.email,
            subject: 'Password Reset Request',
            text: `Click this link to reset your password: ${resetLink}\n\nIf you didn't ask for this, ignore it.`
        };

        // Try to send email, log to console if it fails (so you can still test)
        try {
            await transporter.sendMail(mailOptions);
        } catch (err) {
            console.log("Email failed (Check credentials). Link is:", resetLink);
        }

        res.json({ success: true, message: "Check your email (or server logs) for the link!" });

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 10. RESET PASSWORD ACTION
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // Find user with this token AND make sure it hasn't expired ($gt = Greater Than now)
        const user = await User.findOne({ 
            resetToken: token, 
            resetTokenExpiry: { $gt: Date.now() } 
        });

        if (!user) return res.json({ success: false, message: "Invalid or Expired Token" });

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update User
        user.password = hashedPassword;
        user.resetToken = undefined;       // Clear token
        user.resetTokenExpiry = undefined;
        await user.save();

        res.json({ success: true, message: "Password Changed! Please Login." });

    } catch (e) { res.status(500).json({ error: e.message }); }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));