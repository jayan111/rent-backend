import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
}

const BRAND = '#0284c7';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const adminUrl = process.env.ADMIN_URL || 'http://localhost:3001';

const emailWrapper = (body: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:linear-gradient(135deg,#0c4a6e 0%,${BRAND} 100%);padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="width:34px;height:34px;background:rgba(255,255,255,.2);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:15px;">R</div>
        <span style="color:white;font-weight:600;font-size:17px;">RentYourNeeds</span>
      </div>
      {{HEADER}}
    </div>
    <div style="padding:28px 32px;">
      {{BODY}}
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;text-align:center;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">Questions? Contact us at support@rentyourneeds.com</p>
        <p style="color:#cbd5e1;font-size:11px;margin:6px 0 0;">© ${new Date().getFullYear()} RentYourNeeds · Free delivery · Zero deposit</p>
      </div>
    </div>
  </div>
</body>
</html>`;

function buildEmail(header: string, body: string): string {
  return emailWrapper('').replace('{{HEADER}}', header).replace('{{BODY}}', body);
}

// ─── Order Confirmation ────────────────────────────────────────────────────────

export interface OrderEmailItem {
  name: string;
  quantity: number;
  price: number;
  tenureMonths: number;
}

export interface OrderEmailData {
  to: string;
  orderId: string;
  userName: string;
  items: OrderEmailItem[];
  totalAmount: number;
  deliveryAddress: { street: string; city: string; state: string; pincode: string };
  credentials?: { email: string; password: string };
}

export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<void> {
  const { to, orderId, userName, items, totalAmount, deliveryAddress, credentials } = data;

  const itemRows = items.map(item => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;color:#1e293b;font-size:14px;">${item.name}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:center;color:#475569;font-size:14px;">${item.quantity}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:center;color:#475569;font-size:14px;">${item.tenureMonths} mo</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:right;color:#1e293b;font-weight:600;font-size:14px;">${formatCurrency(item.price * item.quantity * item.tenureMonths)}</td>
    </tr>`).join('');

  const credentialsBlock = credentials ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin:24px 0;">
      <h3 style="color:#1d4ed8;margin:0 0 10px;font-size:15px;">🔐 Your Account Credentials</h3>
      <p style="margin:0 0 12px;color:#374151;font-size:13px;">We created an account so you can track orders and manage your rentals.</p>
      <table style="width:100%;">
        <tr>
          <td style="padding:5px 0;color:#6b7280;font-size:13px;width:80px;">Email</td>
          <td style="padding:5px 0;color:#111827;font-weight:700;font-size:13px;">${credentials.email}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#6b7280;font-size:13px;">Password</td>
          <td style="padding:5px 0;color:#111827;font-weight:700;font-size:14px;letter-spacing:3px;">${credentials.password}</td>
        </tr>
      </table>
      <div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:10px 14px;margin-top:14px;border-radius:4px;">
        <p style="margin:0;color:#92400e;font-size:13px;">⚠️ You must change your password on first login for security.</p>
      </div>
      <div style="margin-top:16px;text-align:center;">
        <a href="${frontendUrl}/auth/login" style="display:inline-block;background:#1d4ed8;color:white;padding:11px 26px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Login to Your Account →</a>
      </div>
    </div>` : `
    <div style="text-align:center;margin:24px 0;">
      <a href="${frontendUrl}/orders" style="display:inline-block;background:${BRAND};color:white;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">View My Orders →</a>
    </div>`;

  const header = `
    <h1 style="color:white;margin:0;font-size:22px;">Order Confirmed! 🎉</h1>
    <p style="color:rgba(255,255,255,.8);margin:8px 0 0;font-size:14px;">Thank you, ${userName}. Your rental is on its way!</p>`;

  const body = `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
      <p style="margin:0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Order ID</p>
      <p style="margin:4px 0 0;color:#0f172a;font-weight:700;font-size:18px;font-family:monospace;">#${orderId.slice(-8).toUpperCase()}</p>
    </div>

    <h2 style="color:#0f172a;font-size:13px;margin:0 0 10px;text-transform:uppercase;letter-spacing:.5px;">Order Summary</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 8px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;">Item</th>
          <th style="padding:10px 8px;text-align:center;color:#64748b;font-size:11px;text-transform:uppercase;">Qty</th>
          <th style="padding:10px 8px;text-align:center;color:#64748b;font-size:11px;text-transform:uppercase;">Tenure</th>
          <th style="padding:10px 8px;text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:12px 8px;text-align:right;font-weight:700;color:#0f172a;font-size:15px;">Grand Total</td>
          <td style="padding:12px 8px;text-align:right;font-weight:700;color:${BRAND};font-size:18px;">${formatCurrency(totalAmount)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="margin-top:24px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <p style="margin:0 0 8px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">📍 Delivery Address</p>
      <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.7;">
        ${deliveryAddress.street}<br>
        ${deliveryAddress.city}, ${deliveryAddress.state} — ${deliveryAddress.pincode}
      </p>
    </div>

    ${credentialsBlock}`;

  await transporter.sendMail({
    from: `"RentYourNeeds" <${process.env.SMTP_USER}>`,
    to,
    subject: `Order Confirmed #${orderId.slice(-8).toUpperCase()} — RentYourNeeds`,
    html: buildEmail(header, body),
  });
}

// ─── Password Reset ────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetToken: string, userName: string, isAdmin = false): Promise<void> {
  const baseUrl = isAdmin ? adminUrl : frontendUrl;
  const resetPath = isAdmin ? '/reset-password' : '/auth/reset-password';
  const resetUrl = `${baseUrl}${resetPath}?token=${resetToken}`;

  const header = `
    <h1 style="color:white;margin:0;font-size:20px;">Reset Your Password</h1>
    <p style="color:rgba(255,255,255,.8);margin:8px 0 0;font-size:14px;">Follow the link below to set a new password</p>`;

  const body = `
    <p style="color:#374151;font-size:15px;margin:0 0 16px;">Hi ${userName},</p>
    <p style="color:#374151;font-size:15px;margin:0 0 24px;">We received a request to reset your password. Click the button below — this link expires in <strong>1 hour</strong>.</p>

    <div style="text-align:center;margin:28px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:${BRAND};color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Reset Password →</a>
    </div>

    <div style="background:#fef3c7;border-radius:6px;padding:12px 16px;">
      <p style="margin:0;color:#92400e;font-size:13px;">If you didn't request this, you can safely ignore this email. Your password will not change.</p>
    </div>

    <p style="color:#94a3b8;font-size:12px;margin-top:20px;word-break:break-all;">Or copy this link: ${resetUrl}</p>`;

  await transporter.sendMail({
    from: `"RentYourNeeds" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Reset Your Password — RentYourNeeds',
    html: buildEmail(header, body),
  });
}
