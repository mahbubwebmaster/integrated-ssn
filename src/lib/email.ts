import nodemailer from "nodemailer";

interface SendOtpEmailParams {
  to: string;
  name: string;
  otp: string;
}

/**
 * Creates a Nodemailer transport instance.
 * Automatically configured for Gmail when SMTP_USER & SMTP_PASS are set in .env.
 */
function getEmailTransporter() {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim().replace(/\s+/g, "");

  if (!user || !pass) {
    return null;
  }

  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const isSecure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

/**
 * Sends a stylized, official Bangladesh Government branded OTP email for password recovery.
 */
export async function sendOtpEmail({ to, name, otp }: SendOtpEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const transporter = getEmailTransporter();

    if (!transporter) {
      console.warn(
        `[EMAIL DISPATCH SKIPPED] SMTP_USER or SMTP_PASS is missing in .env. Target: ${to}, OTP: ${otp}`
      );
      return {
        success: false,
        error: "মেইল সার্ভার কনফিগারেশন (.env) পাওয়া যায়নি।",
      };
    }

    const fromAddress =
      process.env.SMTP_FROM ||
      `"সমন্বিত সামাজিক নিরাপত্তা পোর্টাল" <${process.env.SMTP_USER}>`;

    const subject = `[SSNP] পাসওয়ার্ড রিসেট ভেরিফিকেশন কোড: ${otp}`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Green Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); padding: 28px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.3px;">
                গণপ্রজাতন্ত্রী বাংলাদেশ সরকার
              </h1>
              <p style="color: #a7f3d0; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">
                সমন্বিত সামাজিক নিরাপত্তা কর্মসূচি (SSNP) পোর্টাল • জেলা প্রশাসন, নেত্রকোণা
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 17px; font-weight: 700;">
                শ্রদ্ধেয় কর্মকর্তা / ব্যবহারকারী,
              </h2>
              <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                আপনার <strong>${to}</strong> ইউজার অ্যাকাউন্টের পাসওয়ার্ড পুনরুদ্ধারের আবেদন পাওয়া গেছে। একাউন্ট ভেরিফিকেশনের জন্য নিচের ৬-সংখ্যার ওটিপি (OTP) কোডটি ব্যবহার করুন:
              </p>

              <!-- OTP Highlight Box -->
              <div style="background-color: #f0fdf4; border: 2px dashed #059669; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
                <span style="font-size: 12px; font-weight: 700; color: #065f46; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">
                  আপনার ভেরিফিকেশন ওটিপি কোড
                </span>
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; color: #047857; letter-spacing: 8px; display: inline-block;">
                  ${otp}
                </span>
              </div>

              <!-- Security Notices -->
              <table role="presentation" width="100%" style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px 14px; margin-bottom: 24px;">
                <tr>
                  <td style="font-size: 12px; color: #92400e; line-height: 1.5;">
                    ⚠️ <strong>জরুরি নিরাপত্তা তথ্য:</strong>
                    <ul style="margin: 6px 0 0 0; padding-left: 18px;">
                      <li>এই কোডটির মেয়াদ পরবর্তী <strong>১৫ মিনিট</strong> পর্যন্ত কার্যকর থাকবে।</li>
                      <li>নিরাপত্তা নিশ্চিতকরণে এই কোডটি কারো সাথে শেয়ার করবেন না।</li>
                      <li>আপনি যদি এই পাসওয়ার্ড পরিবর্তনের জন্য অনুরোধ না করে থাকেন, তবে অবিলম্বে আইসিটি সেলকে অবহিত করুন।</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0;">
                কারিগরি সহায়তা ও তথ্যের জন্য যোগাযোগ করুন: উপজেলা আইসিটি অফিস, কলমাকান্দা / জেলা প্রশাসন আইসিটি সেল, নেত্রকোণা।
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              All right reserved: Department of Information and Communication Technology (DOICT).<br>
              Technical Assistance: Upazila ICT Office Kalmakanda, Netrokona. • Copyright@2026
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html: htmlContent,
      text: `আপনার SSNP পোর্টাল পাসওয়ার্ড রিসেট ভেরিফিকেশন ওটিপি কোড হলো: ${otp} (মেয়াদ ১৫ মিনিট)। কারো সাথে শেয়ার করবেন না।`,
    });

    console.log(`[EMAIL DISPATCH SUCCESS] Sent OTP to ${to}, MessageID: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error(`[EMAIL DISPATCH FAILED] Target: ${to}, Error:`, error);
    return {
      success: false,
      error: error?.message || "ইমেইল পাঠাতে ত্রুটি হয়েছে।",
    };
  }
}
