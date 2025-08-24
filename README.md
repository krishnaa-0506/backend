# Robo Ride Backend

This is the backend server for Robo Ride. It receives sensor data (RFID, IR, GPS, etc.) from ESP32 devices and provides REST APIs for the frontend.

## Features
- Receive sensor data from ESP32 (RFID taps, IR readings, GPS location, etc.)
- Book rides and store ride details
- Retrieve ride history
- Get live vehicle status
- Emergency stop endpoint
- Retrieve RFID logs

## Tech Stack
- Node.js + Express
- MongoDB (can use MongoDB Atlas for cloud hosting)

## API Endpoints
- `POST /api/sensor` — ESP32 posts vehicle and sensor data
- `POST /api/rides` — Book a ride
- `GET /api/rides` — Get all rides
- `GET /api/vehicle/:id` — Get vehicle status
- `POST /api/vehicle/:id/emergency-stop` — Emergency stop for a vehicle
- `GET /api/rfid` — Get recent RFID logs

## Running Locally
1. Install dependencies:
   ```
npm install
   ```
2. Start MongoDB (or set `MONGO_URI` for cloud DB)
3. Start the server:
   ```
npm start
   ```

## Deploying
- You can deploy this backend to Render, Railway, or any Node.js hosting platform.
- Set the `MONGO_URI` environment variable to your MongoDB connection string.

## Example ESP32 POST (to `/api/sensor`)
```json
{
  "vehicleId": "ROBO_001",
  "location": { "lat": 12.9716, "lng": 77.5946, "address": "Current Location" },
  "heading": 45,
  "speed": 25,
  "battery": 85,
  "irReading": 1,
  "rfidTaps": [
    { "cardId": "RFID001", "userId": "user1", "name": "John Doe", "isVerified": true }
  ]
}
```

---

For any questions, check the code in `index.js`.
