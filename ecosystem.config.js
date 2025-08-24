module.exports = {
  apps: [
    {
      name: 'robo-ride-backend',
      script: 'index.js',
      env: {
        PORT: 4000,
        MONGO_URI: 'mongodb://localhost:27017/roboride'
      }
    }
  ]
};
