import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import bcrypt from "bcrypt";
import { items } from "./items.js";
import { categories } from "./categories.js";
import { users } from "./users.js";
dotenv.config();

// format users: { username: 'user1', password: 'password1', role: 'admin' | 'user' }
// format items: { id: 1, name: 'Item 1', description: 'Description of Item 1', price: 100, inStock: 10 }

const store = new session.MemoryStore();

const app = express();
const PORT = process.env.PORT || 3000;

const findItemById = (id) => {
  const item = items.find((item) => item.id === id);
  const outOfStock = item && item.inStock <= 0;
  if (!item) {
    return null;
  }
  if (outOfStock) {
    return "outOfStock";
  }
  return item;
};

// Middleware
const checkAuthientication = (message, role = ["user"]) => {
  return (req, res, next) => {
    const msg =
      message || "User must be logged in as to access this functionality";
    if (!req.session.user || !req.session.authenticated) {
      console.log(req.session);
      return res.status(401).send({ message: msg });
    }
    if (!role.includes(req.session.user.role)) {
      return res.status(403).send({ message: "Forbidden: must be " + role });
    }
    next();
  };
};

app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);
app.use(
  session({
    store: store,
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
      sameSite: "strict",
      maxAge: 1000 * 60 * 60 * 24,
      secure: process.env.NODE_ENV === "production",
    },
  })
);

// Routes
app.get("/", (req, res) => {
  const sessionStore = req.sessionStore;

  sessionStore.all((err, sessions) => {
    if (err) {
      console.error("Error retrieving sessions:", err);
      return res.status(500).send("Internal Server Error");
    }
    console.log("Active sessions:", sessions, "sessionObject:", req.session);
  });
  res.send("GET request to /");
  console.log("GET request to /");
});

app.get("/users", (req, res) => {
  res.json(users);
});

app.post("/users", async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .send({ message: "Username and password are required" });
  }
  if (users.find((user) => user.username === username)) {
    return res
      .status(400)
      .send({ exist: true, message: "Username already exists" });
  }
  if (role && role !== "admin") {
    console.error("Invalid role:", role);
    return res.status(400).send({ message: "Role must be admin or undefined" });
  }
  const user = {
    username: username,
    password: password,
    role: role ? role : "user",
  };

  try {
    user.password = await bcrypt.hash(user.password, 10);
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).send("Internal Server Error: Hashing failed");
  }
  users.push(user);
  res.status(201).send(user);
  console.log("User created:", user);
});

app.get("/session", (req, res) => {
  if (!req.session.authenticated) {
    return res.status(200).send(false);
  }
  console.log("Session retrieved:", req.session.authenticated);
  return res.status(200).send({ authenticated: req.session.authenticated });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .send({ message: "Username and password are required" });
  }
  if (req.session.authenticated) {
    res
      .status(200)
      .send({ message: "Already logged in, refresh site to see changes" });
    return;
  }
  const user = users.find((user) => user.username === username);
  if (!user) {
    return res.status(401).send({ message: "User not found" });
  }
  try {
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).send({ message: "Invalid password" });
    }
    req.session.user = { username: user.username, role: user.role };
    req.session.authenticated = true;

    res.send({
      authenticated: req.session.authenticated,
      message: "Login successful",
    });
    console.log("User logged in:", req.session);
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send("Internal Server Error: Password comparison failed");
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).send("Internal Server Error");
    }
  });
  console.log("User logged out:", req.session);
  return res.send({ authenticated: false });
});

app.post(
  "/addmyitem",
  checkAuthientication("user must be logged in to add item", ["user", "admin"]),
  (req, res) => {
    console.log(req.session);
    try {
      const itemId = req.body.itemId;
      const item = findItemById(itemId);

      if (!itemId) {
        return res.status(400).send({ message: "Item is does noet exist" });
      }
      if (item === "outOfStock") {
        return res.status(400).send({ message: "Item id out of stock" });
      }
      if (!item) {
        return res.status(404).send({ message: "Item not found" });
      }
      req.session.items = req.session.items || [];
      req.session.items.push(item);
      res.status(201).send({ message: "Item added successfully" });
      console.log("Item added:", item, "Session items:", req.session.items);
    } catch (error) {
      console.error("Error adding item:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);
app.post(
  "/removeitem",
  checkAuthientication("User must be logged in to remove items", [
    "user",
    "admin",
  ]),
  (req, res) => {
    try {
      const itemId = req.body.itemId;
      if (!itemId) {
        return res.status(400).send({ message: "Item ID is required" });
      }
      const itemIndex = req.session.items.findIndex(
        (item) => item.id === itemId
      );
      if (itemIndex === -1) {
        return res.status(404).send({ message: "Item not found in cart" });
      }
      req.session.items.splice(itemIndex, 1);
      res.status(200).send({ message: "Item removed successfully" });
      console.log("Item removed:", itemId, "Session items:", req.session.items);
    } catch (error) {
      console.error("Error removing item:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.get(
  "/myitems",
  checkAuthientication("User must be logged in to view cart items", [
    "user",
    "admin",
  ]),
  (req, res) => {
    try {
      const userItems = req.session.items || [];
      res.send(userItems);
      console.log("User items retrieved:", userItems);
    } catch (error) {
      console.error("Error retrieving user items:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.get("/items", (req, res) => {
  try {
    res.send(items);
    console.log("Items retrieved");
  } catch (err) {
    console.error("Error retrieving items:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post(
  "/items",
  checkAuthientication("User must be logged in to create items", ["admin"]),
  (req, res) => {
    try {
      // Add category validation later
      const { name, description, price, inStock } = req.body;
      if (
        !name ||
        !description ||
        !price
        // ||
        // inStock === undefined ||
        // inStock === null
      ) {
        return res.status(400).send("All item fields are required");
      }

      if (
        Number(price) < 0
        // || inStock < 0
      ) {
        return res.status(400).send("Price and inStock must be non-negative");
      }

      const newItemId =
        items.length > 0 ? Math.max(...items.map((item) => item.id)) + 1 : 1;
      const newItem = {
        id: newItemId,
        name,
        description,
        price: Number(price),
        inStock: inStock || 0,
        category: req.body.category || "uncategorized",
      };
      items.push(newItem);
      res
        .status(201)
        .send({ message: "Item created successfully:" + newItem.name });
      console.log("Item created:", newItem);
    } catch (err) {
      console.error("Error creating item:", err);
      return res.status(500).send({ message: "Internal Server Error" });
    }
  }
);

app.get(
  "/cart",
  checkAuthientication("User must be logged in to view cart", [
    "user",
    "admin",
  ]),
  (req, res) => {
    try {
      const cartItems = req.session.items || [];

      res.status(200).send(cartItems);
      console.log("Cart items retrieved:", cartItems);
    } catch (error) {
      console.error("Error retrieving cart items:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.get("/categories", (req, res) => {
  try {
    res.send(categories);
    console.log({ message: "Categories retrieved" });
  } catch (err) {
    console.error("Error retrieving categories:", err);
    res.status(500).send({ message: "Internal Server Error" });
  }
});
app.post(
  "/categories",
  checkAuthientication("User must be logged in to create categories", [
    "admin",
  ]),
  (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).send({ message: "Category name is required" });
      }
      const newCategoryId =
        categories.length > 0
          ? Math.max(...categories.map((cat) => cat.id)) + 1
          : 1;
      const newCategory = { id: newCategoryId, name };
      categories.push(newCategory);
      res.status(201).send(newCategory);
      console.log("Category created:", newCategory);
    } catch (err) {
      console.error("Error creating category:", err);
      res.status(500).send({ message: "Internal Server Error" });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
