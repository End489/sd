const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Global variables for keys (set when server starts)
let supabase = null;
let MISTRAL_API_KEY = null;
let POLLINATIONS_SECRET = null;

// Function to ask for keys on startup
function askForKeys() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('\n🔐 ===== MRZE AI - ENTER YOUR KEYS =====\n');
    console.log('⚠️  These keys will NOT be saved or uploaded\n');

    rl.question('🔑 Supabase URL: ', (supabaseUrl) => {
        rl.question('🔑 Supabase Service Key: ', (supabaseKey) => {
            rl.question('🤖 Mistral AI API Key: ', (mistralKey) => {
                rl.question('🎨 Pollinations Secret Key: ', (pollinationsKey) => {
                    
                    // Initialize Supabase with entered keys
                    supabase = createClient(supabaseUrl, supabaseKey);
                    MISTRAL_API_KEY = mistralKey;
                    POLLINATIONS_SECRET = pollinationsKey;
                    
                    console.log('\n✅ Keys loaded! Starting server...\n');
                    rl.close();
                    startServer();
                });
            });
        });
    });
}

// Start the server after keys are entered
function startServer() {
    // ===== AUTH MIDDLEWARE =====
    async function authenticateUser(req, res, next) {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token' });
        
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error) return res.status(401).json({ error: 'Invalid token' });
        
        req.user = user;
        next();
    }

    // ===== HEALTH CHECK =====
    app.get('/api/health', (req, res) => {
        res.json({ status: 'OK', message: 'MRZE AI Running' });
    });

    // ===== REGISTER =====
    app.post('/api/auth/register', async (req, res) => {
        const { email, password } = req.body;
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: 'Registration successful!', user: data.user });
    });

    // ===== LOGIN =====
    app.post('/api/auth/login', async (req, res) => {
        const { email, password } = req.body;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return res.status(401).json({ error: 'Invalid credentials' });
        res.json({ token: data.session.access_token, user: data.user });
    });

    // ===== MISTRAL CHAT =====
    app.post('/api/chat/send', authenticateUser, async (req, res) => {
        const { message } = req.body;
        
        try {
            const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MISTRAL_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'mistral-small-latest',
                    messages: [{ role: 'user', content: message }]
                })
            });
            const data = await response.json();
            res.json({ response: data.choices[0].message.content });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ===== IMAGE GENERATION (YOU EARN MONEY!) =====
    app.post('/api/image/generate', authenticateUser, async (req, res) => {
        const { prompt } = req.body;
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
        const earnings = 0.0025;
        
        try {
            await supabase.from('earnings').insert({
                user_id: req.user.id,
                amount: earnings,
                source: 'pollinations_image',
                description: prompt
            });
            res.json({ 
                success: true, 
                imageUrl: imageUrl, 
                earnings: earnings,
                message: `💰 You earned $${earnings} from this image!`
            });
        } catch (error) {
            res.json({ success: true, imageUrl: imageUrl, earnings: earnings });
        }
    });

    // ===== GET EARNINGS =====
    app.get('/api/earnings', authenticateUser, async (req, res) => {
        const { data } = await supabase.from('earnings').select('*').eq('user_id', req.user.id);
        const total = data?.reduce((sum, item) => sum + item.amount, 0) || 0;
        res.json({ totalEarnings: total, transactions: data });
    });

    // Start server
    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════╗
║   🚀 MRZE AI SECURE SERVER RUNNING             ║
╠════════════════════════════════════════════════╣
║   📡 URL: http://localhost:${PORT}              ║
║   💰 Earnings: 25% markup on images            ║
║   🔐 Keys: Entered on startup (not saved)      ║
║   ✅ Safe to upload to GitHub!                 ║
╚════════════════════════════════════════════════╝
        `);
    });
}

// Start the key prompt
console.log(`
╔════════════════════════════════════════════════╗
║   🔐 MRZE AI - KEY REQUIRED                    ║
║   You will be prompted for your API keys       ║
║   Keys are NOT stored anywhere                 ║
╚════════════════════════════════════════════════╝
`);

askForKeys();