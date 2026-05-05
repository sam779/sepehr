/**
 * Transactional email via Resend.
 * Free tier: 100 emails/day, 3000/month.
 */

const DEFAULT_FROM_ADDRESS = 'Sepehr <noreply@blackoutobservatory.org>';
const LEGACY_FROM_ADDRESS = 'Sepehr <noreply@sepehr.blackoutobservatory.org>';
const RESEND_API = 'https://api.resend.com/emails';

export async function sendVerificationEmail(opts: {
  to: string;
  code: string;
  resendApiKey: string;
  fromAddress?: string;
}): Promise<void> {
  const { to, code, resendApiKey, fromAddress } = opts;
  const fromCandidates = unique([
    fromAddress,
    DEFAULT_FROM_ADDRESS,
    LEGACY_FROM_ADDRESS,
  ]);

  let lastError = '';

  for (const sender of fromCandidates) {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender,
        to: [to],
        subject: 'Verify your Sepehr account',
        html: verificationEmailHtml(code),
        text: `Your Sepehr verification code is: ${code}\n\nThis code expires in 24 hours.`,
      }),
    });

    if (res.ok) return;

    const text = await res.text().catch(() => '');
    lastError = `Email send failed from ${sender} (${res.status}): ${text.slice(0, 200)}`;

    // Resend API key/domain mismatch: try next sender candidate.
    const unauthorizedSender =
      res.status === 403 && text.toLowerCase().includes('not authorized to send emails from');
    if (unauthorizedSender) continue;

    throw new Error(lastError);
  }

  throw new Error(lastError || 'Email send failed: no sender address available');
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => !!v?.trim()))];
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
