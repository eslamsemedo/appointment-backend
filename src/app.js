import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import tenantRouter from './routes/tenants.js';
import appointmentTypeRouter from './routes/appointmentTypes.js';
import bookingRouter from './routes/bookings.js';
import errorHandler from './middleware/errorHandler.js';
import connectDB from './config/db.js';

const app = express();

// Allow all origins for now.
// app.use(cors( {
//   origin: '*',
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true,
//   allowedOrigins: ["*"],
// }
// ));
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
