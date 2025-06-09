import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import bcrypt from 'bcrypt';
dotenv.config();

const users = [{ username: 'user1', password: 'password1', role:'user' }]; // format: { username: 'user1', password: 'password1', role: 'admin' | 'user' }
const store = new session.MemoryStore(); // Use MemoryStore for session storage

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors(
    {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE'], 
      }
));
app.use(session({
    store: store,
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { sameSite: 'strict', maxAge: 1000 * 60 * 60 * 24, secure: process.env.NODE_ENV === 'production'},
}));

// Routes
app.get('/', (req, res) => {
    const sessionStore = req.sessionStore;

    sessionStore.all((err, sessions) => {
        if (err) {
            console.error('Error retrieving sessions:', err);
            return res.status(500).send('Internal Server Error');
        }
        console.log('Active sessions:', sessions, 'sessionObject:', req.session);
    });
    res.send('GET request to /');
    console.log('GET request to /');
});

app.get('/users', (req, res)=> {
    res.json(users);

})
app.post('/users', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send('Username and password are required');
    }
    const user = { username: username, password: password, role: 'user' };
    try {
        user.password = await bcrypt.hash(user.password, 10);
    }
    catch(error) {
        console.error('Error creating user:', error);
        return res.status(500).send('Internal Server Error');
    }
    users.push(user);
    res.status(201).send('User created successfully');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send('Username and password are required')
    }
    if (req.session.authenticated) {
        return res.status(200).send('Already logged in');
    }
    const user = users.find(user => user.username === username);
    if (!user) {
        return res.status(401).send('User not found')
    }
    try {
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).send('Invalid password');
        }
        req.session.user = { username: user.username, role: user.role };
        req.session.authenticated = true;
        res.send('Login successful');
        console.log('User logged in:', req.session);
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Internal Server Error');
    }


})

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});