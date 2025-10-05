// Quick test to see what error Google is returning
require('dotenv').config();
const fetch = require('node-fetch');

const PLACE_ID = 'ChIJFTDuy1sLzYkRcm9Q6geBtqo';
const API_KEY = process.env.GOOGLE_API_KEY;

console.log('Testing Google Places API...');
console.log('API Key:', API_KEY ? 'Found' : 'Missing');

const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=name,rating,user_ratings_total,reviews&key=${API_KEY}`;

fetch(url)
    .then(res => res.json())
    .then(data => {
        console.log('\n=== RESPONSE FROM GOOGLE ===');
        console.log('Status:', data.status);
        if (data.error_message) {
            console.log('Error Message:', data.error_message);
        }
        if (data.result) {
            console.log('Success! Reviews found:', data.result.reviews ? data.result.reviews.length : 0);
            console.log('Rating:', data.result.rating);
        }
        console.log('\nFull response:', JSON.stringify(data, null, 2));
    })
    .catch(error => {
        console.error('Fetch error:', error);
    });
