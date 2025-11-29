// server.js - Advanced Version with Automation
const bcrypt = require('bcryptjs');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer'); // Tool for sending emails
const cron = require('node-cron');       // Tool for scheduling tasks

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ---------------------------------------------------------
// 1. DATABASE CONNECTION
// ---------------------------------------------------------
// REPLACE PASSWORD_HERE WITH YOUR REAL PASSWORD AGAIN
const dbURL = 'mongodb+srv://sabareeshu2007_db_user:Sabareesh$2007@cluster0.nanwaap.mongodb.net/?appName=Cluster0';

mongoose.connect(dbURL)
.then(() => console.log("✅ Database Connected"))
.catch(err => console.log("❌ DB Error: ", err));

// ---------------------------------------------------------
// 2. DATA MODELS
// ---------------------------------------------------------
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true },
    password: { type: String, required: true },
    userType: { type: String } 
});
const User = mongoose.model('User', UserSchema);

// --- UPDATED DATABASE MODEL ---
const PropertySchema = new mongoose.Schema({
    ownerEmail: String,
    // 1. Personal Details
    firstName: String,
    lastName: String,
    phone: String,
    // 2. Address Details
    houseNo: String,
    street: String,
    area: String,
    city: String,
    state: String,
    country: String,
    // 3. Map Coordinates
    lat: Number,
    lng: Number,
    // System
    status: { type: String, default: 'Pending Verification' },
    createdAt: { type: Date, default: Date.now },
    lastChecked: { type: Date, default: Date.now }
});
const Property = mongoose.model('Property', PropertySchema);

// --- UPDATED API ROUTES ---

// 1. List Property (Owner submits detailed form)
app.post('/api/list-property', async (req, res) => {
    try {
        console.log("Received Listing:", req.body.city);
        const newProperty = new Property(req.body); // Save all fields sent from frontend
        await newProperty.save();
        
        // (Optional: Email logic goes here)
        
        res.json({ success: true, message: "Property Listed Successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Search Properties (Tenant searches by City)
app.get('/api/search-properties', async (req, res) => {
    const { city } = req.query;
    try {
        // Case-insensitive search for the city
        // If city is empty, it returns nothing (or remove filter to return all)
        const query = city ? { city: { $regex: new RegExp(city, "i") } } : {};
        
        const properties = await Property.find(query);
        res.json({ success: true, properties });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------
// 3. EMAIL FUNCTION (The "Postman")
// ---------------------------------------------------------
async function sendWelcomeEmail(toEmail, address) {
    console.log(`📧 [EMAIL SYSTEM] Sending email to ${toEmail}...`);
    console.log(`   "Hello! Your property at ${address} is received. Sales team will verify in 48hrs."`);
    
    // --- REAL CODE (Uncomment and fill details to make it work) ---
    /*
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: 'your-gmail@gmail.com', pass: 'your-app-password' }
    });

    await transporter.sendMail({
        from: 'RealEstateApp',
        to: toEmail,
        subject: 'Property Listed Successfully',
        text: `Your property at ${address} is listed! Verification pending.`
    });
    */
}

// ---------------------------------------------------------
// 4. AI SCHEDULER (The "Alarm Clock")
// ---------------------------------------------------------
// This runs automatically every minute to check for properties
// ---------------------------------------------------------
// 4. AI SCHEDULER (The Smart Alarm Clock)
// ---------------------------------------------------------
cron.schedule('* * * * *', async () => {
    console.log('⏳ [AI SYSTEM] Checking for properties to call...');

    // 1. Calculate the time: 3 minutes ago
    // (In real life, you would change this to 5 * 24 * 60 * 60 * 1000 for "5 days")
    const cutoffTime = new Date(Date.now() - 3 * 60 * 1000);

    // 2. Find properties that are Pending AND haven't been checked recently
    const properties = await Property.find({
        status: 'Pending Verification',
        lastChecked: { $lt: cutoffTime } // "$lt" means "Less Than" (Older than 3 mins)
    });

    if (properties.length === 0) {
        console.log("   ✅ No calls needed right now.");
        return;
    }

    // 3. Call them
    properties.forEach(async (prop) => {
        console.log(`   📞 AI CALLING owner of ${prop.address}...`);
        
        // Update the "lastChecked" time to NOW so they don't get called again immediately
        prop.lastChecked = new Date();
        await prop.save();
    });
});

// ---------------------------------------------------------
// 5. API ROUTES
// ---------------------------------------------------------
app.post('/api/login', async (req, res) => {
    const { email, password, userType } = req.body;

    try {
        let user = await User.findOne({ email });

        if (user) {
            // USER EXISTS: Check Password Security
            // We compare the plain password with the encrypted hash
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                res.json({ success: true, message: "Login Successful", user });
            } else {
                res.json({ success: false, message: "Invalid Credentials" });
            }
        } else {
            // USER DOES NOT EXIST: Create New (Securely)

            // 1. Encrypt the password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // 2. Save user with the HASHED password (not the real one)
            const newUser = new User({ 
                email, 
                password: hashedPassword, // <--- Secure!
                userType 
            });

            await newUser.save();
            res.json({ success: true, message: "New Secure Account Created", user: newUser });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/list-property', async (req, res) => {
    const { ownerEmail, address } = req.body;
    console.log("New Listing:", address);
    
    try {
        const newProperty = new Property({
            ownerEmail,
            address,
            status: 'Pending Verification'
        });
        await newProperty.save();

        // TRIGGER THE EMAIL!
        // --- REPLACE THE OLD sendWelcomeEmail FUNCTION WITH THIS ---

async function sendWelcomeEmail(toEmail, address) {
    console.log(`📧 Sending email to ${toEmail}...`);

    // 1. Setup the Email Service
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'YOUR_REAL_GMAIL@gmail.com', // <--- Put your email here
            pass: 'abcd efgh ijkl mnop'        // <--- Put your 16-char App Password here
        }
    });

    // 2. Send the Email
    try {
        await transporter.sendMail({
            from: '"EstatePro Admin" <your-email@gmail.com>',
            to: toEmail,
            subject: 'Property Listing Received',
            text: `Hello,\n\nYour property at ${address} has been received. Our sales team will verify your documents within 48 hours.\n\nThank you!`
        });
        console.log("✅ Email sent successfully via Gmail!");
    } catch (error) {
        console.log("❌ Email Failed:", error);
    }
}

        res.json({ success: true, message: "Property saved & Email sent" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ADD THIS TO SERVER.JS (Before app.listen)

// Get Properties Route (To show them on the dashboard)
// --- REPLACE THE OLD /api/search-properties ROUTE WITH THIS ---

app.get('/api/search-properties', async (req, res) => {
    const { query } = req.query; // We will send 'query' instead of 'city'
    try {
        if (!query) return res.json({ success: true, properties: [] });

        // SMART SEARCH: Look inside City OR Area OR Street
        const searchRegex = new RegExp(query, "i"); // "i" means case-insensitive
        
        const properties = await Property.find({
            $or: [
                { city: searchRegex },
                { area: searchRegex },
                { street: searchRegex }
            ]
        });
        
        res.json({ success: true, properties });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Get Owner Properties (For Dashboard)
app.get('/api/my-properties', async (req, res) => {
    const { email } = req.query;
    try {
        const props = await Property.find({ ownerEmail: email });
        res.json({ success: true, properties: props });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// START
app.listen(3000, () => {
    console.log('🚀 Server with AI Scheduler is running on port 3000');
});