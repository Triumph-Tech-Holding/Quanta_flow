import nodemailer from "nodemailer";
import { log } from "../index";

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  config: EmailConfig
): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    await transporter.sendMail({
      from: config.smtpUser,
      to,
      subject,
      text: body,
    });
    log(`[email] Sent to ${to}: "${subject}"`, "email");
    return true;
  } catch (err) {
    log(`[email] Send error: ${String(err)}`, "email");
    return false;
  }
}

export async function testSmtpConnection(config: EmailConfig): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}
