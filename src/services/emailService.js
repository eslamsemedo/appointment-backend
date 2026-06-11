import { Resend } from 'resend';
import env from '../config/env.js';

// ---------------------------------------------------------------------------
// Email delivery via Resend (HTTPS API)
// ---------------------------------------------------------------------------
// Railway (and most cloud hosts) block/throttle outbound SMTP, so the old
// per-tenant nodemailer+Gmail path timed out in production ("Connection
// timeout"). We now send through Resend's HTTPS API on port 443, which is not
// blocked.
//
// All tenants share a single Resend account: mail is sent FROM a verified
// address (EMAIL_FROM) with the tenant's business name as the display name,
// and the tenant's own address as Reply-To so customer replies reach them.

let resendClient = null;
const getResend = () => {
  if (!env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
};

// EMAIL_FROM may be a bare address or "Name <addr>" — extract the address so we
// can re-wrap it with the tenant's display name.
const extractAddress = (value = '') => {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim();
};

// Returns { client, from, replyTo } or null when Resend is not configured.
const resolveSender = (tenant) => {
  const client = getResend();
  if (!client || !env.EMAIL_FROM) return null;

  const fromAddress = extractAddress(env.EMAIL_FROM);
  const displayName = tenant.senderName || tenant.name || 'Appointly';
  // Reply-To routes customer replies to the tenant's real inbox.
  const replyTo = tenant.senderEmail || tenant.email || undefined;

  return {
    client,
    from: `${displayName} <${fromAddress}>`,
    replyTo,
  };
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

  const sender = resolveSender(tenant);
  if (!sender) {
    console.warn(
      `[email] Resend not configured (RESEND_API_KEY/EMAIL_FROM) — skipping confirmation email for tenant ${tenant._id}.`
    );
    return;
  }

  try {
    const { data, error } = await sender.client.emails.send({
      from: sender.from,
      to: booking.customer.email,
      replyTo: sender.replyTo,
      subject: `Your appointment is confirmed — ${businessName}`,
      text: renderText(content),
      html: renderEmail(content),
    });
    if (error) {
      console.error(
        `[email] Confirmation send rejected for ${booking.customer.email}:`,
        error
      );
      return;
    }
    console.log(
      `[email] Confirmation sent to ${booking.customer.email} (id: ${data?.id})`
    );
  } catch (err) {
    console.error(
      `[email] Failed to send confirmation email to ${booking.customer.email}:`,
      err
    );
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

  const sender = resolveSender(tenant);
  if (!sender) {
    console.warn(
      `[email] Resend not configured (RESEND_API_KEY/EMAIL_FROM) — skipping cancellation email for tenant ${tenant._id}.`
    );
    return;
  }

  try {
    const { data, error } = await sender.client.emails.send({
      from: sender.from,
      to: booking.customer.email,
      replyTo: sender.replyTo,
      subject: `Your appointment was cancelled — ${businessName}`,
      text: renderText(content),
      html: renderEmail(content),
    });
    if (error) {
      console.error(
        `[email] Cancellation send rejected for ${booking.customer.email}:`,
        error
      );
      return;
    }
    console.log(
      `[email] Cancellation sent to ${booking.customer.email} (id: ${data?.id})`
    );
  } catch (err) {
    console.error(
      `[email] Failed to send cancellation email to ${booking.customer.email}:`,
      err
    );
  }
};

// Verify a tenant's sender credentials and send a test email to themselves.
// Unlike the fire-and-forget senders above, this throws on failure so the
// caller (test endpoint) can report the real SMTP error to the tenant.
export const sendTestEmail = async (tenant) => {
  const sender = resolveSender(tenant);
  if (!sender) {
    const err = new Error('No email sender configured');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

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

  const { error } = await sender.client.emails.send({
    from: sender.from,
    to: tenant.email,
    replyTo: sender.replyTo,
    subject: `Test email — ${businessName}`,
    text: renderText(content),
    html: renderEmail(content),
  });
  if (error) {
    // Surface the real Resend error to the caller (test endpoint).
    throw new Error(error.message || 'Resend rejected the message');
  }
};
