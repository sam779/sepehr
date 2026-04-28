/**
 * Transactional email via Resend.
 * Free tier: 100 emails/day, 3000/month.
 */

const FROM_ADDRESS = 'Sepehr <noreply@sepehr.blackoutobservatory.org>';
const RESEND_API = 'https://api.resend.com/emails';

export async function sendVerificationEmail(opts: {
  to: string;
  code: string;
  resendApiKey: string;
}): Promise<void> {
  const { to, code, resendApiKey } = opts;

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject: 'Verify your Sepehr account',
      html: verificationEmailHtml(code),
      text: `Your Sepehr verification code is: ${code}\n\nThis code expires in 24 hours.`,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Email send failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

function verificationEmailHtml(code: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Verify your email</title></head>
<body style="font-family:sans-serif;background:#0a0f1e;color:#e2e8f0;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px">
    <h1 style="color:#06b6d4;margin:0 0 24px">Sepehr</h1>
    <p style="margin:0 0 16px">Your email verification code is:</p>
    <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#06b6d4;margin:0 0 24px;text-align:center">${code}</div>
    <p style="color:#94a3b8;font-size:14px;margin:0">This code expires in 24 hours. If you did not create a Sepehr account, you can safely ignore this email.</p>
  </div>
</body>
</html>`;
}
