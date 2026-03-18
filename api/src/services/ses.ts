import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import * as fs from "fs";
import * as path from "path";

const ses = new SESClient({ region: process.env.AWS_REGION ?? "eu-west-3" });

const FROM_EMAIL = process.env.SES_FROM_EMAIL ?? "noreply@example.com";

const TEMPLATES_DIR =
  process.env.EMAIL_TEMPLATES_DIR ??
  path.join(process.cwd(), "..", "emails");

/**
 * Send a generic email via AWS SES.
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: htmlBody, Charset: "UTF-8" },
      },
    },
  });

  await ses.send(command);
}

/**
 * Load an HTML template and replace {{variables}}.
 */
function loadTemplate(
  templateName: string,
  variables: Record<string, string>
): string {
  const filePath = path.join(TEMPLATES_DIR, `${templateName}.html`);
  let html = fs.readFileSync(filePath, "utf-8");

  for (const [key, value] of Object.entries(variables)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }

  return html;
}

/**
 * Send a team invitation email via SES.
 */
export async function sendInvitationEmail(
  to: string,
  teamName: string,
  inviterName: string,
  inviteLink: string
): Promise<void> {
  const html = loadTemplate("invitation", {
    teamName,
    inviterName,
    inviteLink,
  });

  await sendEmail(to, `Invitation a rejoindre ${teamName}`, html);
}
