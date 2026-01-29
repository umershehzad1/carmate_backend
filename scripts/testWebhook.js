#!/usr/bin/env node

/**
 * Webhook Test Script
 * 
 * This script helps test and debug Stripe webhook configuration
 * Run with: node scripts/testWebhook.js
 * 
 * USAGE: Keep this file for debugging webhook issues in production
 */

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET || process.env.STRIPE_SECRET_KEY);

async function testWebhookConfiguration() {
  console.log('🔍 Testing Stripe Webhook Configuration...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`STRIPE_SECRET: ${process.env.STRIPE_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`STRIPE_WEBHOOK_SECRET: ${process.env.STRIPE_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`PORT: ${process.env.PORT || 'not set'}\n`);

  try {
    // Test Stripe connection
    console.log('🔗 Testing Stripe Connection...');
    const account = await stripe.accounts.retrieve();
    console.log(`✅ Connected to Stripe account: ${account.display_name || account.id}\n`);

    // List webhook endpoints
    console.log('🎣 Listing Webhook Endpoints...');
    const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
    
    if (webhooks.data.length === 0) {
      console.log('❌ No webhook endpoints found!');
      console.log('📝 You need to create a webhook endpoint in Stripe Dashboard:');
      console.log('   1. Go to https://dashboard.stripe.com/webhooks');
      console.log('   2. Click "Add endpoint"');
      console.log('   3. Set URL to: https://your-domain.com/api/stripe/webhook');
      console.log('   4. Select events: checkout.session.completed, invoice.payment_succeeded, invoice.payment_failed');
      console.log('   5. Copy the webhook secret to STRIPE_WEBHOOK_SECRET env var\n');
    } else {
      console.log(`✅ Found ${webhooks.data.length} webhook endpoint(s):\n`);
      
      webhooks.data.forEach((webhook, index) => {
        console.log(`📍 Webhook ${index + 1}:`);
        console.log(`   URL: ${webhook.url}`);
        console.log(`   Status: ${webhook.status}`);
        console.log(`   Events: ${webhook.enabled_events.join(', ')}`);
        console.log(`   Created: ${new Date(webhook.created * 1000).toISOString()}`);
        
        // Check if webhook URL matches expected pattern
        const expectedPaths = ['/api/stripe/webhook', '/webhook', '/stripe/webhook'];
        const hasCorrectPath = expectedPaths.some(path => webhook.url.includes(path));
        
        if (hasCorrectPath) {
          console.log('   ✅ URL path looks correct');
        } else {
          console.log('   ⚠️  URL path might be incorrect - should end with /api/stripe/webhook');
        }
        
        // Check required events
        const requiredEvents = [
          'checkout.session.completed',
          'invoice.payment_succeeded',
          'invoice.payment_failed'
        ];
        
        const missingEvents = requiredEvents.filter(event => 
          !webhook.enabled_events.includes(event)
        );
        
        if (missingEvents.length === 0) {
          console.log('   ✅ All required events are enabled');
        } else {
          console.log(`   ⚠️  Missing events: ${missingEvents.join(', ')}`);
        }
        
        console.log('');
      });
    }

    // Test recent events
    console.log('📊 Recent Webhook Events (last 10):');
    const events = await stripe.events.list({ 
      limit: 10,
      types: [
        'checkout.session.completed',
        'invoice.payment_succeeded', 
        'invoice.payment_failed',
        'customer.subscription.created',
        'customer.subscription.updated'
      ]
    });

    if (events.data.length === 0) {
      console.log('❌ No recent relevant events found');
    } else {
      events.data.forEach((event, index) => {
        console.log(`📅 Event ${index + 1}: ${event.type}`);
        console.log(`   ID: ${event.id}`);
        console.log(`   Created: ${new Date(event.created * 1000).toISOString()}`);
        console.log(`   Livemode: ${event.livemode ? 'Production' : 'Test'}`);
        
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          console.log(`   Session ID: ${session.id}`);
          console.log(`   Customer: ${session.customer}`);
          console.log(`   Subscription: ${session.subscription}`);
          console.log(`   Metadata: ${JSON.stringify(session.metadata)}`);
        } else if (event.type === 'invoice.payment_succeeded') {
          const invoice = event.data.object;
          console.log(`   Invoice ID: ${invoice.id}`);
          console.log(`   Customer: ${invoice.customer}`);
          console.log(`   Subscription: ${invoice.subscription}`);
          console.log(`   Amount: ${invoice.amount_paid / 100} ${invoice.currency.toUpperCase()}`);
        }
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error testing webhook configuration:', error.message);
    
    if (error.type === 'StripeAuthenticationError') {
      console.log('🔑 Authentication failed - check your STRIPE_SECRET key');
    } else if (error.type === 'StripeConnectionError') {
      console.log('🌐 Connection failed - check your internet connection');
    }
  }
}

// Helper function to create a test webhook endpoint
async function createTestWebhook(url) {
  try {
    console.log(`🔧 Creating test webhook endpoint for: ${url}`);
    
    const webhook = await stripe.webhookEndpoints.create({
      url: url,
      enabled_events: [
        'checkout.session.completed',
        'invoice.payment_succeeded',
        'invoice.payment_failed',
        'customer.subscription.deleted'
      ]
    });

    console.log('✅ Webhook endpoint created successfully!');
    console.log(`📋 Webhook Secret: ${webhook.secret}`);
    console.log('🔐 Add this to your .env file as STRIPE_WEBHOOK_SECRET');
    
    return webhook;
  } catch (error) {
    console.error('❌ Error creating webhook:', error.message);
    throw error;
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'create' && args[1]) {
    createTestWebhook(args[1])
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    testWebhookConfiguration()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = { testWebhookConfiguration, createTestWebhook };