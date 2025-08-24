// index.js - Robo Ride Backend
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

require('dotenv').config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://harihk0506:anbu@cluster0.yzukbbs.mongodb.net/roboride?retryWrites=true&w=majority';


app.use(cors());
app.use(express.json());

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
});


// 2. Book a ride (POST /api/rides)
app.post('/api/rides', async (req, res) => {
  const { pickupLocation, destinationLocation, passengerCount, rfidVerified } = req.body;
  // Enforce max 10 passengers
  if (passengerCount > 10) {
    return res.status(400).json({ error: 'Maximum 10 passengers allowed per ride.' });
  }
  if (!pickupLocation || !destinationLocation) {
    return res.status(400).json({ error: 'Pickup and destination locations are required.' });
  }
  // Assign nearest available vehicle (mock logic)
  let vehicle = await Vehicle.findOne({ isAvailable: true });
  if (!vehicle) {
    return res.status(503).json({ error: 'No vehicles available.' });
  }
  
  try {
    // Send command to ESP32-CAM to move to pickup location
    const response = await fetch(`http://${vehicle.id}.local/move`, {
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

    vehicle.isAvailable = false;
    vehicle.currentRide = `RIDE_${Date.now()}`;
    await vehicle.save();
    
    const ride = new Ride({
      ...req.body,
      createdAt: new Date(),
      vehicleId: vehicle.id,
      status: 'confirmed',
      rfidVerified: !!rfidVerified
    });
    await ride.save();
    res.json(ride);
});

// 3. Get all rides (GET /api/rides)
app.get('/api/rides', async (req, res) => {
  const rides = await Ride.find().sort({ createdAt: -1 });
  res.json(rides);
});

// 4. Get vehicle status (GET /api/vehicle/:id)
app.get('/api/vehicle/:id', async (req, res) => {
  const vehicle = await Vehicle.findOne({ id: req.params.id });
  res.json(vehicle);
});

// 5. Emergency stop (POST /api/vehicle/:id/emergency-stop)
app.post('/api/vehicle/:id/emergency-stop', async (req, res) => {
  try {
    // Send emergency stop command to ESP32-CAM
    const response = await fetch(`http://${req.params.id}.local/emergency-stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'emergency_stop' })
    });

    if (!response.ok) {
      throw new Error('Failed to send emergency stop command');
    }

    // Set speed to 0 and mark as stopped
    await Vehicle.updateOne({ id: req.params.id }, { speed: 0 });
    // Update ride status
    await Ride.updateMany(
      { vehicleId: req.params.id, status: { $in: ['in-progress', 'confirmed'] } }, 
      { status: 'emergency_stopped' }
    );
    
    res.json({ success: true, message: 'Emergency stop triggered. Vehicle stopped.' });
  } catch (error) {
    console.error('Emergency stop failed:', error);
    res.status(500).json({ success: false, message: 'Failed to trigger emergency stop' });
  }
});

// 6. Get RFID logs (GET /api/rfid)
app.get('/api/rfid', async (req, res) => {
  const logs = await RFID.find().sort({ timestamp: -1 }).limit(100);
  res.json(logs);
});

// --- Connect to MongoDB and Start Server ---
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Robo Ride backend running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
