import nodemailer from "nodemailer";

type SendEmailArgs = {
    to: string;
    subject: string;
    html: string;
    text?: string;
};

function requireEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env ${name}`);
    return v;
}

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
    if (cachedTransporter) return cachedTransporter;

    const host = requireEnv("SMTP_HOST");
    const port = Number(requireEnv("SMTP_PORT"));
    const user = requireEnv("SMTP_USER");
    const pass = requireEnv("SMTP_PASS");

    cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // 465 = SSL
        auth: { user, pass },
    });

    return cachedTransporter;
}

export async function sendEmail({ to, subject, html, text }: SendEmailArgs) {
    const from = requireEnv("SMTP_FROM");
    const transporter = getTransporter();

    await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text: text ?? html.replace(/<[^>]*>/g, ""),
    });
}
