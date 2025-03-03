const { MailtrapClient } = require('mailtrap');
const dotenv = require('dotenv').config();

const TOKEN = process.env.MAILTRAP_TOKEN;

// Check if the token is loaded correctly
if (!TOKEN) {
  throw new Error(
    'Mailtrap token is not defined. Please check your .env file.'
  );
}

exports.MailtrapClient = new MailtrapClient({
  token: TOKEN,
});

exports.MailtrapSender = {
  email: 'mailtrap@demomailtrap.com',
  name: 'Mailtrap Test',
};
