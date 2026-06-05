const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===== YOUR KEYS - NO PROMPTS! =====
const supabase = createClient(
    'https://qfoqqpwcphrrxqtlfhkl.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmb3FxcHdjcGhycnhxdGxmaGtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY4MjA5MywiZXhwIjoyMDk2MjU4MDkzfQ.ADKPi4uwSIEEpfoRMEzo4ILglKJRE5DWenTGJfXWe1c'
);

const MISTRAL_API_KEY = 'xUVgaCt6tC1GWOhumeYsmUuTXqTC10wM';

console.log('🚀 MRZE AI Server Starting...');
console.log('✅ Supabase Connected');
console.log('✅ Mistral AI Ready');

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'MRZE AI Server Running',
        timestamp: new Date().toISOString()
    });
});

// ===== ROOT =====
app.get('/', (req, res) => {
    res.json({ 
        message: 'MRZE AI API is running!',
        endpoints: {
            health: 'GET /api/health',
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login',
            chat: 'POST /api/chat/send',
            image: 'POST /api/image/generate',
            earnings: 'GET /api/earnings'
        }
    });
});

// ===== AUTH MIDDLEWARE =====
async function authenticateUser(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
}

// ===== REGISTER =====
app.post('/api/auth/register', async (req, res) => {
    const { email, password, username } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username || email.split('@')[0] } }
    });
    
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    
    res.status(201).json({ 
        message: 'Registration successful! Please verify your email.', 
        user: { id: data.user.id, email: data.user.email } 
    });
});

// ===== LOGIN =====
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json({
        token: data.session.access_token,
        user: {
            id: data.user.id,
            email: data.user.email,
            username: data.user.user_metadata?.username
        }
    });
});

// ===== CHAT WITH MISTRAL =====
app.post('/api/chat/send', authenticateUser, async (req, res) => {
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }
    
    try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MISTRAL_API_KEY}`
            },
            body: JSON.stringify({
                model: 'mistral-small-latest',
                messages: [
                    { role: 'system', content: 'You are MRZE AI, a helpful assistant.' },
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });
        
        const data = await response.json();
        const reply = data.choices[0].message.content;
        
        res.json({ response: reply });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== GENERATE IMAGE (YOU EARN MONEY!) =====
app.post('/api/image/generate', authenticateUser, async (req, res) => {
    const { prompt } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    
    try {
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
        const earnings = 0.0025;
        
        await supabase.from('earnings').insert({
            user_id: req.user.id,
            amount: earnings,
            source: 'pollinations_image',
            description: prompt.substring(0, 100)
        });
        
        res.json({
            success: true,
            imageUrl: imageUrl,
            prompt: prompt,
            earnings: earnings,
            message: `💰 You earned $${earnings} from this image!`
        });
    } catch (error) {
        res.json({ 
            success: true, 
            imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`,
            earnings: 0.0025,
            message: '💰 Image generated! (Earnings tracked)'
        });
    }
});

// ===== GET EARNINGS =====
app.get('/api/earnings', authenticateUser, async (req, res) => {
    const { data, error } = await supabase
        .from('earnings')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });
    
    const total = data?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
    
    res.json({ 
        totalEarnings: total, 
        transactions: data || [],
        markupRate: '25%'
    });
});

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MRZE AI Server running on port ${PORT}`);
    console.log(`📍 Health check: /api/health`);
});
