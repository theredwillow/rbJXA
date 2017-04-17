//

// Create a set-up guide

app.includeStandardAdditions = true; // Set app to application name, this allow you to add dialogs to any mac program
app.chooseFromList(['red', 'green', 'blue'], { withPrompt: 'What is your favorite color?' }) // Use this to ask about table headers if necessary

// Get info from spreedsheet

// Open Numbers document (no activate or delay is needed)
var Numbers = Application("Numbers");
var path = Path("/path/to/spreadsheet.numbers");
var doc = Numbers.open(path);
// Access the first table of the first sheet of the document
// Note:
//  .sheets and .tables (lowercase plural) are used when accessing elements
//  .Sheet and .Table (capitalized singular) are used when creating new elements
var sheet = doc.sheets[0];
var table = sheet.tables[0];
// Access the cell named "A1"
var cell = table.cells["A1"];
// Set the cell's value
cell.value = 20;
// Get the cell's value
var cellValue = cell.value();
// Set that value in a different cell
table.cells["B2"].value = cellValue;

// Get records from url
// Check boxes
// Click edit
// Get records from browser
// Fill
// Submit

var se = Application('System Events')
se.keystroke('Hello')
se.keystroke('a', { using: 'command down' }) // Press Cmd-A
se.keystroke(' ', { using: [ 'option down', 'command down' ] }) // Press Opt-Cmd-Space
se.keyCode(36); // Press Enter

var chrome = Application('Google Chrome');
var tab    =  chrome.windows[0].activeTab;
var jscode = 'alert("from applescript")';
chrome.execute(tab, {javascript: jscode});
var url = chrome.windows[0].activeTab.url();

