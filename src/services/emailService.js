import nodemailer from 'nodemailer';
import Tenant from '../models/Tenant.js';
import { decrypt } from '../utils/crypto.js';
import env from '../config/env.js';

// ---------------------------------------------------------------------------
// Per-tenant sender resolution
// ---------------------------------------------------------------------------
// Each tenant brings their own mailbox (senderEmail + encrypted
// senderAppPassword). The shared GMAIL_* env account is only a legacy fallback
// for tenants that never configured a sender.
//
// req.tenant is loaded without select:false fields, so senderAppPassword is
// usually absent — we re-fetch it explicitly here.

const buildGmailTransport = (user, pass) =>
  nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  });

// Returns { transporter, from } or null when no sender is configured at all.
const resolveSender = async (tenant) => {
  // Pull the encrypted password (select:false) if it wasn't already loaded.
  let senderEmail = tenant.senderEmail;
  let senderName = tenant.senderName;
  let encrypted = tenant.senderAppPassword;

  if (senderEmail && encrypted === undefined) {
    const withSecret = await Tenant.findById(tenant._id).select(
      '+senderAppPassword senderEmail senderName name'
    );
    senderEmail = withSecret?.senderEmail;
    senderName = withSecret?.senderName;
    encrypted = withSecret?.senderAppPassword;
  }

  if (senderEmail && encrypted) {
    const displayName = senderName || tenant.name || senderEmail;
    return {
      transporter: buildGmailTransport(senderEmail, decrypt(encrypted)),
      from: `"${displayName}" <${senderEmail}>`,
    };
  }

  // Legacy fallback: shared env account (if configured).
  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    return {
      transporter: buildGmailTransport(env.GMAIL_USER, env.GMAIL_APP_PASSWORD),
      from: env.EMAIL_FROM || env.GMAIL_USER,
    };
  }

  return null;
};

// ---------------------------------------------------------------------------
// Modern, responsive HTML template (inline styles — email clients ignore <style>)
// ---------------------------------------------------------------------------
const escapeHtml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const renderEmail = ({
  businessName,
  preheader,
  accent,
  badgeLabel,
  badgeBg,
  badgeColor,
  heading,
  message,
  rows,
  closing,
}) => {
  const rowsHtml = rows
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eef0f3;color:#6b7280;font-size:13px;">${escapeHtml(
            label
          )}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eef0f3;color:#111827;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(
            value
          )}</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(
    preheader
  )}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,0.08);">
        <tr><td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 32px 8px;">
          <p style="margin:0 0 20px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#9ca3af;">${escapeHtml(
            businessName
          )}</p>
          <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${badgeBg};color:${badgeColor};font-size:12px;font-weight:600;">${escapeHtml(
            badgeLabel
          )}</span>
          <h1 style="margin:16px 0 8px;font-size:22px;line-height:1.3;color:#111827;font-weight:700;">${escapeHtml(
            heading
          )}</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#4b5563;">${escapeHtml(
            message
          )}</p>
        </td></tr>
        <tr><td style="padding:20px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;padding:8px 16px;">
            ${rowsHtml}
          </table>
        </td></tr>
        <tr><td style="padding:16px 32px 32px;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">${escapeHtml(
            closing
          )}</p>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Sent by ${escapeHtml(
        businessName
      )}</p>
    </td></tr>
  </table>
</body>
</html>`;
};

const renderText = ({ heading, message, rows, closing }) =>
  `${heading}\n\n${message}\n\n${rows
    .map((r) => `- ${r.label}: ${r.value}`)
    .join('\n')}\n\n${closing}`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
// Email errors must NOT crash the server. Every send is wrapped in try/catch —
// we log and continue. The booking status was already updated beforehand.

export const sendConfirmationEmail = async (tenant, booking, appointmentTypeName) => {
  const businessName = tenant.senderName || tenant.name || 'Appointly';
  const rows = [
    { label: 'Service', value: appointmentTypeName || '—' },
    { label: 'Date', value: booking.date },
    { label: 'Time', value: booking.time },
  ];
  const content = {
    businessName,
    preheader: `Your appointment on ${booking.date} at ${booking.time} is confirmed.`,
    accent: '#16a34a',
    badgeLabel: 'Confirmed',
    badgeBg: '#dcfce7',
    badgeColor: '#15803d',
    heading: `You're all set, ${booking.customer.name}`,
    message: 'Your appointment has been confirmed. Here are the details:',
    rows,
    closing: 'We look forward to seeing you. If anything changes, just reply to this email.',
  };

  try {
    const sender = await resolveSender(tenant);
    if (!sender) {
      console.warn(`No email sender configured for tenant ${tenant._id} — skipping confirmation email.`);
      return;
    }
    await sender.transporter.sendMail({
      from: sender.from,
      to: booking.customer.email,
      subject: `Your appointment is confirmed — ${businessName}`,
      text: renderText(content),
      html: renderEmail(content),
    });
  } catch (err) {
    console.error('Failed to send confirmation email:', err.message);
  }
};

export const sendCancellationEmail = async (tenant, booking, appointmentTypeName) => {
  const businessName = tenant.senderName || tenant.name || 'Appointly';
  const rows = [
    { label: 'Service', value: appointmentTypeName || '—' },
    { label: 'Date', value: booking.date },
    { label: 'Time', value: booking.time },
  ];
  const content = {
    businessName,
    preheader: `Your appointment on ${booking.date} at ${booking.time} has been cancelled.`,
    accent: '#dc2626',
    badgeLabel: 'Cancelled',
    badgeBg: '#fee2e2',
    badgeColor: '#b91c1c',
    heading: `Appointment cancelled`,
    message: `Hi ${booking.customer.name}, your appointment has been cancelled. Here's what was booked:`,
    rows,
    closing: 'If this was a mistake or you would like to rebook, simply reply to this email.',
  };

  try {
    const sender = await resolveSender(tenant);
    if (!sender) {
      console.warn(`No email sender configured for tenant ${tenant._id} — skipping cancellation email.`);
      return;
    }
    await sender.transporter.sendMail({
      from: sender.from,
      to: booking.customer.email,
      subject: `Your appointment was cancelled — ${businessName}`,
      text: renderText(content),
      html: renderEmail(content),
    });
  } catch (err) {
    console.error('Failed to send cancellation email:', err.message);
  }
};

// Verify a tenant's sender credentials and send a test email to themselves.
// Unlike the fire-and-forget senders above, this throws on failure so the
// caller (test endpoint) can report the real SMTP error to the tenant.
export const sendTestEmail = async (tenant) => {
  const sender = await resolveSender(tenant);
  if (!sender) {
    const err = new Error('No email sender configured');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  await sender.transporter.verify(); // validates host/auth before sending

  const businessName = tenant.senderName || tenant.name || 'Appointly';
  const content = {
    businessName,
    preheader: 'Your email sender is working correctly.',
    accent: '#4f46e5',
    badgeLabel: 'Test',
    badgeBg: '#e0e7ff',
    badgeColor: '#4338ca',
    heading: 'Your email sender works! 🎉',
    message:
      'This is a test message confirming your appointment emails will be delivered to your customers from this mailbox.',
    rows: [
      { label: 'Sender', value: sender.from.replace(/^"[^"]*"\s*/, '') },
      { label: 'Status', value: 'Connected' },
    ],
    closing: 'You can safely ignore this email — no action is needed.',
  };

  await sender.transporter.sendMail({
    from: sender.from,
    to: tenant.email,
    subject: `Test email — ${businessName}`,
    text: renderText(content),
    html: renderEmail(content),
  });
};
