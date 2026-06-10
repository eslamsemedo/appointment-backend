import app from './src/app.js';
import env from './src/config/env.js';
import connectDB from './src/config/db.js';

const PORT = env.PORT;

console.log('connecting to MongoDB...');
connectDB(env.MONGO_URL)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
