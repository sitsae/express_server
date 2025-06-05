import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
dotenv.config();

const storeOptions = {

    
};
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
    if (!req.session.valueSet) {
        req.session.valueSet = true;
    }
    sessionStore.all((err, sessions) => {
        if (err) {
            console.error('Error retrieving sessions:', err);
            return res.status(500).send('Internal Server Error');
        }
        console.log('Active sessions:', sessions, 'sessionObject:', req.session);
    });
    res.send('GET request to /. valueSet: set to ', session.valueSet);
    console.log('GET request to /. valueSet: set to ', session.valueSet);
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});