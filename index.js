const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();
const secretKey = 'yoursecretkey';

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define a simple User model
const User = mongoose.model('User', new mongoose.Schema({
  username: String,
  password: String,
  email: String,
}));

// Simple signup route
app.post('/signup', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // Check for empty fields
    if (!username || !password || !email) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      password: hashedPassword,
      email,
    });

    await newUser.save();
    res.status(201).json({ success: true, message: 'User registered successfully' });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


// Simple login route
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find the user by username
    const user = await User.findOne({ username });
    
    // Check if user exists and password matches
    if (user && await bcrypt.compare(password, user.password)) {
      res.status(200).json({ success: true, message: 'Login successful' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

const WeightAndMealSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  weight: { type: Number, required: true },
  breakfast: { calories: Number, description: String },
  lunch: { calories: Number, description: String },
  snack: { calories: Number, description: String },
  dinner: { calories: Number, description: String },
  other: { calories: Number, description: String },
  totalCalories: { type: Number, default: 0 }, // Default value to 0
});

// Middleware to calculate totalCalories before saving
WeightAndMealSchema.pre('save', function(next) {
  this.totalCalories = (
    (this.breakfast && this.breakfast.calories ? this.breakfast.calories : 0) +
    (this.lunch && this.lunch.calories ? this.lunch.calories : 0) +
    (this.snack && this.snack.calories ? this.snack.calories : 0) +
    (this.dinner && this.dinner.calories ? this.dinner.calories : 0) +
    (this.other && this.other.calories ? this.other.calories : 0)
  );
  next();
});

const WeightAndMeal = mongoose.model('WeightAndMeal', WeightAndMealSchema);


app.post('/track/:username', async (req, res) => {
  try {

    const usernameId = req.params.username;

    // Find the user by usernameId
    const user = await User.findOne({ username: usernameId });

    const { weight, breakfast, lunch, snack, dinner, other } = req.body;

    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    if (!weight) {
      return res.status(400).json({ success: false, message: 'Weight is required' });
    }

    // Create a new WeightAndMeal document
    const newEntry = new WeightAndMeal({
      userId: user.username,
      weight,
      breakfast, 
      lunch, 
      snack, 
      dinner, 
      other,
    });

    // Save the new entry to the database
    await newEntry.save();

    res.status(201).json({ success: true, message: 'Data tracked successfully' });
  } catch (error) {
    console.error('Error tracking data:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


// Get all weight and meal records for a specific user
app.get('/tracks/:username', async (req, res) => {
  try {
    const usernameId = req.params.username;

    // Find the user by usernameId
    const user = await User.findOne({ username: usernameId });
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Find all weight and meal records for the user
    const records = await WeightAndMeal.find({ userId: user.username });

    res.status(200).json({ success: true, data: records });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


// Middleware to calculate totalCalories before updating
WeightAndMealSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  if (update.$set) {
    const { breakfast, lunch, snack, dinner, other } = update.$set;

    

    console.log('Calculated Total Calories:', totalCalories); // Log for debugging
    update.$set.totalCalories = totalCalories;
  }

  next();
});


// Update a weight and meal record by ID
app.put('/track/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { weight, breakfast, lunch, snack, dinner, other } = req.body;

    // Calculate totalCalories
    const totalCalories = (
      (breakfast && breakfast.calories ? breakfast.calories : 0) +
      (lunch && lunch.calories ? lunch.calories : 0) +
      (snack && snack.calories ? snack.calories : 0) +
      (dinner && dinner.calories ? dinner.calories : 0) +
      (other && other.calories ? other.calories : 0)
    );

    // Find the record and update it
    const updatedEntry = await WeightAndMeal.findByIdAndUpdate(id, {
      weight,
      breakfast, 
      lunch, 
      snack, 
      dinner, 
      other,
      totalCalories,
    }, { new: true });

    if (!updatedEntry) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    res.status(200).json({ success: true, message: 'Data updated successfully', data: updatedEntry });
  } catch (error) {
    console.error('Error updating data:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


// Delete a weight and meal record by ID
app.delete('/track/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Find the record and delete it
    const deletedEntry = await WeightAndMeal.findByIdAndDelete(id);

    if (!deletedEntry) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    res.status(200).json({ success: true, message: 'Data deleted successfully' });
  } catch (error) {
    console.error('Error deleting data:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});

