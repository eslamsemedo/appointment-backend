/**
 * Production build verification — mirrors server.js startup without keeping the process alive.
 * Fails fast if env vars, imports, DB connection, or HTTP server binding would crash in prod.
 */
import mongoose from 'mongoose';
import app from '../src/app.js';
import env from '../src/config/env.js';
import connectDB from '../src/config/db.js';

process.env.NODE_ENV = 'production';

async function verifyBuild() {
  console.log('Verifying production build...\n');

  console.log('✓ Environment variables validated');

  // Importing app loads the full module graph (routes, middleware, services).
  console.log('✓ Application modules loaded');

  await connectDB(env.MONGO_URL);
  console.log('✓ Database connection verified');

  await new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      console.log(`✓ HTTP server bound on port ${port}`);

      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    server.on('error', reject);
  });

  await mongoose.disconnect();
  console.log('\n✓ Production build verification passed');
}

verifyBuild().catch((err) => {
  console.error('\n✗ Production build verification failed:', err.message);
  process.exit(1);
});
