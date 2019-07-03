// Script to check v1p2 fixtures for 'profile' property
"use strict"

// Written and tested using Node.js version 10.15.3

// Initializing libraries
const fs = require('fs');

// Setting constants
const V1P2_FIXTURES_PATH = '../../IMSGlobal/caliper-spec/fixtures/v1p2/';

//// Functions

/* Break a string with concatenated capitalized words into tokens */
function tokenize(name) {
  var re = /[A-Z][a-z]+/g;
  return name.match(re);
}

function checkFixtureForProperty(fixtureName) {
  var fixtureText = fs.readFileSync(V1P2_FIXTURES_PATH + fixtureName);
  var fixtureContents = JSON.parse(fixtureText);
  if (Object.keys(fixtureContents).includes('profile')) {
    return true;
  } else {
    return false;
  }
}

//// Main Program

console.log(`Script to check v1p2 fixtures for 'profile' property`);

var fixturesDir = fs.readdirSync(V1P2_FIXTURES_PATH, {'withFileTypes': true});
for (var fixtureDirent of fixturesDir) {
  if (fixtureDirent.isFile()) {
    var nameTokens = tokenize(fixtureDirent.name.replace('caliper', ''));
    if (nameTokens.includes('Event') && nameTokens.includes('Envelope') === false) {
      if (checkFixtureForProperty(fixtureDirent.name) === false) {
        console.log(fixtureDirent.name);
      }
    }
  }
}
