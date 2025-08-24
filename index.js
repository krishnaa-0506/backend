// index.js - Robo Ride Backend
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://harihk0506:anbu@cluster0.yzukbbs.mongodb.net/';

// Configure CORS for production
app.use(cors({
  origin: '*', // Be more restrictive in production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Add basic route for testing
app.get('/', (req, res) => {
  res.json({ status: 'Robo Ride Backend is running' });
});

// --- MongoDB Models ---
const RideSchema = new mongoose.Schema({
  pickupLocation: Object,
  destinationLocation: Object,
  passengerCount: Number,
  rfidVerified: Boolean,
  status: String,
  estimatedTime: Number,
  fare: Number,
  createdAt: Date,
  vehicleId: String
});
const Ride = mongoose.model('Ride', RideSchema);

const RFIDSchema = new mongoose.Schema({
  cardId: String,
  userId: String,
  name: String,
  isVerified: Boolean,
  timestamp: Date
});
const RFID = mongoose.model('RFID', RFIDSchema);

const VehicleSchema = new mongoose.Schema({
  id: String,
  location: Object,
  heading: Number,
  speed: Number,
  battery: Number,
  isAvailable: Boolean,
  capacity: Number,
  currentRide: String,
  lastUpdate: Date,
  irReading: Number
});
const Vehicle = mongoose.model('Vehicle', VehicleSchema);

// --- API Endpoints ---

// 1. Receive sensor data from ESP32 (POST /api/sensor)
app.post('/api/sensor', async (req, res) => {
  try {
    const { vehicleId, location, heading, speed, battery, irReading, rfidTaps } = req.body;
    let vehicle = await Vehicle.findOne({ id: vehicleId });
    if (!vehicle) {
      vehicle = new Vehicle({ id: vehicleId });
    }
    vehicle.location = location;
    vehicle.heading = heading;
    vehicle.speed = speed;
    vehicle.battery = battery;
    vehicle.irReading = irReading;
    vehicle.lastUpdate = new Date();
    await vehicle.save();

    // Save RFID taps if present
    if (Array.isArray(rfidTaps)) {
      for (const tap of rfidTaps) {
        await RFID.create({ ...tap, timestamp: new Date() });
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Sensor data error:', error);
    res.status(500).json({ error: 'Failed to process sensor data' });
  }
});

// 2. Book a ride (POST /api/rides)
app.post('/api/rides', async (req, res) => {
  try {
    console.log('Received ride booking request:', req.body);
    const { pickupLocation, destinationLocation, passengerCount, rfidVerified } = req.body;
    
    // Enforce max 10 passengers
    if (passengerCount > 10) {
      return res.status(400).json({ error: 'Maximum 10 passengers allowed per ride.' });
    }
    if (!pickupLocation || !destinationLocation) {
      return res.status(400).json({ error: 'Pickup and destination locations are required.' });
    }
    
    // Assign nearest available vehicle
    let vehicle = await Vehicle.findOne({ isAvailable: true });
    if (!vehicle) {
      return res.status(503).json({ error: 'No vehicles available.' });
    }

    // Send command to ESP32-CAM
    const response = await fetch(`https://${vehicle.id}.local/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        lat: pickupLocation.lat, 
        lng: pickupLocation.lng,
        command: 'move_to_pickup'
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to send command to vehicle');
    }

    // Update vehicle status
    vehicle.isAvailable = false;
    vehicle.currentRide = `RIDE_${Date.now()}`;
    await vehicle.save();
    
    // Create and save ride
    const ride = new Ride({
      ...req.body,
      createdAt: new Date(),
      vehicleId: vehicle.id,
      status: 'confirmed',
      rfidVerified: !!rfidVerified
    });
    await ride.save();
    
    res.json(ride);
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: 'Failed to book ride' });
  }
});

// 3. Get all rides (GET /api/rides)
app.get('/api/rides', async (req, res) => {
  try {
    const rides = await Ride.find().sort({ createdAt: -1 });
    res.json(rides);
  } catch (error) {
    console.error('Get rides error:', error);
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

// 4. Get vehicle status (GET /api/vehicle/:id)
app.get('/api/vehicle/:id', async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ id: req.params.id });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(vehicle);
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle status' });
  }
});

// 5. Emergency stop (POST /api/vehicle/:id/emergency-stop)
app.post('/api/vehicle/:id/emergency-stop', async (req, res) => {
  try {
    const response = await fetch(`http://${req.params.id}.local/emergency-stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'emergency_stop' })
    });

    if (!response.ok) {
      throw new Error('Failed to send emergency stop command');
    }

    await Vehicle.updateOne({ id: req.params.id }, { speed: 0 });
    await Ride.updateMany(
      { vehicleId: req.params.id, status: { $in: ['in-progress', 'confirmed'] } },
      { status: 'emergency_stopped' }
    );
    
    res.json({ success: true, message: 'Emergency stop triggered. Vehicle stopped.' });
  } catch (error) {
    console.error('Emergency stop error:', error);
    res.status(500).json({ error: 'Failed to trigger emergency stop' });
  }
});

// 6. Get RFID logs (GET /api/rfid)
app.get('/api/rfid', async (req, res) => {
  try {
    const logs = await RFID.find().sort({ timestamp: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    console.error('RFID logs error:', error);
    res.status(500).json({ error: 'Failed to fetch RFID logs' });
  }
});

// --- Connect to MongoDB and Start Server ---
mongoose.set('strictQuery', false);

const startServer = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('MongoDB URI:', MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@')); // Hide credentials in logs
    
    await mongoose.connect(MONGO_URI);
    console.log('Successfully connected to MongoDB');
    
    app.listen(PORT, () => {
      console.log(`Robo Ride backend running on port ${PORT}`);
      console.log('Available endpoints:');
      console.log('- POST /api/sensor');
      console.log('- POST /api/rides');
      console.log('- GET /api/rides');
      console.log('- GET /api/vehicle/:id');
      console.log('- POST /api/vehicle/:id/emergency-stop');
      console.log('- GET /api/rfid');
    });
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  }
};

startServer();
