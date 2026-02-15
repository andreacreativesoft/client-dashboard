import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/** Resolve the app URL at call time (not module load time) so env vars set at runtime are picked up */
function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export interface NewLeadEmailData {
  clientName: string;
  websiteName: string;
  leadName: string;
  leadEmail: string;
  leadPhone?: string | null;
  formName?: string | null;
  message?: string | null;
  submittedAt: string;
  dashboardUrl: string;
}

export async function sendNewLeadNotification(
  toEmail: string,
  data: NewLeadEmailData
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.warn("Resend API key not configured, skipping email notification");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "notifications@resend.dev",
      to: toEmail,
      subject: `New Lead from ${data.websiteName}: ${data.leadName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Lead Notification</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #0a0a0a; padding: 24px 32px;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                        New Lead Received
                      </h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 32px;">
                      <p style="margin: 0 0 24px; color: #737373; font-size: 14px;">
                        A new lead was submitted on <strong style="color: #0a0a0a;">${data.websiteName}</strong>
                      </p>

                      <!-- Lead Details Card -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                        <tr>
                          <td>
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">
                                  <span style="color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Name</span><br>
                                  <span style="color: #0a0a0a; font-size: 16px; font-weight: 500;">${data.leadName}</span>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">
                                  <span style="color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Email</span><br>
                                  <a href="mailto:${data.leadEmail}" style="color: #0a0a0a; font-size: 16px; text-decoration: none;">${data.leadEmail}</a>
                                </td>
                              </tr>
                              ${data.leadPhone ? `
                              <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">
                                  <span style="color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Phone</span><br>
                                  <a href="tel:${data.leadPhone}" style="color: #0a0a0a; font-size: 16px; text-decoration: none;">${data.leadPhone}</a>
                                </td>
                              </tr>
                              ` : ""}
                              ${data.formName ? `
                              <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">
                                  <span style="color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Form</span><br>
                                  <span style="color: #0a0a0a; font-size: 14px;">${data.formName}</span>
                                </td>
                              </tr>
                              ` : ""}
                              ${data.message ? `
                              <tr>
                                <td style="padding: 8px 0;">
                                  <span style="color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Message</span><br>
                                  <span style="color: #0a0a0a; font-size: 14px; white-space: pre-wrap;">${data.message}</span>
                                </td>
                              </tr>
                              ` : ""}
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${data.dashboardUrl}" style="display: inline-block; background-color: #0a0a0a; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 14px; font-weight: 500;">
                              View in Dashboard
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px; border-top: 1px solid #e5e5e5; background-color: #fafafa;">
                      <p style="margin: 0; color: #737373; font-size: 12px; text-align: center;">
                        Submitted on ${data.submittedAt}<br>
                        ${data.clientName} Dashboard
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export interface WelcomeEmailData {
  userName: string;
  email: string;
  resetUrl: string;
}

export async function sendWelcomeEmail(
  toEmail: string,
  data: WelcomeEmailData
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.warn("Resend API key not configured, skipping welcome email");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "notifications@resend.dev",
      to: toEmail,
      subject: `Your Dashboard Account`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Dashboard</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #0a0a0a; padding: 24px 32px;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                        Welcome to the Dashboard
                      </h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 32px;">
                      <p style="margin: 0 0 16px; color: #0a0a0a; font-size: 16px;">
                        Hi ${data.userName},
                      </p>
                      <p style="margin: 0 0 24px; color: #737373; font-size: 14px; line-height: 1.6;">
                        Your account has been created. Click the button below to set your password and get started.
                      </p>

                      <!-- Account Info -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                        <tr>
                          <td>
                            <p style="margin: 0 0 8px; color: #737373; font-size: 12px; text-transform: uppercase;">Your login email</p>
                            <p style="margin: 0; color: #0a0a0a; font-size: 14px; font-weight: 500;">${data.email}</p>
                          </td>
                        </tr>
                      </table>

                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                        <tr>
                          <td align="center">
                            <a href="${data.resetUrl}" style="display: inline-block; background-color: #0a0a0a; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 14px; font-weight: 500;">
                              Set Your Password
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 0; color: #a3a3a3; font-size: 12px;">
                        This link will expire in 24 hours. If it expires, you can request a new one from the login page using "Forgot password".
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px; border-top: 1px solid #e5e5e5; background-color: #fafafa;">
                      <p style="margin: 0; color: #737373; font-size: 12px; text-align: center;">
                        Client Dashboard
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Failed to send welcome email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Welcome email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function sendClientEmail(
  toEmail: string,
  subject: string,
  message: string,
  senderName: string
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.warn("Resend API key not configured, skipping client email");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "notifications@resend.dev",
      to: toEmail,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background-color: #0a0a0a; padding: 24px 32px;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">${subject}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 32px;">
                      <div style="color: #0a0a0a; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 32px; border-top: 1px solid #e5e5e5; background-color: #fafafa;">
                      <p style="margin: 0; color: #737373; font-size: 12px; text-align: center;">
                        Sent by ${senderName} via Client Dashboard
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Failed to send client email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Client email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export interface AccountCreatedEmailData {
  userName: string;
  email: string;
  loginUrl: string;
}

export async function sendAccountCreatedEmail(
  toEmail: string,
  data: AccountCreatedEmailData
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.warn("Resend API key not configured, skipping account created email");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "notifications@resend.dev",
      to: toEmail,
      subject: `Your Dashboard Account is Ready`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Created</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #0a0a0a; padding: 24px 32px;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                        Your Account is Ready
                      </h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 32px;">
                      <p style="margin: 0 0 16px; color: #0a0a0a; font-size: 16px;">
                        Hi ${data.userName},
                      </p>
                      <p style="margin: 0 0 24px; color: #737373; font-size: 14px; line-height: 1.6;">
                        Your account has been created. You can log in using the credentials provided by your administrator.
                      </p>

                      <!-- Account Info -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                        <tr>
                          <td>
                            <p style="margin: 0 0 8px; color: #737373; font-size: 12px; text-transform: uppercase;">Your login email</p>
                            <p style="margin: 0; color: #0a0a0a; font-size: 14px; font-weight: 500;">${data.email}</p>
                          </td>
                        </tr>
                      </table>

                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                        <tr>
                          <td align="center">
                            <a href="${data.loginUrl}" style="display: inline-block; background-color: #0a0a0a; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 14px; font-weight: 500;">
                              Go to Dashboard
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 0; color: #a3a3a3; font-size: 12px;">
                        You can change your password anytime from Settings after logging in.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px; border-top: 1px solid #e5e5e5; background-color: #fafafa;">
                      <p style="margin: 0; color: #737373; font-size: 12px; text-align: center;">
                        Client Dashboard
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Failed to send account created email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Account created email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export interface InviteEmailData {
  inviteeName: string;
  inviterName: string;
  token: string;
  expiresAt: string;
}

export async function sendInviteEmail(
  toEmail: string,
  data: InviteEmailData
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.warn("Resend API key not configured, skipping invite email");
    return { success: false, error: "Email service not configured" };
  }

  const inviteUrl = `${getAppUrl()}/invite/${data.token}`;

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "notifications@resend.dev",
      to: toEmail,
      subject: `You're invited to join the Dashboard`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Dashboard Invitation</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #0a0a0a; padding: 24px 32px;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                        You're Invited!
                      </h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 32px;">
                      <p style="margin: 0 0 16px; color: #0a0a0a; font-size: 16px;">
                        Hi ${data.inviteeName},
                      </p>
                      <p style="margin: 0 0 24px; color: #737373; font-size: 14px; line-height: 1.6;">
                        ${data.inviterName} has invited you to join the Client Dashboard.
                        Click the button below to create your account and get started.
                      </p>

                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                        <tr>
                          <td align="center">
                            <a href="${inviteUrl}" style="display: inline-block; background-color: #0a0a0a; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 14px; font-weight: 500;">
                              Accept Invitation
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 0 0 16px; color: #737373; font-size: 13px;">
                        Or copy and paste this link into your browser:
                      </p>
                      <p style="margin: 0 0 24px; color: #0a0a0a; font-size: 12px; word-break: break-all; background-color: #f5f5f5; padding: 12px; border-radius: 4px;">
                        ${inviteUrl}
                      </p>

                      <p style="margin: 0; color: #a3a3a3; font-size: 12px;">
                        This invitation expires on ${data.expiresAt}. If you didn't expect this invitation, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px; border-top: 1px solid #e5e5e5; background-color: #fafafa;">
                      <p style="margin: 0; color: #737373; font-size: 12px; text-align: center;">
                        Client Dashboard
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Failed to send invite email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Invite email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
