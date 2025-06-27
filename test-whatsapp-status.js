// Test script to check WhatsApp connection status
import fetch from 'node-fetch';

async function testWhatsAppStatus() {
  try {
    const response = await fetch('http://localhost:5000/api/whatsapp-client/status', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE3NTAxMzEwNDkxNzMiLCJlbWFpbCI6ImRhbmllbG1vcmVpcmFicmFnYUBnbWFpbC5jb20iLCJyb2xlIjoiY2xpZW50IiwiY2xpZW50SWQiOjE3NDk4NDk5ODc1NDMsImlhdCI6MTc1MDcxMTgyNn0.Gkm3oOFR8WI0hU9R2jQS2iBcKfZJSe_iMzgOxQwPcnw',
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('WhatsApp Status Response:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error testing WhatsApp status:', error);
  }
}

testWhatsAppStatus();