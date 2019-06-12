// Script to place fixtures in caliper-spec-respec.html
"use strict"

// Written and tested using Node.js version 10.15.3

/* Node.js file system module documentation: https://nodejs.org/api/fs.html */
/* cheerio documentation: https://cheerio.js.org/ */
/* Mozilla regular expression guide:
   https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions */

// Initializing libraries
const fs = require('fs');
const cheerio = require('cheerio');

// Setting constants
const SPEC_PATH = '../../IMSGlobal/caliper-spec/'
const RESPEC_PATH = SPEC_PATH + 'caliper-spec-respec.html';
const FIXTURES_PATH = SPEC_PATH + 'fixtures/v1p2/';
const RE_ID = /id="([^"]+)"/;
const RE_DATA_INCLUDE = /data-include="([^"]+)"/;


// Functions

/* Break a string with concatenated capitalized words into tokens */
function tokenize(name) {
  var re = /[A-Z][a-z]+/g;
  return name.match(re);
}

/* Create a fixture object storing info needed for matching with sections and
   creating figures */
function createFixture(fixturesPath, fixtureName) {
  var fixture = {};
  fixture['path'] = fixturesPath.replace(SPEC_PATH, '') + fixtureName;
  fixture['fileName'] = fixtureName;

  fixture['contents'] = JSON.parse(fs.readFileSync(fixturesPath + fixtureName));
  fixture['type'] = fixture['contents']['type'];
  fixture['id'] = fixture['contents']['id'];
  if (fixture['type'] !== undefined) {
    fixture['typeTokens'] = tokenize(fixture['type']);
    var typesToIgnore = ['TextPositionSelector'];
    if (fixture['typeTokens'][fixture['typeTokens'].length - 1] === 'Event' && fixture['typeTokens'].length > 1) {
      fixture['superType'] = 'Event';
      fixture['relatedAction'] = fixture['contents']['action'];
    } else if (typesToIgnore.includes(fixture['type']) === false) {
      fixture['superType'] = 'Entity';
    }
    if (Object.keys(fixture['contents']).includes('extensions')) {
      fixture['extended'] = true;
    } else {
      fixture['extended'] = false;
    }
  } else {
    fixture['typeTokens'] = null;
    fixture['superType'] = null;
    fixture['type'] = null;
    fixture['Extended'] = null;
  }
  return fixture;
}

/* Parse fragment contents and create object representation of DL */
function parseFragmentDl(fragmentPath) {
  var contents = fs.readFileSync(SPEC_PATH + fragmentPath, 'utf8');
  var $ = cheerio.load(contents, {normalizeWhitespace: true});
  var fragmentDl = {};
  $ = $('dl').children();
  var numTags = $.length;
  $ = $.first();
  value = $.text().replace(/\n  [ ]*/g, ' ').trim();
  fragmentDl[value] = null;
  var pairKey = value;
  for (var i = 2; i < numTags + 1; i++) {
    $ = $.next();
    var value = $.text().replace(/\n  [ ]*/g, ' ').trim()
    if (i % 2 === 0) {
      fragmentDl[pairKey] = value;
    } else {
      fragmentDl[value] = null;
      pairKey = value;
    }
  }
  return fragmentDl;
}

/* Create a section object storing info needed for matching with fixtures and
   section creation */
function createSection(sectionText, type) {
  var section = {};
  section['id'] = sectionText.match(RE_ID)[1];
  section['fragmentPath'] = sectionText.match(RE_DATA_INCLUDE)[1];
  section['type'] = type;
  section['sectionText'] = sectionText;
  section['fragmentDl'] = parseFragmentDl(section['fragmentPath']);
  return section;
}

/* Create string based on fixture object values that will serve as the core of the figure caption
   (only handles Event and Entity fixtures) */
function createFigureCaption(fixture, termIRI) {
//  console.log(fixture['fileName'].replace('caliper', '').replace(fixture['superType'], '').replace(fixture['type'].replace('Event', ''), '').replace(fixture['relatedAction'], ''));
  var baseString = fixture['type'];
  var actionString = '';
  var descriptors = [];
  if (fixture['superType'] === 'Event') {
    actionString = ` (${fixture['relatedAction']})`;
  }
  if (fixture['id'] === termIRI) {
    descriptors.push('Anonymous');
  }
  if (fixture['extended'] === true) {
    descriptors.push('Extended');
  }
  var descriptorsString = ` ${descriptors.join(' ')}`;
  var caption = baseString + descriptorsString + actionString;
  return caption;
}

/* Create figures with data-include attributes and combine with related fragment section */
function createSectionTextWithFigures(oldSection, fixtures) {
  var fixtureFigures = [];
  for (var fixture of fixtures) {
    var caption = createFigureCaption(fixture, oldSection['fragmentDl']['IRI']);
    var fixtureFigure =
    `<figure class="example">
            <figcaption> - ${caption} JSON-LD</figcaption>
            <pre><code data-include="${fixture['path']}"></code></pre>
        </figure>`;
    fixtureFigures.push(fixtureFigure);
  }
  var sectionTextWithFigures = oldSection['sectionText'] + '\n        ' + fixtureFigures.join('\n        ');
  return sectionTextWithFigures;
}


// Main Program
console.log('\n** Script to Place Fixtures in caliper-spec-respec.html **');

// Opening caliper-spec-respec.html
var respec = fs.readFileSync(RESPEC_PATH, 'utf8');

// Creating entity section records
var entitiesRe = /<section id="[^"]+" data-include="fragments\/entities\/caliper-entity-[A-Za-z]+\.html"><\/section>/g;
var respecEntities = respec.match(entitiesRe);
var entitySections = [];
for (var respecEntity of respecEntities) {
  var entitySection = createSection(respecEntity, 'Entity');
  entitySections.push(entitySection);
}

// Removing general Entity section from entitySections
var notGeneralEntity = function (sectionObject) {
  return sectionObject.id !== 'Entity';
}
entitySections = entitySections.filter(notGeneralEntity);

fs.writeFileSync('entity_sections.json', JSON.stringify(entitySections, null, 4));

// Creating event section records
var eventsRe = /<section id="[\w]+Event" data-include="fragments\/events\/caliper-event-[A-Za-z]+\.html"><\/section>/g;
var respecEvents = respec.match(eventsRe);
var eventSections = [];
for (var respecEvent of respecEvents) {
  var eventSection = createSection(respecEvent, 'Event');
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
    if (fixture['superType'] === 'Entity') {
      if (fixture['type'] === entitySection['id']) {
        relatedFixtures.push(fixture);
        placedFixtures.push(fixture['fileName']);
      }
    }
  }
  // console.log(relatedFixtures);
  var entitySectionWithFigures = createSectionTextWithFigures(entitySection, relatedFixtures);
  updatedRespec = updatedRespec.replace(entitySection['sectionText'], entitySectionWithFigures);
}

// Creating new Event sections with embedded fixtures
for (var eventSection of eventSections) {
  // console.log(`** ${eventSection.id} **`);
  let relatedFixtures = [];
  for (let fixture of fixtures) {
    if (fixture['superType'] === 'Event') {
      if (fixture['type'] === eventSection['id']) {
        relatedFixtures.push(fixture);
        placedFixtures.push(fixture['fileName']);
      }
    }
  }
  // console.log(relatedFixtures);
  var eventSectionWithFigures = createSectionTextWithFigures(eventSection, relatedFixtures);
  updatedRespec = updatedRespec.replace(eventSection['sectionText'], eventSectionWithFigures);
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