const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

const attrs = [
  { name: 'commonName', value: 'localhost' },
  { name: 'countryName', value: 'TR' },
  { name: 'organizationName', value: 'CatuPet Dev' },
  { name: 'organizationalUnitName', value: 'Development' }
];

const pems = selfsigned.generate(attrs, {
  keySize: 2048,
  days: 365,
  algorithm: 'sha256'
});

fs.writeFileSync(path.join(__dirname, 'server.key'), pems.private);
fs.writeFileSync(path.join(__dirname, 'server.crt'), pems.cert);
