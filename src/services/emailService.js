import nodemailer from 'nodemailer';
import env from '../config/env.js';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: env.GMAIL_USER,
    pass: env.GMAIL_APP_PASSWORD,
  },
});

// Email errors must NOT crash the server. Every sendMail() call is wrapped in
// try/catch — we log and continue. The booking status was already updated
// before the email was attempted.

export const sendConfirmationEmail = async (booking, appointmentTypeName) => {
  const text = `Hi ${booking.customer.name},

Your appointment has been confirmed.

Details:
- Service: ${appointmentTypeName}
- Date: ${booking.date}
- Time: ${booking.time}

See you soon!`;

  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: booking.customer.email,
      subject: 'Your appointment is confirmed',
      text,
    });
  } catch (err) {
    console.error('Failed to send confirmation email:', err.message);
  }
};

export const sendCancellationEmail = async (booking, appointmentTypeName) => {
  const text = `Hi ${booking.customer.name},

Your appointment on ${booking.date} at ${booking.time} has been cancelled.

If you have questions, please contact us.`;

  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: booking.customer.email,
      subject: 'Your appointment has been cancelled',
      text,
    });
  } catch (err) {
    console.error('Failed to send cancellation email:', err.message);
  }
};
