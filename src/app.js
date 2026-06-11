import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import tenantRouter from './routes/tenants.js';
import appointmentTypeRouter from './routes/appointmentTypes.js';
import bookingRouter from './routes/bookings.js';
import errorHandler from './middleware/errorHandler.js';


const app = express();

// const allowedOrigins = process.env.ALLOWED_ORIGINS
//   ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
//   : [];

// app.use((req, res, next) => {
//   cors({
//     origin(origin, callback) {
//       // Allow requests with no origin (server-to-server, curl, mobile apps)
//       if (!origin) return callback(null, true);
//       if (allowedOrigins.includes(origin)) return callback(null, true);
//       // Reject with 403 so the browser receives a proper response
//       res.status(403).json({ message: `CORS: origin '${origin}' is not allowed` });
//     },
//     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
//     credentials: true,
//   })(req, res, next);
// });
app.use(express.json());

// health check
app.get('/health', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/tenants', tenantRouter);
app.use('/api/v1/appointment-types', appointmentTypeRouter);
app.use('/api/v1/bookings', bookingRouter);

// Global error handler — must be mounted last.
app.use(errorHandler);

export default app;
