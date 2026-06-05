const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Supabase connection
const supabase = createClient(
    'https://qfoqqpwcphrrxqtlfhkl.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmb3FxcHdjcGhycnhxdGxmaGtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY4MjA5MywiZXhwIjoyMDk2MjU4MDkzfQ.ADKPi4uwSIEEpfoRMEzo4ILglKJRE5DWenTGJfXWe1c'
);

const MISTRAL_API_KEY = 'xUVgaCt6tC1GWOhumeYsmUuTXqTC10wM';

// Simple health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'MRZE AI Running' });
});

// Root
app.get('/', (req, res) => {
    res.json({ message: 'MRZE AI API is running!' });
});

// Register
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Registration successful!', user: data.user });
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ token: data.session.access_token, user: data.user });
});

// Auth middleware
async function authenticateUser(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    next();
}

// Chat
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

// Generate image (YOU EARN MONEY!)
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
        res.json({ success: true, imageUrl: imageUrl, earnings: earnings });
    } catch (error) {
        res.json({ success: true, imageUrl: imageUrl, earnings: earnings });
    }
});

// Get earnings
app.get('/api/earnings', authenticateUser, async (req, res) => {
    const { data } = await supabase.from('earnings').select('*').eq('user_id', req.user.id);
    const total = data?.reduce((sum, item) => sum + item.amount, 0) || 0;
    res.json({ totalEarnings: total, transactions: data });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
