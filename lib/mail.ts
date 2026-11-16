import nodemailer from 'nodemailer'
import { AGENCY } from './crm'

// Con SMTP_URL los emails salen de verdad. Sin ella, nodemailer solo los convierte a JSON y
// los enseñamos por consola, que es lo práctico mientras se desarrolla.
const transport = process.env.SMTP_URL
  ? nodemailer.createTransport(process.env.SMTP_URL)
  : nodemailer.createTransport({ jsonTransport: true })

export async function sendMail(message: { to: string; subject: string; text: string }) {
  await transport.sendMail({ from: process.env.MAIL_FROM ?? `${AGENCY} <hola@example.test>`, ...message })

  if (!process.env.SMTP_URL) {
    console.log(`Para: ${message.to}\nAsunto: ${message.subject}\n\n${message.text}\n`)
  }
}
