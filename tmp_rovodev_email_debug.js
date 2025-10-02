const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

console.log('=== EMAIL CONFIGURATION DEBUG ===\n');

// 1. Check environment variables
console.log('1. Environment Variables Check:');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? `SET (${process.env.EMAIL_USER})` : 'NOT SET');
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'SET (hidden)' : 'NOT SET');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST || 'NOT SET (using default: smtp.gmail.com)');
console.log('EMAIL_PORT:', process.env.EMAIL_PORT || 'NOT SET (using default: 587)');
console.log('');

// 2. Check if basic requirements are met
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('❌ MISSING CONFIGURATION:');
    console.log('Please set the following in your .env file:');
    console.log('EMAIL_USER=your-gmail@gmail.com');
    console.log('EMAIL_PASSWORD=your-app-password');
    console.log('');
    console.log('🔧 HOW TO GET APP PASSWORD:');
    console.log('1. Go to Google Account settings');
    console.log('2. Enable 2-Factor Authentication');
    console.log('3. Go to Security > App passwords');
    console.log('4. Generate an app password for "Mail"');
    console.log('5. Use that 16-character password in EMAIL_PASSWORD');
    process.exit(1);
}

// 3. Test transporter creation
console.log('2. Creating Email Transporter:');
let transporter;
try {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
    });
    console.log('✅ Transporter created successfully');
} catch (error) {
    console.log('❌ Failed to create transporter:', error.message);
    process.exit(1);
}

// 4. Test connection
console.log('');
console.log('3. Testing Email Connection:');
transporter.verify((error, success) => {
    if (error) {
        console.log('❌ Connection failed:', error.message);
        console.log('');
        console.log('🔧 COMMON SOLUTIONS:');
        console.log('1. Make sure you\'re using an App Password, not your regular Gmail password');
        console.log('2. Enable 2-Factor Authentication on your Google account');
        console.log('3. Check if Less Secure App Access is disabled (should be)');
        console.log('4. Try generating a new App Password');
        console.log('5. Make sure your Gmail account is not suspended');
        
        // Additional error-specific suggestions
        if (error.message.includes('Username and Password not accepted')) {
            console.log('');
            console.log('❗ AUTHENTICATION ERROR:');
            console.log('- Double-check your EMAIL_USER is correct');
            console.log('- Regenerate App Password and update EMAIL_PASSWORD');
        }
        
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
            console.log('');
            console.log('❗ NETWORK ERROR:');
            console.log('- Check your internet connection');
            console.log('- Try different network/VPN');
            console.log('- Check firewall settings');
        }
        
        process.exit(1);
    } else {
        console.log('✅ Email connection verified successfully!');
        
        // 5. Send test email
        console.log('');
        console.log('4. Sending Test Email:');
        
        const testEmail = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to self for testing
            subject: 'StyleDev Backend Email Test',
            html: `
                <h1>Email Service Test</h1>
                <p>This is a test email from your StyleDev backend.</p>
                <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                <p>If you received this email, your email service is working correctly!</p>
            `,
            text: `
                Email Service Test
                
                This is a test email from your StyleDev backend.
                Timestamp: ${new Date().toISOString()}
                
                If you received this email, your email service is working correctly!
            `
        };
        
        transporter.sendMail(testEmail, (error, info) => {
            if (error) {
                console.log('❌ Test email failed:', error.message);
                console.log('Error details:', error);
            } else {
                console.log('✅ Test email sent successfully!');
                console.log('Message ID:', info.messageId);
                console.log('Check your email inbox for the test message.');
                console.log('');
                console.log('🎉 EMAIL SERVICE IS WORKING!');
                console.log('You can now use email features in your application.');
            }
        });
    }
});