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


// Fixture Object Creation

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


// Section Object Creation

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


// HTML Figure and Caption Creation

/* Generate a natural language list given a series of strings */
function writeNatLangList(listOfTerms) {
  var natLangList;
  if (listOfTerms.length > 2) {
    natLangList = listOfTerms.slice(0, listOfTerms.length - 1).join(', ') + ' and ' + listOfTerms[listOfTerms.length - 1];
  } else if (listOfTerms.length == 2) {
    natLangList = listOfTerms[0] + ' and ' + listOfTerms[1];
  } else {
    natLangList = listOfTerms[0];
  }
  return natLangList;
}

/* Check to see if values of fixture contain any objects, in assist with identifying thinned entities */
function checkForObjects(contents) {
  var values = Object.values(contents);
  for (var value of values) {
    if (typeof value === 'object') {
      return true;
    }
  }
  return false;
}

/* Fetch a URI from an HTML section record given a type term, to assist with identifying anonymous entities */
function findEntityTypeIRI(entityType) {
  // sections referenced from global scope
  for (var section of sections) {
    var term = section['fragmentDl']['Term'];
    if (term === entityType) {
      var entityTypeIRI = section['fragmentDl']['IRI'];
      return entityTypeIRI;
    }
  }
  return undefined;
}

/* Combines a base string with previously collected adjectives and with modifiers */
function convertDescriptionToString(baseString, adjectives, withModifiers) {
  var stringRep = baseString;
  if (adjectives.length > 0) {
    stringRep += ' ' + writeNatLangList(adjectives);
  }
  if (withModifiers.length > 0) {
    stringRep += ' with ' + writeNatLangList(withModifiers);
  }
  return stringRep;
}

/* Create object (including a string representation) that describes an entity */
function describeEntity(entity) {
  var entityDescriptors = {};
  var adjectives = [];
  var withModifiers = [];

  // Anonymous
  var entityTypeIRI = findEntityTypeIRI(entity['type']);
  if (entity['id'] === entityTypeIRI) {
    adjectives.push('Anonymous');
  }
  // Extended
  if (Object.keys(entity).includes('extensions')) {
    adjectives.push('Extended');
  }
  // ReplyTo
  if (Object.keys(entity).includes('replyTo')) {
    withModifiers.push('ReplyTo');
  }
  // User Agent
  if (Object.keys(entity).includes('userAgent')) {
    withModifiers.push('UserAgent');
  }
  // Client
  if (entity['type'] === 'Session' && Object.keys(entity).includes('client')) {
    withModifiers.push('Client');
  }
  // Scale
  if (entity['type'] === 'Rating') {
    if (Object.keys(entity).includes('question') && Object.keys(entity['question']).includes('scale')) {
      withModifiers.push(entity['question']['scale']['type']);
    }
  }

  var entityString = convertDescriptionToString(entity['type'], adjectives, withModifiers);
  var entityDescription = {
    'entityString': entityString,
    'adjectives': adjectives,
    'withModifiers': withModifiers
  }
  return entityDescription;
}

/* Create string representing an action associated with an event, including (if relevant) an action's object and
   other descriptors */
function describeAction(event, includeObject) {
  var actionString = event['action'];;
  var objectString;
  if (includeObject) {
    if (typeof event['object'] === 'object') {
      if (event['type'] === 'GradeEvent') {
        // Treat the entity value of the assignable property as the action's object
        var objectString = describeEntity(event['object']['assignable'])['entityString'];
      } else if (event['type'] === 'QuestionnaireItemEvent') {
        // Treat the entity value of the question property as the action's object
        var objectString = describeEntity(event['object']['question'])['entityString'];
      } else {
        // Treat the entity value of the object property as the action's object
        var objectString = describeEntity(event['object'])['entityString'];
      }
    }
    if (objectString !== undefined) {
      actionString += ' ' + objectString;
    }
  }

  // Used WithProgress
  if (event['type'] === 'ToolUseEvent' && Object.keys(event).includes('generated')) {
    actionString += ' with Progress';
  }
  return actionString
}

/* Identifies actions shared by  multiple fixtures for an event subtype */
function findRepeatedActions(eventFixtures) {
  var inventory = {}
  for (var eventFixture of eventFixtures) {
    var action = eventFixture['contents']['action'];
    if (Object.keys(inventory).includes(action) === false) {
      inventory[action] = 0;
    } else {
      inventory[action] += 1;
    }
  }
  var repeatedActions = [];
  for (var key of Object.keys(inventory)) {
    if (inventory[key] > 0) {
      repeatedActions.push(key);
    }
  }
  return repeatedActions;
}

/* Create object (including a string representation) that describes an event */
function describeEvent(event, relatedFixtures) {
  var eventType = event['type'];

  var adjectives = [];
  var withModifiers = [];

  // Thinned
  if (checkForObjects(event) === false) {
    adjectives.push('Thinned');
  }
  // Extended
  if (Object.keys(event).includes('extensions')) {
    adjectives.push('Extended');
  }
  // With FederatedSession
  if (Object.keys(event).includes('federatedSession')) {
    withModifiers.push('FederatedSession');
  }

  // Action
  var repeatedActions = findRepeatedActions(relatedFixtures);
  if (repeatedActions.includes(event['action'])) {
    var includeObject = true;
  } else {
    var includeObject = false;
  }

  var actionString = describeAction(event, includeObject)

  // Irregular entities (excluding object and extensions)
  for (var key of Object.keys(event)) {
    let value = event[key];
    if ((['object', 'extensions'].includes(key) === false) && typeof value == 'object') {
      var entityDescription = describeEntity(value);
      if (entityDescription['adjectives'].length > 0 || entityDescription['withModifiers'].length > 0) {
        withModifiers.push(entityDescription['entityString']);
      }
    }
  }

  var eventPlusAction = eventType + ` (${actionString})`;
  var eventString = convertDescriptionToString(eventPlusAction, adjectives, withModifiers);

  var eventDescription = {
    'eventString': eventString,
    'adjectives': adjectives,
    'withModifiers': withModifiers
  }
  return eventDescription;
}

/* Create figures with data-include attributes and combine with related fragment section */
function createSectionTextWithFigures(oldSection, relatedFixtures) {
  var fixtureFigures = [];

  for (var fixture of relatedFixtures) {
    var caption;
    if (fixture['superType'] === 'Entity') {
      caption = describeEntity(fixture['contents'])['entityString'];
    } else if (fixture['superType'] === 'Event') {
      caption = describeEvent(fixture['contents'], relatedFixtures)['eventString'];
    }
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

console.log('\n** Script to place fixtures in caliper-spec-respec.html **');

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
var sectionIdsToIgnore = ['Event', 'Entity', 'LearningObjective'];
var fixturesToIgnore = [
  'caliperEntityLearningObjective.json', // temporary fix
  'caliperEventMessagePostedInlineContext.json' // placed manually under Serialization
];

var placedFixtures = [];
var updatedRespec = respec;

for (var section of sections) {
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