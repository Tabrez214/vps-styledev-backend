const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

console.log('=== TESTING EMAIL FIX ===\n');

// Create transporter with TLS configuration to handle certificate issues
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false // This fixes the self-signed certificate issue
    }
});

console.log('Testing email connection with TLS fix...');

transporter.verify((error, success) => {
    if (error) {
        console.log('❌ Still failed:', error.message);
    } else {
        console.log('✅ Email connection fixed!');
        
        // Send test email
        const testEmail = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: 'StyleDev Email Fix Test',
            html: '<h1>Email is working!</h1><p>The TLS fix resolved the certificate issue.</p>',
            text: 'Email is working! The TLS fix resolved the certificate issue.'
        };
        
        transporter.sendMail(testEmail, (error, info) => {
            if (error) {
                console.log('❌ Test email failed:', error.message);
            } else {
                console.log('✅ Test email sent successfully!');
                console.log('Message ID:', info.messageId);
                console.log('\n🎉 EMAIL SERVICE IS NOW WORKING!');
                console.log('Apply this fix to your emailService.ts file.');
            }
        });
    }
});