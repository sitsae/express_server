import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import bcrypt from 'bcrypt';
dotenv.config();

const users = [{ username: 'user1', password: 'password1', role:'user' }]; // format: { username: 'user1', password: 'password1', role: 'admin' | 'user' }
const store = new session.MemoryStore(); // Use MemoryStore for session storage

const items = [{ id: 1, name: 'Item 1', description: 'Description of Item 1', price: 100, inStock: 10,}, ]; // Example items

const app = express();
const PORT = process.env.PORT || 3000;

const findItemById = (id) => {
    const item = items.find(item => item.id === id);
    const outOfStock = item && item.inStock <= 0;
    if (!item) {
        return null;
    }   
    if (outOfStock) {
        return 'outOfStock';
    }
    return item;
}

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
    const { username, password, role } = req.body;
    if (!username || !password) {
        return res.status(400).send('Username and password are required');
    }
    if (role && role !== 'admin') {
        console.error('Invalid role:', role);
        return res.status(400).send('Role must be admin or undefined');
    }
    const user = { username: username, password: password, role: role ? role : 'user' };

    try {
        user.password = await bcrypt.hash(user.password, 10);
    }
    catch(error) {
        console.error('Error creating user:', error);
        return res.status(500).send('Internal Server Error');
    }
    users.push(user);
    res.status(201).send('User created successfully');
    console.log('User created:', user);
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send('Username and password are required')
    }
    if (req.session.authenticated) {
        res.status(200).send('Already logged in');
        // return res.redirect('/') // Send to home page if already logged in
        return;
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

app.post('/addmyitem', (req, res) => {
    try {if (!req.session.user && !req.session.authenticated) {
        return res.status(401).send('user must be logged in to add item');
    }
    const itemId =req.body.itemId;
    const item = findItemById(itemId);

    if (!itemId) {
        return res.status(400).send('Item is required');
    }
    if (item === "outOfStock") {
        return res.status(400).send('Item id out of stock');
    }
    if (!item) {
        return res.status(404).send('Item not found');
    }
    req.session.items = req.session.items || [];
    req.session.items.push(item);
    res.status(201).send('Item added successfully');
    console.log('Item added:', item, 'Session items:', req.session.items);}
    catch (error) {
            console.error('Error adding item:', error);
            res.status(500).send('Internal Server Error');
        }
})

app.get('/myitems', (req, res)=> {
    try {
        if (!req.session.user || !req.session.authenticated) {
            return res.status(401).send('User must be logged in to view items');
        }
        const userItems = req.session.items || [];
        res.send(userItems);
        console.log('User items retrieved:', userItems);
    } catch (error) {
        console.error('Error retrieving user items:', error);
        res.status(500).send('Internal Server Error');
    }
})

app.get('/items', (req, res) => {
try {
    res.send(items)
    console.log('Items retrieved:', items);

}
catch (err) {
    console.error('Error retrieving items:', err);
    res.status(500).send('Internal Server Error');}
})

app.post('/items', (req, res) => {
    try {
        const {  name, description, price, inStock } = req.body;
        if (!name || !description || !price || inStock === undefined) {
            return res.status(400).send('All item fields are required');
        }
        if (typeof price !== 'number' || typeof inStock !== 'number') {
            return res.status(400).send('Price and inStock must be numbers');
        }
        if (price < 0 || inStock < 0) {
            return res.status(400).send('Price and inStock must be non-negative');
        }
        if (!req.session.user || !req.session.authenticated || req.session.user.role !== 'admin') {
            return res.status(403).send('Only admins can create items');
        }
        const newItemId = items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
        const newItem = {
            id: newItemId,
            name,
            description,
            price,
            inStock
        };
        items.push(newItem);
        res.status(201).send('Item created successfully', newItem);
        console.log('Item created:', newItem);

    } catch (err) {
        console.error('Error creating item:', err);
        return res.status(500).send('Internal Server Error');
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});