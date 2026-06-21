// server.js - Full-Stack Express Backend for TerraTrack

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Global Exception Catchers to Prevent Process Crashing
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'terratrack_secure_jwt_secret_key_13579';

// ==========================================================================
// SECURITY CONFIGURATIONS & MIDDLEWARES
// ==========================================================================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());

// Limit JSON payload size to 10kb to prevent memory exhaustion attacks
app.use(express.json({ limit: '10kb' }));

// Serve static frontend assets from public/ folder
app.use(express.static(path.join(__dirname, 'public')));

// Global API Rate Limiting (Disabled as requested)
const globalLimiter = (req, res, next) => next();
const authLimiter = (req, res, next) => next();
const aiLimiter = (req, res, next) => next();

// ==========================================================================
// ATOMIC JSON DATABASE CONTROLLER (Anti-Corruption Writes)
// ==========================================================================
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'db.json');

// Initialize DB if not exists
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({}), 'utf8');
}

function readDB() {
    try {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        console.error("Database read failure:", e);
        return {};
    }
}

function writeDB(data) {
    const tmpPath = `${DB_PATH}.tmp`;
    try {
        // Write to temporary file first, then rename atomically.
        // This prevents corrupted db.json files if the node process crashes mid-write.
        fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tmpPath, DB_PATH);
        return true;
    } catch (e) {
        console.error("Database write failure:", e);
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        return false;
    }
}

// ==========================================================================
// SECURITY JWT AUTHENTICATION MIDDLEWARE
// ==========================================================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied. Token missing.' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
}

// ==========================================================================
// AUTH ROUTE HANDLERS
// ==========================================================================
app.post('/api/auth/signup', authLimiter, (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        
        const cleanEmail = email.trim().toLowerCase();
        
        const db = readDB();
        if (db[cleanEmail]) {
            return res.status(400).json({ error: 'An account with this email already exists.' });
        }
        
        // Secure Hash password
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);
        
        db[cleanEmail] = {
            name: name.trim(),
            email: cleanEmail,
            password: hashedPassword,
            responses: null,
            completedActions: []
        };
        
        writeDB(db);
        
        // Sign token
        const token = jwt.sign({ email: cleanEmail }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ token, name: db[cleanEmail].name });
    } catch (e) {
        res.status(500).json({ error: 'Server error during sign up.' });
    }
});

app.post('/api/auth/login', authLimiter, (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }
        
        const cleanEmail = email.trim().toLowerCase();
        const db = readDB();
        const user = db[cleanEmail];
        
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Invalid email address or password.' });
        }
        
        const token = jwt.sign({ email: cleanEmail }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, name: user.name });
    } catch (e) {
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// ==========================================================================
// USER PROFILE & QUIZ DATA ROUTES
// ==========================================================================
app.get('/api/profile', authenticateToken, (req, res) => {
    try {
        const db = readDB();
        const user = db[req.user.email];
        
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        
        res.json({
            name: user.name,
            email: user.email,
            responses: user.responses,
            completedActions: user.completedActions
        });
    } catch (e) {
        res.status(500).json({ error: 'Server error fetching profile.' });
    }
});

app.post('/api/profile', authenticateToken, (req, res) => {
    try {
        const { responses, name } = req.body;
        
        const db = readDB();
        const user = db[req.user.email];
        
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        
        if (name) user.name = name.trim();
        if (responses) user.responses = responses;
        
        writeDB(db);
        res.json({ success: true, user: { name: user.name, responses: user.responses, completedActions: user.completedActions } });
    } catch (e) {
        res.status(500).json({ error: 'Server error saving profile answers.' });
    }
});

app.post('/api/profile/actions', authenticateToken, (req, res) => {
    try {
        const { completedActions } = req.body;
        if (!Array.isArray(completedActions)) {
            return res.status(400).json({ error: 'Invalid completedActions parameter.' });
        }
        
        const db = readDB();
        const user = db[req.user.email];
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        
        user.completedActions = completedActions;
        writeDB(db);
        
        res.json({ success: true, completedActions: user.completedActions });
    } catch (e) {
        res.status(500).json({ error: 'Server error saving actions.' });
    }
});

// ==========================================================================
// GEMINI AI & OPENROUTER INTEGRATION ROUTES
// ==========================================================================
async function callOpenRouter(apiKey, modelName, messages) {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "http://localhost:5000",
                "X-Title": "TerraTrack Carbon Footprint",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: modelName || "google/gemma-2-27b-it", // Default to paid Gemma 2 27B model
                messages: messages
            })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || `OpenRouter returned status ${response.status}`);
        }
        if (!data.choices || data.choices.length === 0) {
            throw new Error("Invalid response choices returned from OpenRouter.");
        }
        return data.choices[0].message.content;
    } catch (err) {
        throw new Error(`OpenRouter Request Failed: ${err.message}`);
    }
}

function getAPIClientDetails(req, res) {
    const clientKey = req.headers['x-gemini-key'];
    const serverKey = process.env.GEMINI_API_KEY;
    const clientModel = req.headers['x-ai-model'];
    
    const apiKey = (clientKey && clientKey.trim() !== '') ? clientKey : 
                   (serverKey && serverKey !== 'YOUR_GEMINI_API_KEY_HERE' ? serverKey : null);
                   
    if (!apiKey) {
        res.status(400).json({ 
            error: 'AI Key Missing',
            details: 'No API key configured. Please enter your key in the Profile Settings dropdown in the top-right header.'
        });
        return null;
    }
    
    const isOpenRouter = apiKey.startsWith('sk-or-');
    
    return {
        apiKey,
        isOpenRouter,
        modelName: clientModel || (isOpenRouter ? "google/gemma-2-27b-it" : "gemini-1.5-flash")
    };
}

app.post('/api/ai/insights', aiLimiter, authenticateToken, async (req, res) => {
    try {
        const clientDetails = getAPIClientDetails(req, res);
        if (!clientDetails) return; // response handled in helper
        
        const { calculations, responses } = req.body;
        if (!calculations || !responses) {
            return res.status(400).json({ error: 'Missing calculation payload.' });
        }
        
        const systemInstruction = "You are an expert environmental consultant and carbon footprint analyst.";
        const prompt = `
            Provide a personalized carbon emission diagnosis for:
            - Name: ${responses.name}
            - Age: ${responses.age}
            - Location: ${responses.city} (${responses.citytype})
            - Household size: ${responses.household} occupants
            
            Their calculated annual carbon footprint is ${calculations.total} metric tons of CO2e.
            Here is the category-wise breakdown (in Metric Tons per year):
            - Transport: ${calculations.transport} tons
            - Food: ${calculations.food} tons
            - Home Energy: ${calculations.energy} tons
            - Waste: ${calculations.waste} tons
            - Daily Routine Setting: ${calculations.routine} tons
            
            Write a short, engaging diagnosis (3 paragraphs maximum). Include:
            1. An assessment of which category is their highest emission "hotspot" and why.
            2. Concrete, local suggestions suitable for their city (${responses.city}) and city setting (${responses.citytype}).
            3. A supportive, encouraging note.
            
            Keep the response formatted in clean HTML (using tags like <p>, <strong>, <ul>, <li>). Do not use markdown syntax, markdown code blocks, or <html>/<body> tags. Return ONLY the content inside.
        `;
        
        if (clientDetails.isOpenRouter) {
            // OpenRouter flow
            const messages = [
                { role: "system", content: systemInstruction },
                { role: "user", content: prompt }
            ];
            const text = await callOpenRouter(clientDetails.apiKey, clientDetails.modelName, messages);
            res.json({ insights: text });
        } else {
            // Google Gemini SDK flow
            const genAI = new GoogleGenerativeAI(clientDetails.apiKey);
            const model = genAI.getGenerativeModel({ model: clientDetails.modelName });
            
            // Concat system instruction for SDK call
            const fullPrompt = `${systemInstruction}\n\n${prompt}`;
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            const text = response.text();
            res.json({ insights: text });
        }
    } catch (e) {
        console.error("AI Insights API failure:", e);
        res.status(500).json({ error: `AI Generation failed: ${e.message}. Please verify your API Key.` });
    }
});

app.post('/api/ai/chat', aiLimiter, authenticateToken, async (req, res) => {
    try {
        const clientDetails = getAPIClientDetails(req, res);
        if (!clientDetails) return;
        
        let { message, history } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message cannot be empty.' });
        }
        
        message = message.substring(0, 300);
        
        const db = readDB();
        const user = db[req.user.email];
        const responses = user ? user.responses : null;
        
        let contextInstruction = `You are a supportive Eco-assistant chatbot built into TerraTrack. Your purpose is to help the user reduce their carbon footprint through simple actions. Keep responses friendly, structured, concise, and focused on green living.`;
        if (responses) {
            contextInstruction += ` The user is ${responses.name}, lives in ${responses.city} (${responses.citytype}), has a household size of ${responses.household}, and eats a ${responses.diet} diet. Keep recommendations highly contextual to this profile.`;
        }
        
        if (clientDetails.isOpenRouter) {
            // OpenRouter Flow
            const messages = [
                { role: "system", content: contextInstruction }
            ];
            if (Array.isArray(history)) {
                const truncatedHistory = history.slice(-6);
                truncatedHistory.forEach(msg => {
                    messages.push({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.text
                    });
                });
            }
            messages.push({ role: "user", content: message });
            
            const replyText = await callOpenRouter(clientDetails.apiKey, clientDetails.modelName, messages);
            res.json({ reply: replyText });
        } else {
            // Google Gemini SDK Flow
            const genAI = new GoogleGenerativeAI(clientDetails.apiKey);
            const model = genAI.getGenerativeModel({ model: clientDetails.modelName });
            
            const chatHistory = [];
            if (Array.isArray(history)) {
                const truncatedHistory = history.slice(-6);
                truncatedHistory.forEach(msg => {
                    chatHistory.push({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.text }]
                    });
                });
            }
            
            const chat = model.startChat({
                history: chatHistory,
                systemInstruction: contextInstruction
            });
            
            const result = await chat.sendMessage(message);
            const response = await result.response;
            const replyText = response.text();
            res.json({ reply: replyText });
        }
    } catch (e) {
        console.error("AI Chat API failure:", e);
        res.status(500).json({ error: `AI Chat failed: ${e.message}. Please verify your API Key.` });
    }
});

// ==========================================================================
// FALLBACK STATIC SITE SERVER
// ==========================================================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================================================
// ERROR-HANDLING MIDDLEWARE (CRASH PREVENTION)
// ==========================================================================
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error Intercepted:', err);
    res.status(500).json({ error: 'An unexpected server error occurred. The server remains online.' });
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`=========================================`);
        console.log(` TerraTrack Server running on port ${PORT} `);
        console.log(` Health: OK | Security Shields: ACTIVE `);
        console.log(`=========================================`);
    });
}

module.exports = app;
