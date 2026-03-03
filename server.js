const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Blog = require('./models/Blog');
const Gallery = require('./models/Gallery');
const Journey = require('./models/Journey');
const Settings = require('./models/Settings');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 8888;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('FATAL ERROR: MONGO_URI is not defined in .env file.');
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

// Multer Config for Image Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    jwt.verify(token.split(' ')[1], process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized' });
        req.userId = decoded.id;
        next();
    });
};

// Routes
// Authentication Routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.status(200).json({ token, username: user.username });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Registration Route (Temporary)
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    console.log('Attempting to register user:', username);

    try {
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            console.log('Registration failed: User already exists');
            return res.status(400).json({ error: 'Username already exists' });
        }

        const newUser = new User({ username, password });
        await newUser.save();

        console.log('User registered successfully:', username);
        res.status(201).json({ message: 'Admin user created successfully' });
    } catch (error) {
        console.error('CRITICAL REGISTRATION ERROR:', error);
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
});

// Blog Post Routes
app.post('/api/blog', verifyToken, upload.single('image'), async (req, res) => {
    try {
        const { title, expert, content } = req.body;
        const image = req.file ? `/uploads/${req.file.filename}` : null;

        const newBlog = new Blog({ title, expert, content, image });
        await newBlog.save();

        res.status(201).json({ message: 'Blog post created successfully', blog: newBlog });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/blog', async (req, res) => {
    try {
        const blogs = await Blog.find().sort({ createdAt: -1 });
        res.status(200).json(blogs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Gallery Post Routes
app.post('/api/gallery', verifyToken, upload.single('image'), async (req, res) => {
    try {
        const { title, category } = req.body;
        const image = req.file ? `/uploads/${req.file.filename}` : null;

        const newGallery = new Gallery({ title, category, image });
        await newGallery.save();

        res.status(201).json({ message: 'Gallery item added successfully', gallery: newGallery });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/gallery', async (req, res) => {
    try {
        const gallery = await Gallery.find().sort({ createdAt: -1 });
        res.status(200).json(gallery);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Journey Post Routes
app.post('/api/journey', verifyToken, upload.single('image'), async (req, res) => {
    try {
        const { name, shortDescription, content } = req.body;
        const image = req.file ? `/uploads/${req.file.filename}` : null;

        const newJourney = new Journey({ name, shortDescription, content, image });
        await newJourney.save();

        res.status(201).json({ message: 'Journey entry created successfully', journey: newJourney });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/journey', async (req, res) => {
    try {
        const journeys = await Journey.find().sort({ createdAt: -1 });
        res.status(200).json(journeys);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Settings Routes
app.get('/api/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
            await settings.save();
        }
        res.status(200).json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/settings', verifyToken, async (req, res) => {
    try {
        const { livesTouched, clientRating } = req.body;
        const settings = await Settings.findOneAndUpdate(
            {},
            { livesTouched, clientRating },
            { new: true, upsert: true }
        );
        res.status(200).json({ message: 'Settings updated successfully', settings });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT Routes
app.put('/api/blog/:id', verifyToken, upload.single('image'), async (req, res) => {
    try {
        const { title, expert, content } = req.body;
        const updateData = { title, expert, content };

        if (req.file) {
            const blog = await Blog.findById(req.params.id);
            if (blog && blog.image) {
                const oldImagePath = path.join(__dirname, 'uploads', path.basename(blog.image));
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            updateData.image = `/uploads/${req.file.filename}`;
        }

        const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!updatedBlog) return res.status(404).json({ error: 'Blog not found' });

        res.status(200).json({ message: 'Blog updated successfully', blog: updatedBlog });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/gallery/:id', verifyToken, upload.single('image'), async (req, res) => {
    try {
        const { title, category } = req.body;
        const updateData = { title, category };

        if (req.file) {
            const gallery = await Gallery.findById(req.params.id);
            if (gallery && gallery.image) {
                const oldImagePath = path.join(__dirname, 'uploads', path.basename(gallery.image));
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            updateData.image = `/uploads/${req.file.filename}`;
        }

        const updatedGallery = await Gallery.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!updatedGallery) return res.status(404).json({ error: 'Gallery item not found' });

        res.status(200).json({ message: 'Gallery item updated successfully', gallery: updatedGallery });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/journey/:id', verifyToken, upload.single('image'), async (req, res) => {
    try {
        const { name, shortDescription, content } = req.body;
        const updateData = { name, shortDescription, content };

        if (req.file) {
            const journey = await Journey.findById(req.params.id);
            if (journey && journey.image) {
                const oldImagePath = path.join(__dirname, 'uploads', path.basename(journey.image));
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            updateData.image = `/uploads/${req.file.filename}`;
        }

        const updatedJourney = await Journey.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!updatedJourney) return res.status(404).json({ error: 'Journey not found' });

        res.status(200).json({ message: 'Journey updated successfully', journey: updatedJourney });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE Routes
app.delete('/api/blog/:id', verifyToken, async (req, res) => {
    try {
        const deletedBlog = await Blog.findByIdAndDelete(req.params.id);
        if (!deletedBlog) return res.status(404).json({ error: 'Blog not found' });

        if (deletedBlog.image) {
            const filePath = path.join(__dirname, 'uploads', path.basename(deletedBlog.image));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        res.status(200).json({ message: 'Blog deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/gallery/:id', verifyToken, async (req, res) => {
    try {
        const deletedGallery = await Gallery.findByIdAndDelete(req.params.id);
        if (!deletedGallery) return res.status(404).json({ error: 'Gallery item not found' });

        if (deletedGallery.image) {
            const filePath = path.join(__dirname, 'uploads', path.basename(deletedGallery.image));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        res.status(200).json({ message: 'Gallery item deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/journey/:id', verifyToken, async (req, res) => {
    try {
        const deletedJourney = await Journey.findByIdAndDelete(req.params.id);
        if (!deletedJourney) return res.status(404).json({ error: 'Journey not found' });

        if (deletedJourney.image) {
            const filePath = path.join(__dirname, 'uploads', path.basename(deletedJourney.image));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        res.status(200).json({ message: 'Journey deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
