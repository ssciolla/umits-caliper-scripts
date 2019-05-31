// Script to place fixtures in caliper-spec-respec.html
"use strict"

// Written and tested using Node.js version 10.15.3

/* Node.js file system module documentations: https://nodejs.org/api/fs.html */
/* Mozilla regular expression guide:
   https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions */


// Initializing libraries
var fs = require('fs');

// Setting constants
const RESPEC_PATH = '../caliper-spec-copy/caliper-spec-respec.html';
const FIXTURES_PATH = '../caliper-common-fixtures/v1p2/';
const RE_ID = /id="([^"]+)"/;
const RE_DATA_INCLUDE = /data-include="([^"]+)"/;


// Functions

/* Break a string with concatenated capitalized words into tokens */
function tokenize(name) {
  var re = /[A-Z][a-z]+/g;
  return name.match(re);
}

/* Create a fixture object storing info needed for matching with sections and
   creating new sections */
function createFixture(fixturesPath, fixtureName) {
  var re = /[A-Z][a-z]+/g;
  var fixtureTokens = tokenize(fixtureName.replace('caliper', ''));
  var fixture = {};
  fixture['path'] = fixturesPath + fixtureName;
  fixture['fileName'] = fixtureName;
  fixture['tokens'] = fixtureTokens;
  fixture['type'] = fixtureTokens[0];
  fixture['shortName'] = fixtureTokens.slice(1,).join('');

  // Determining base names
  var irregularEndings = ['Sent', 'Anonymous', 'User'];
  var nounEndings = ['ion', 'nse'];
  if (fixture['type'] !== 'Envelope') {
    var baseTokens = [];
    var accum = 1;
    for (var token of fixture['tokens'].slice(1,)) {
      var nextToken = fixture['tokens'][accum + 1];
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
    fixture['baseName'] = baseTokens.join('');
  } else {
    fixture['baseName'] = null;
  }
  return fixture;
}

/* Create a section object storing info needed for matching with fixtures and
   section creation */
function createSection(sectionText, type) {
  var section = {};
  section['id'] = sectionText.match(RE_ID)[1];
  section['fragmentPath'] = sectionText.match(RE_DATA_INCLUDE)[1];
  section['type'] = type;
  section['sectionText'] = sectionText;
  return section;
}

/* Create new HTML section with data-include attributes for the fragment and
   fixture(s) */
function createNewSectionText(oldSection, fixtures) {
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
       `<section id="${oldSection['id']}">
            <h3>${oldSection['id']}</h3>
            <div data-include="${oldSection['fragmentPath']}"></div>
            ${fixtureSections.join('\n            ')}
        </section>`;
  return newSection;
}

/* Remove header tags and white space from beginning of a HTML fragment
   (not currently used) */
function removeFragmentHeader(fragmentPath) {
  var fragment = fs.readFileSync(fragmentPath, 'utf8');
  var re = /<h[34]>[A-Z][a-z]+<\/h[34]>[\s]+/g;
  fragment = fragment.replace(re, '');
  fs.writeFileSync(fragmentPath.replace('.html', '_test.html'), fragment);
}


// Main Program
console.log('\n** Script to Place Fixtures in caliper-spec-respec.html **');

// Opening caliper-spec-respec.html
var respec = fs.readFileSync(RESPEC_PATH, 'utf8');

// Creating entity section records
var entitiesRe = /<section id="[^"]+" data-include="fragments\/entities\/caliper-entity-[a-z]+\.html"><\/section>/g;
var respecEntities = respec.match(entitiesRe);
var entitySections = [];
for (var respecEntity of respecEntities) {
  entitySection = createSection(respecEntity, 'Entity');
  entitySections.push(entitySection);
}
fs.writeFileSync('entity_sections.json', JSON.stringify(entitySections, null, 4));

// Removing general Entity section from entitySections
var notGeneralEntity = function (sectionObject) {
  return sectionObject.id !== 'Entity';
}
entitySections = entitySections.filter(notGeneralEntity);

// Creating event section records
var eventsRe = /<section id="[\w]+Event" data-include="fragments\/events\/caliper-event-[a-z]+\.html"><\/section>/g;
var respecEvents = respec.match(eventsRe);
var eventSections = [];
for (var respecEvent of respecEvents) {
  eventSection = createSection(respecEvent, 'Event');
  eventSections.push(eventSection);
}
fs.writeFileSync('event_sections.json', JSON.stringify(eventSections, null, 4));

// Creating fixture records
var fixturesDir = fs.readdirSync(FIXTURES_PATH, {'withFileTypes': true});
var fixtures = [];
for (var fixtureDirent of fixturesDir) {
  if (fixtureDirent.isFile()) {
    fixtures.push(createFixture(FIXTURES_PATH, fixtureDirent.name));
  }
}
fs.writeFileSync('fixtures.json', JSON.stringify(fixtures, null, 4));

// Setting up new version of respec
var updatedRespec = respec;
var placedFixtures = [];

// Creating new Entity sections with embedded fixtures
for (var entitySection of entitySections) {
  // console.log(`** ${entitySection.id} **`);
  let relatedFixtures = [];
  for (let fixture of fixtures) {
    if (fixture['type'] === 'Entity') {
      if (fixture['baseName'] === entitySection['id']) {
        relatedFixtures.push(fixture);
        placedFixtures.push(fixture['fileName']);
      }
    }
  }
  // console.log(relatedFixtures);
  var newEntitySection = createNewSectionText(entitySection, relatedFixtures);
  updatedRespec = updatedRespec.replace(entitySection['sectionText'], newEntitySection);
}

// Creating new Event sections with embedded fixtures
for (var eventSection of eventSections) {
  // console.log(`** ${eventSection.id} **`);
  var simpleEventSectionId = eventSection['id'].replace('Event', '');
  let relatedFixtures = [];
  for (let fixture of fixtures) {
    if (fixture['type'] === 'Event') {
      if (fixture['baseName'] === simpleEventSectionId) {
        relatedFixtures.push(fixture);
        placedFixtures.push(fixture['fileName']);
      }
    }
  }
  // console.log(relatedFixtures);
  var newEventSection = createNewSectionText(eventSection, relatedFixtures);
  updatedRespec = updatedRespec.replace(eventSection['sectionText'], newEventSection);
}

// Writing content in updatedRespec to new file
fs.writeFileSync(RESPEC_PATH.replace('.html', '_updated.html'), updatedRespec, 'utf8');

// Reporting placed fixtures
console.log('\n** Placed Fixtures **');
console.log(`${placedFixtures.length} of ${fixtures.length} Fixtures Placed`);

// Identifying fixtures not placed
var unplacedFixtures = [];
for (let fixture of fixtures) {
  if (placedFixtures.includes(fixture['fileName']) === false) {
    unplacedFixtures.push(fixture['fileName']);
  }
}
console.log('\n** Unplaced fixtures **')
for (var unplacedFixture of unplacedFixtures) {
  console.log(unplacedFixture);
}
