// Script to place fixtures in caliper-spec-respec.html
// Written and tested using Node.js version 10.15.3
"use strict"

// Mozilla regular expression guide: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions

// Initializing libraries
var fs = require('fs');

// Setting constants
const RESPEC_PATH = 'repos/caliper-spec-copy/caliper-spec-respec.html';
const RE_ID = /id="([^"]+)"/;
const RE_DATA_INCLUDE = /data-include="([^"]+)"/;

// Functions

// Break a string with concatenated capitalized words into tokens
function tokenize(name) {
  var re = /[A-Z][a-z]+/g;
  return name.match(re);
}

// Create a fixture object storing info needed for matching with fixtures and section creation
function createFixture(fixturesPath, fixtureName) {
  var re = /[A-Z][a-z]+/g;
  var fixtureTokens = tokenize(fixtureName.replace('caliper', ''));
  var fixture = {};
  fixture['path'] = fixturesPath + fixtureName;
  fixture['fileName'] = fixtureName;
  fixture['tokens'] = fixtureTokens;
  fixture['type'] = fixtureTokens[0];
  fixture['shortName'] = fixtureTokens.slice(1).join('');

  // Determining base names
  var irregularEndings = ['Sent', 'Anonymous', 'User'];
  var nounEndings = ['ion', 'nse'];
  if (fixture['type'] !== 'Envelope') {
    var baseTokens = [];
    var accum = 0;
    for (var token of fixture['tokens']) {
      var nextToken = fixture['tokens'][accum + 1]
      if (token.slice(-2,) === 'ed') {
        if (nextToken === undefined) {
          break;
        } else if (nounEndings.includes(nextToken.slice(-3,)) === false) {
          break;
        } else {
          baseTokens.push(token);
          accum += 1;
        }
      } else if (irregularEndings.includes(token)) {
        break;
      } else {
        baseTokens.push(token);
        accum += 1;
      }
    }
    fixture['baseName'] = baseTokens.join('').replace('Event', '').replace('Entity', '');
  }
  return fixture;
}

// Create a fragment object storing info needed for matching with fixtures and section creation
function createFragment(sectionText, type) {
  var fragment = {};
  fragment['id'] = sectionText.match(RE_ID)[1]
  fragment['path'] = sectionText.match(RE_DATA_INCLUDE)[1];
  fragment['type'] = type;
  fragment['sectionText'] = sectionText;
  return fragment;
}

// Create new HTML section with data-include attributes for the fragment and fixture(s)
function createNewSection(fragment, fixtures) {
  var fixtureSections = [];
  for (var fixture of fixtures) {
    var fixtureSection =
           `<section class="notoc">
                <h4>Example: ${fixture['shortName']}</h4>
                <pre><code data-include="${fixture['path'].replace('repos', '..')}"></code></pre>
            </section>`;
    fixtureSections.push(fixtureSection);
  }
  var newSection =
       `<section id="${fragment['id']}">
            <h3>${fragment['id']}</h3>
            <div data-include="${fragment['path']}"></div>
            ${fixtureSections.join('\n            ')}
        </section>`;
  return newSection;
}

// Remove header tags and white space from beginning of a HTML fragment (not currently used)
function removeFragmentHeader(fragmentPath) {
  var fragment = fs.readFileSync(fragmentPath, 'utf8');
  var re = /<h[34]>[A-Z][a-z]+<\/h[34]>[\s]+/g;
  fragment = fragment.replace(re, '')
  fs.writeFileSync(fragmentPath.replace('.html', '_test.html'), fragment)
}

// Main Program
console.log('\n** Script to Place Fixtures in caliper-spec-respec.html **')

// Opening caliper-spec-respec.html
var respec = fs.readFileSync(RESPEC_PATH, 'utf8');

// Creating entity fragment records
var entitiesRe = /<section id="[^"]+" data-include="fragments\/entities\/caliper-entity-[a-z]+\.html"><\/section>/g;
var respecEntities = respec.match(entitiesRe);
var entityFragments = [];
var entityFragmentIds = [];
for (var respecEntity of respecEntities) {
  entityFragment = createFragment(respecEntity, 'Entity');
  entityFragments.push(entityFragment);
  entityFragmentIds.push(entityFragment['id']);
}
fs.writeFileSync('entity_fragments.json', JSON.stringify(entityFragments, null, 4));

// Creating event fragment records
var eventsRe = /<section id="[\w]+Event" data-include="fragments\/events\/caliper-event-[a-z]+\.html"><\/section>/g;
var respecEvents = respec.match(eventsRe);
var eventFragments = []
var eventFragmentIds = [];
for (var respecEvent of respecEvents) {
  eventFragment = createFragment(respecEvent, 'Event');
  eventFragments.push(eventFragment);
  eventFragmentIds.push(eventFragment['id'].replace('Event', ''))
}
fs.writeFileSync('event_fragments.json', JSON.stringify(eventFragments, null, 4));

// Creating fixture records
var fixturesPath = 'repos/caliper-common-fixtures/v1p2/';
var fixturesDir = fs.readdirSync(fixturesPath);
var fixtures = [];
for (var fixtureName of fixturesDir) {
  fixtures.push(createFixture(fixturesPath, fixtureName));
}
fs.writeFileSync('fixtures.json', JSON.stringify(fixtures, null, 4));

// Setting up new version of respec
var updatedRespec = respec;
var placedFixtures = [];

// Creating new Entity sections with embedded fixtures
for (var entityFragment of entityFragments.slice(1,)) {
  // console.log(`** ${entityFragment.id} **`);
  let relatedFixtures = [];
  for (let fixture of fixtures) {
    if (fixture['type'] === 'Entity') {
      if (fixture['baseName'] === entityFragment['id']) {
        relatedFixtures.push(fixture);
        placedFixtures.push(fixture['fileName']);
      }
    }
  }
  // console.log(relatedFixtures);
  var newEntitySection = createNewSection(entityFragment, relatedFixtures);
  updatedRespec = updatedRespec.replace(entityFragment.sectionText, newEntitySection);
}

// Creating new Event sections with embedded fixtures
for (var eventFragment of eventFragments) {
  // console.log(`** ${eventFragment.id} **`);
  var simpleEventFragmentId = eventFragment.id.replace('Event', '');
  let relatedFixtures = [];
  for (let fixture of fixtures) {
    if (fixture['type'] === 'Event') {
      if (fixture['baseName'] == simpleEventFragmentId) {
        relatedFixtures.push(fixture);
        placedFixtures.push(fixture['fileName']);
      }
    }
  }
  // console.log(relatedFixtures);
  var newEventSection = createNewSection(eventFragment, relatedFixtures);
  updatedRespec = updatedRespec.replace(eventFragment['sectionText'], newEventSection);
}

// Reporting placed fixtures
console.log('\n** Placed Fixtures **');
console.log(`${placedFixtures.length} of ${fixtures.length} Fixtures Placed`)

// Identifying fixtures not placed
var unplacedFixtures = [];
for (var fixture of fixtures) {
  if (placedFixtures.includes(fixture['fileName']) === false) {
    unplacedFixtures.push(fixture['fileName'])
  }
}
console.log('\n** Unplaced fixtures **')
for (var unplacedFixture of unplacedFixtures) {
  console.log(unplacedFixture);
}

// Writing content in updatedRespec to new file
fs.writeFileSync(RESPEC_PATH.replace('.html', '_updated.html'), updatedRespec, 'utf8');
