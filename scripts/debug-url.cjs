const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const url = process.env.DATABASE_URL ?? '';
console.log('Longitud:', url.length);
console.log('Primeros 30 chars:', JSON.stringify(url.slice(0, 30)));
const firstChar = url.charCodeAt(0);
console.log('Primer char code:', firstChar, '(esperado 112 para "p")');
