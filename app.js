require("dotenv").config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');

const app = express();
const User = require('./models/User');
const Message = require('./models/Message');

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
}));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("Connected to MongoDB"))
.catch((err) => console.error("MongoDB connection error:", err));


// Middleware for checking if a user is logged in
function checkAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/');
  }
  next();
}

// Middleware for checking if the logged-in user is an admin
function checkAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.isAdmin) {
    return res.status(403).send("Access denied");
  }
  next();
}

// Routes

// Landing page (login or register option)
app.get('/', (req, res) => {
  res.render('login');
});

// Register Page
app.get('/register', (req, res) => {
  res.render('register');
});

// Register new user
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ username, password: hashedPassword });
  try {
    await newUser.save();
    res.redirect('/');
  } catch (error) {
    res.status(500).send('Error registering user');
  }
});


// Login page
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user) {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        req.session.user = user;
        if (user.isAdmin) {
          return res.redirect('/admin'); // Redirect admin to admin panel
        } else {
          return res.redirect('/users'); // Redirect regular users to user list
        }
      }
    }
    res.send('Invalid credentials!');
  } catch (error) {
    res.status(500).send('Error logging in');
  }
});


// Display all users (except the current user)
app.get('/users', checkAuth, async (req, res) => {
  try {
    const users = await User.find({ username: { $ne: req.session.user.username }, isVerified: true });
    res.render('users', { users });
  } catch (error) {
    res.status(500).send('Error fetching users');
  }
});

// Chat page for a specific user
app.get('/chat', checkAuth, async (req, res) => {
  const { username } = req.query;
  const currentUser = req.session.user.username;
  const messages = await Message.find({
    $or: [
      { sender: currentUser, receiver: username },
      { sender: username, receiver: currentUser }
    ]
  }).sort('timestamp');
  res.render('chat', { messages, username, currentUser });
});

// Send message
app.post('/send', checkAuth, async (req, res) => {
  const { sender, receiver, message } = req.body;
  try {
    const newMessage = new Message({ sender, receiver, message });
    await newMessage.save();
    res.redirect(`/chat?username=${receiver}`);
  } catch (error) {
    res.status(500).send('Error sending message');
  }
});

app.get('/admin', checkAdmin, async (req, res) => {
  try {
    // Fetch all users from the database
    const users = await User.find({});
    
    // Render the admin panel view, passing the list of users
    res.render('adminPanel', { users });
  } catch (error) {
    // Log the error for debugging and send a server error response
    console.error('Error retrieving users:', error);
    res.status(500).send('Error retrieving users');
  }
});


// Admin verify/unverify user
app.post('/admin/verify', checkAdmin, async (req, res) => {
  const { username, action } = req.body;
  try {
    const user = await User.findOne({ username });
    if (action === 'verify') {
      user.isVerified = true;
    } else if (action === 'unverify') {
      user.isVerified = false;
    }
    await user.save();
    res.redirect('/admin');
  } catch (error) {
    res.status(500).send('Error verifying/unverifying user');
  }
});

// Admin view messages between two users
app.get('/admin/messages', checkAdmin, async (req, res) => {
  const { user1, user2 } = req.query;

  if (!user1 || !user2) {
    return res.redirect('/admin');
  }

  try {
    // Fetch messages between the two users
    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    }).sort({ timestamp: 1 });

    //console.log('Messages:', messages); // Log the messages to check data

    res.render('adminMessages', { 
      sender: user1, 
      receiver: user2, 
      messages 
    });
  } catch (error) {
    res.status(500).send('Error retrieving messages');
  }
});



// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Start the server
const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});