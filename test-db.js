import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://harihk0506:anbu@cluster0.yzukbbs.mongodb.net/';

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...');
    console.log('MongoDB URI:', MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@'));
    
    await mongoose.connect(MONGO_URI);
    console.log('✅ Successfully connected to MongoDB');
    
    // Test creating a collection
    const db = mongoose.connection.db;
    await db.createCollection('test');
    console.log('✅ Successfully created test collection');
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('Existing collections:', collections.map(c => c.name));
    
    // Clean up
    await db.dropCollection('test');
    console.log('✅ Cleaned up test collection');
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ MongoDB Error:', error.message);
    console.error('Full error:', error);
  } finally {
    process.exit(0);
  }
}

testConnection();
