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

//// Functions

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
  if (fixture['contents']['type'] !== undefined) {
    var typeTokens = tokenize(fixture['contents']['type']);
    var typesToIgnore = ['TextPositionSelector'];
    if (typeTokens[typeTokens.length - 1] === 'Event' && typeTokens.length > 1) {
      fixture['superType'] = 'Event';
    } else if (typesToIgnore.includes(fixture['contents']['type']) === false) {
      fixture['superType'] = 'Entity';
    }
  } else {
    fixture['superType'] = null;
  }
  return fixture;
}

/* Parse fragment contents and create object representation of DL */
function parseFragmentDl(fragmentPath) {
  var contents = fs.readFileSync(SPEC_PATH + fragmentPath, 'utf8');
  var $ = cheerio.load(contents);
  var fragmentDl = {};
  var children = $('dl').children();
  var numTags = children.length;
  var child = children.first();
  var value = child.text().replace(/\n  [ ]*/g, ' ').trim();
  fragmentDl[value] = null;
  var pairKey = value;
  for (var i = 2; i < numTags + 1; i++) {
    child = child.next();
    value = child.text().replace(/\n  [ ]*/g, ' ').trim()
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
function createSection(sectionText) {
  var $ = cheerio.load(sectionText);
  var section = {};
  section['sectionText'] = sectionText;
  section['id'] = $('section').attr('id');
  section['fragmentPath'] = $('section').attr('data-include');
  section['fragmentDl'] = parseFragmentDl(section['fragmentPath']);
  return section;
}

/* Checks to see if values of fixture contain any objects */
function checkForObjects(contents) {
  var values = Object.values(contents);
  for (var value of values) {
    if (typeof value === 'object') {
      return true;
    }
  }
  return false;
}

/* Create string based on fixture object values that will serve as the core of the figure caption
   (only handles Event and Entity fixtures) */
function createFigureCaption(fixture, termIRI) {
  var caption = fixture['contents']['type'];

  // Descriptors
  var descriptors = [];
  // Anonymous
  if (fixture['contents']['id'] === termIRI) {
    descriptors.push('Anonymous');
  }
  // Extended
  if (Object.keys(fixture['contents']).includes('extensions')) {
    descriptors.push('Extended');
  }
  // Thinned
  if (fixture['superType'] === 'Event' && checkForObjects(fixture['contents']) === false) {
    descriptors.push('Thinned');
  }

  // With User Agent
  if (Object.keys(fixture['contents']).includes('userAgent')) {
    descriptors.push('with UserAgent');
  }
  // With Client
  if (fixture['contents']['type'] === 'SessionEvent' && Object.keys(fixture['contents']).includes('session')) {
    if (Object.keys(fixture['contents']['session']).includes('client')) {
      descriptors.push('with Client');
    }
  }
  // With FederatedSession
  if (Object.keys(fixture['contents']).includes('federatedSession')) {
    descriptors.push('with FederatedSession');
  }
  if (descriptors.length > 0) {
    caption += ' ' + descriptors.join(' ');
  }

  // Action
  if (fixture['superType'] === 'Event') {
    var action = fixture['contents']['action'];
    var actionString = action;
    if (['Paused', 'NavigatedTo', 'Graded'].includes(action) && typeof fixture['contents']['object'] === 'object') {
      if (action === 'Graded') {
        var object = fixture['contents']['object']['assignable']['type'];
      } else {
        var object = fixture['contents']['object']['type'];
      }
    }
    if (object !== undefined) {
      actionString += ' ' + object;
    }

    // ReplyTo
    if (fixture['contents']['type'] === 'MessageEvent' && Object.keys(fixture['contents']['object']).includes('replyTo')) {
      actionString += ' Reply To';
    }
    // Used WithProgress
    if (fixture['contents']['type'] === 'ToolUseEvent' && Object.keys(fixture['contents']).includes('generated')) {
      actionString += ' with Progress';
    }
    actionString = `(${actionString})`;
    caption += ' ' + actionString;
  }
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

//// Main Program
console.log('\n** Script to Place Fixtures in caliper-spec-respec.html **');

// Opening caliper-spec-respec.html
var respec = fs.readFileSync(RESPEC_PATH, 'utf8');

// Creating section records
var plurals = ['events', 'entities'];
var singulars = ['event', 'entity'];

var reString = `<section id="[^"]+" data-include="fragments\/(${plurals.join('|')})\/caliper-(${singulars.join('|')})-[A-Za-z]+\.html"><\/section>`
var sectionRe = RegExp(reString, 'g');
var sectionMatches = respec.match(sectionRe);

var sections = [];
for (var sectionMatch of sectionMatches) {
  var section = createSection(sectionMatch);
  sections.push(section);
}
fs.writeFileSync('sections.json', JSON.stringify(sections, null, 2));

// Creating fixture records
var fixturesDir = fs.readdirSync(FIXTURES_PATH, {'withFileTypes': true});
var fixtures = [];
for (var fixtureDirent of fixturesDir) {
  if (fixtureDirent.isFile()) {
    fixtures.push(createFixture(FIXTURES_PATH, fixtureDirent.name));
  }
}
fs.writeFileSync('fixtures.json', JSON.stringify(fixtures, null, 4));

// Creating new version of respec with embedded fixtures
var sectionIdsToIgnore = ['Event', 'Entity'];
var fixturesToIgnore = ['caliperEntityLearningObjective.json']; // temporary fix

var placedFixtures = [];
var updatedRespec = respec;

for (var section of sections) {
//  console.log(`** ${section['id']} **`);
  if (sectionIdsToIgnore.includes(section['id']) === false) {
    let relatedFixtures = [];
    for (let fixture of fixtures) {
      if (fixturesToIgnore.includes(fixture['fileName']) === false) {
        if (fixture['contents']['type'] === section['id']) {
          relatedFixtures.push(fixture);
          placedFixtures.push(fixture['fileName']);
        }
      }
    }
//    console.log(relatedFixtures);
    var sectionWithFigures = createSectionTextWithFigures(section, relatedFixtures);
    updatedRespec = updatedRespec.replace(section['sectionText'], sectionWithFigures);
  }
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