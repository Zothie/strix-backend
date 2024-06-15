import nodemailer from "nodemailer";
import dotenv from "dotenv";
import firebase from "firebase-admin";
dotenv.config();



//  Admin SDK config
const firebaseCredentials = {
  type: `${process.env.FB_ASDK_TYPE}`,
  project_id: `${process.env.FB_ASDK_PROJECT_ID}`,
  private_key_id: `${process.env.FB_ASDK_PROJECT_KEY_ID}`,
  private_key: `${formatPrivateKey(process.env.FB_ASDK_PRIVATE_KEY)}`,
  client_email: `${process.env.FB_ASDK_CLIENT_EMAIL}`,
  client_id: `${process.env.FB_ASDK_CLIENT_ID}`,
  auth_uri: `${process.env.FB_ASDK_AUTH_URI}`,
  token_uri: `${process.env.FB_ASDK_TOKEN_URI}`,
  auth_provider_x509_cert_url: `${process.env.FB_ASDK_AUTH_PROVIDER}`,
  client_x509_cert_url: `${process.env.FB_ASDK_CLIENT_CERT}`,
  universe_domain: `${process.env.FB_ASDK_UNIVERSE_DOMAIN}`,
};
firebase.initializeApp({
  credential: firebase.credential.cert(firebaseCredentials),
});
function formatPrivateKey(key) {
  return key.replace(/\\n/g, "\n");
}


// Emailing service
export const mailService = nodemailer.createTransport({
  host: "mail.infomaniak.com",
  port: 465,
  secure: true,
  auth: {
    user: `${process.env.MAIL_USER}`,
    pass: `${process.env.MAIL_PWD}`,
  },
});
