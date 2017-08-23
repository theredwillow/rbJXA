// STARLORD HELPER


function openTab(tabNamed) {
	chrome.activate();
	delay(0.05);  // Keep this to keep the return function from bringing focus to script editor
	chrome.windows[tabNamed.windowIndex].activeTabIndex.set(tabNamed.tabIndex);
}

function press(button, anchor) {
	// Mac keyCode's here: http://web.archive.org/web/20100501161453/http://www.classicteck.com/rbarticles/mackeyboard.php
	anchor = anchor || "q";
	switch (button) {
		case "tab": system.keyCode(48); break;
		case "space": system.keyCode(49); break;
		case "return": system.keyCode(36); break;
		case "home cmd": system.keyCode( 115, {using: "command down"} ); break;
		case "all copy": system.keystroke( "ac", {using: "command down"} ); break;
		case "all": system.keystroke( "a", {using: "command down"} ); break;
		case "anchor": system.keystroke( anchor, { using: ["shift down", "control down", "option down"] } ); break;
		default: system.keystroke( button );
	}
	delay(0.01);
}

var deleteAccesskeys = `( function () {
	var inputsFound = document.querySelectorAll('input,select,button');
	var numOfInputsFound = inputsFound.length;
	for(var w = 0; w < numOfInputsFound; w++) {
		inputsFound[w].removeAttribute("accesskey");
	}
})();`;

function placeAccessKey(elemString, letterString) {
	letterString = letterString || "q";
	if ( /recordRows/.test(elemString) ) {
	    var includeString = `var recordRows = document.body.querySelectorAll(".normalTxt>tbody>tr");`;
	}
	else {
		var includeString = "";
	}
	var placeAccessKey = `( function () {` +
		includeString +
		elemString + `.accessKey = "` + letterString + `";
	})();`;
	chrome.execute(starLord.tab, { javascript: placeAccessKey });
}

function applyActionToListing(indexNumber, actionToDo) {
	openTab(starLord);
	chrome.execute(starLord.tab, { javascript: deleteAccesskeys });
	placeAccessKey(`recordRows[` + indexNumber + `].querySelector('select')`);
	press("anchor", "q");
	press( actionToDo.charAt(0) );
	waitForLoading( (actionToDo == "Set as source") );
}

function throwError(message){
	chrome.setTheClipboardTo( originalCB );
	throw new Error(message);
}

function toRBDate(stringProvided) {
	if(!/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/g.test(stringProvided) && /\d/g.test(stringProvided)){
		throwError("I\'m sorry, but I need dates in xx/xx/xxxx format.");
	}
    var date = new Date( stringProvided );
    var now = new Date();
    if( date == "Invalid Date" || date < now ){ date = now; }
    if( now.getFullYear() - date.getFullYear() > 1 ) { date.setFullYear( now.getFullYear() ); }
    var dateOfMonth = date.getMonth() + 1;
    if (dateOfMonth < 10) { dateOfMonth = "0" + dateOfMonth; }
    var numOfDate = date.getDate();
    if (numOfDate < 10) { numOfDate = "0" + numOfDate; }
    return dateOfMonth + "/" + numOfDate + "/" + date.getFullYear();
}

var fromRBDate = `function fromRBDate(dateProvided) {
    var year = Number( dateProvided.substr(0, 4) );
    var month = Number( dateProvided.substr(5, 2) ) - 1;
    var day = Number( dateProvided.substr(8, 2) );
    if ( dateProvided.substr(12, 1) == ":" ) {
    	dateProvided = dateProvided.slice(0, 11) + "0" + dateProvided.slice(11, dateProvided.length);
    }
    hours = Number( dateProvided.substr(11, 2) );
    if ( dateProvided.substr(16, 2) == "PM" ) {
    	hours += 12;
      if ( hours == 24 ) {
      	hours = 0;
      }
    }
    var minutes = Number( dateProvided.substr(14, 2) );
	return new Date(year, month, day, hours, minutes);
}`;

function waitForLoading(pause) {
	if ( pause ) {
		if ( typeof pause === 'object' ) {
			chrome.execute(starLord.tab, { javascript: `(function () { ` + pause.elem + `.innerText = "` + pause.text + `"; })();` });
		}
		while ( ! chrome.execute(starLord.tab, { javascript: "Boolean( document.body.querySelector('.mediumText') );" }) ) {
			delay(0.1);
		}
	}
	while ( chrome.execute(starLord.tab, { javascript: "Boolean( document.body.querySelector('.mediumText') );" }) ) {
		delay(0.5);
	}
}

function loopThruOldRows(funcStringToExec, otherFuncs) {
	// When calling loopThruOldRows(), use recordRows[i] and/or recordCells[cIndex.key] in the string
	otherFuncs = otherFuncs || {};
	otherFuncs.beforecIndex = otherFuncs.beforecIndex || "";
	otherFuncs.beforeRows = otherFuncs.beforeRows || "";
	otherFuncs.afterRows = otherFuncs.afterRows || "";
	return `(function () {
		var recordRows = document.body.querySelectorAll(".normalTxt>tbody>tr");
		` + otherFuncs.beforecIndex + `
		if ( typeof cIndex === 'undefined' ) {
			var headerCells = recordRows[0].querySelectorAll('td');
			window.cIndex = {};
			cIndex.checkbox = 0;
			cIndex.action = headerCells.length - 1;  // THIS DOESN'T WORK WHEN #PICS IS ADDED
			for (var i = 1; i < cIndex.action; i++) {
				switch( headerCells[i].innerText ) {
					case "Apt #": cIndex.unit = i; break;
					case "#Bdrm": cIndex.bed = i; break;
					case "Rent": cIndex.rent = i; break;
					case "Sq. Footage": cIndex.sqft = i; break;
					case "#Bthrms": cIndex.bath = i; break;
					case "Date Available": cIndex.date = i; break;
					case "Last Updated": cIndex.updated = i; break;
					case "Status": cIndex.status = i; break;
					case "Origin Source": cIndex.origin = i; break;
					case "Star Lord": cIndex.starlord = i; break;
					case "Owner": cIndex.owner = i; break;
				}
			}
		}
		` + otherFuncs.beforeRows + `
		var numOfRows = recordRows.length;
		for (var i = 1; i < numOfRows; i++) {
			var recordCells = recordRows[i].querySelectorAll('td');
			` + funcStringToExec + `
		}
		` + otherFuncs.afterRows + `
	})(); `;
}

function loopThruOldCells(funcStringToExec, otherFuncs) {
	// When calling loopThruOldCells(), use recordCells[j] in the string
	otherFuncs = otherFuncs || {};
	otherFuncs.beforeCells = otherFuncs.beforeCells || "";
	otherFuncs.afterCells = otherFuncs.afterCells || "";
	return loopThruOldRows( otherFuncs.beforeCells + `
		var numOfrecordCells = recordCells.length;
		for (var j = 0; j < numOfrecordCells; j++) {
			` + funcStringToExec +
		`}`
		+ otherFuncs.afterCells, otherFuncs);
}

function applyBulkAction(actionToDo) {
	openTab(starLord);
    // chrome.execute(starLord.tab, { javascript: deleteAccesskeys });
    var placeAccessKey = `( function () {
        window.massActionSelect = document.querySelector('.listHolder select');
        massActionSelect.accessKey = "q";
    })();`;
    chrome.execute(starLord.tab, { javascript: placeAccessKey });  // Don't replace with function, this allow script below to get info
    press("anchor", "q");
    switch (actionToDo) {
        case "copy":
            press("c");
            break;
        case "batch":
            press("b");
            break;
        case "active":
        case "rented":
            press("m");
            var checkOption = `( function () { return massActionSelect.options[ massActionSelect.selectedIndex ].text;  })();`;
            var optionSelected = chrome.execute(starLord.tab, { javascript: checkOption });
            if( !optionSelected.includes(actionToDo) ) { press("m"); }
            break;
    }
    if ( actionToDo != "batch" ) {
        press("tab");
        press("space");
    }
    if ( actionToDo == "active" || actionToDo == "rented" ) {
    	delay(0.2);
    	chrome.execute(starLord.tab, { javascript: ` document.querySelector("div.a_popupAnchor button").click(); ` });
    }
    waitForLoading();
}

function selectAll(selectOrUnselect) {
	// Argument should be null or "!"
	openTab(starLord);
	selectOrUnselect = selectOrUnselect || "";
	var firstClick = `
		var button = document.querySelector("div.left > a");
		button.click();
	`;
	var jsFuncToDo = `
		if ( ` + selectOrUnselect + ` recordCells[cIndex.checkbox].querySelector('input').checked ) {
			button.click();
			break;
		}
	`;
	chrome.execute(starLord.tab, { javascript: loopThruOldRows(jsFuncToDo, { beforecIndex: firstClick}) });
}

function selectAllButSevenInfo(doNotIncludePictures) {
	doNotIncludePictures = doNotIncludePictures || false;
	chrome.execute(starLord.tab, { javascript: `(function () { document.body.querySelector("div.a_popupAnchor button").click(); })();` });
	chrome.execute(starLord.tab, { javascript: `(function () { document.body.querySelector("div.a_popupAnchor div.smallTxt > span.link").click(); })();` });
	chrome.execute(starLord.tab, { javascript: `(function () { document.body.querySelectorAll("div.a_popupAnchor div.arrowRight")[2].click(); })();` });
	for (var i = 4; i < 11; i++) {
		chrome.execute(starLord.tab, { javascript: deleteAccesskeys });
		placeAccessKey(`document.body.querySelectorAll("div.a_popupAnchor input")[` + i + `]`);
		press("anchor", "q");
	}
	if ( doNotIncludePictures ) {
		chrome.execute(starLord.tab, { javascript: deleteAccesskeys });
		placeAccessKey(`document.body.querySelectorAll("div.a_popupAnchor input")[23]`);
		press("anchor", "q");
	}
	chrome.execute(starLord.tab, { javascript: `(function () {
		document.body.querySelector("div.a_popupAnchor button").click();
		document.body.querySelector("div.a_popupAnchor button").click();
	})();` });
	waitForLoading();
}

function getSource() {
	openTab(starLord);
	var jsFuncToDo = ` if ( /source/i.test(recordCells[cIndex.starlord].innerText) ) { return i; } `;
	return chrome.execute(starLord.tab, { javascript: loopThruOldRows( jsFuncToDo ) });
}

// -------------------------------------------------

var chrome = Application('Google Chrome');
var system = Application('System Events');
chrome.includeStandardAdditions = true;
var originalCB = chrome.theClipboard();

var windows = chrome.windows;
var numOfWindows = windows.length;
for (var w = 0; w < numOfWindows; w++) {
	var thisWindow = chrome.windows[w];
	var tabs = thisWindow.tabs;
	var numOfTabs = tabs.length;
	for (var t = 0; t < numOfTabs; t++) {
		var thisTab = tabs[t];
		if ( thisTab.title() == "Star Lord" ) {
			var starLord = {
				'tab': thisTab,
				'window': thisWindow,
				'windowIndex': w,
				'tabIndex': t + 1
			};
		}
		else if ( thisTab.title().indexOf("Sheet for Star Lord") > -1 ) {
			var slSheet = {
				'tab': thisTab,
				'window': thisWindow,
				'windowIndex': w,
				'tabIndex': t + 1
			};
		}
	}
}

if (!starLord && !slSheet) {
	throwError(`Hello! I am Star Lord Helper v1.0. I was designed to help you enter your listings into Star Lord. Please create a Google Spreedsheet with a title that includes the words, 'Sheet for Star Lord'. You can then place listings that you'd like to add/update in Star Lord to that sheet. Next, open Star Lord and make sure you have the address set properly and the units per page set to 500. Finally, make sure Star Lord and Sheet for Star Lord are in the same Google Chrome window, and then, run this script again and I'll check/uncheck any units that were in your spreadsheet. I'm perfect for marking units as rented so you can sort by status and edit only those that need to be.`);
} else if (!starLord && slSheet) {
	var tab = chrome.Tab({ url: 'http://be.rentalbeast.com/sl-listings' });
	slSheet.window.tabs.push(tab);
	throwError("Star Lord wasn't open. Please make sure everything is in order (i.e. you have the correct address in Star Lord), then try running the script again.");
} else if (starLord && !slSheet) {
	throwError("I couldn't find any tabs with the words, 'Sheet for Star Lord', in the title. Please make sure everything is in order, then try running the script again.");
} else if (starLord.window != slSheet.window) {
	throwError("Please put the tabs for Star Lord and the spreadsheet for Star Lord in the same Google Chrome window. Then try running the script again.");
}

(function checkListingsPerPage() {
	openTab(starLord);
	// chrome.execute(starLord.tab, { javascript: deleteAccesskeys });
	var jsFuncToDo = `(function () {
		var dropDown = document.querySelector("div.normalTxt.right select");
		var keyValue = dropDown.options[ dropDown.selectedIndex ].innerText;
        if (keyValue != "500 per page") {
        	dropDown.accessKey = "q";
        	return true;
        }
        return false;
    })(); `;
    if ( chrome.execute(starLord.tab, { javascript: jsFuncToDo }) ) {
        press("anchor", "q");
        press("500");
        waitForLoading();
    }
})();

var propertyBeingUpdated = (function chooseProperty() {
	openTab(starLord);
	var definePropertiesAtAddress = ` var propertiesAtAddress = []; `;
	var jsFuncToDo = `
        var propertyName = recordCells[cIndex.owner].innerText;
        if ( propertiesAtAddress.indexOf(propertyName) < 0 && /Star Lord|Office/i.test(recordCells[cIndex.origin].innerText) ) {
            propertiesAtAddress.push(propertyName);
        }
	`;
	var returnProperties = ` return propertiesAtAddress; `;
	var propertiesAtAddress = chrome.execute( starLord.tab, { javascript: loopThruOldRows(jsFuncToDo, { beforeRows: definePropertiesAtAddress, afterRows: returnProperties }) } );
	if ( propertiesAtAddress.length > 1 ) { return chrome.chooseFromList(propertiesAtAddress, { withPrompt: 'Which property are you updating right now?' }); }
	else { return propertiesAtAddress[0]; }
})();

var oldListings = (function getOldRecords() {
	var declareOldRecords = ` var oldRecords = []; `;
	var jsFuncToDo = `
		oldRecords.push({
            unit: recordCells[cIndex.unit].innerText,
            bed: recordCells[cIndex.bed].innerText,
            rent: recordCells[cIndex.rent].innerText,
            sqft: recordCells[cIndex.sqft].innerText,
            bath: recordCells[cIndex.bath].innerText,
            date: recordCells[cIndex.date].innerText,
            owner: recordCells[cIndex.owner].innerText,
            origin: recordCells[cIndex.origin].innerText,
            status: recordCells[cIndex.status].innerText,
            starlord: recordCells[cIndex.starlord].innerText,
            updated: recordCells[cIndex.updated].innerText
		});
	`;
	var returnOldRecords = ` return oldRecords; `;
	return chrome.execute( starLord.tab,
		{ javascript: loopThruOldRows( jsFuncToDo,
			{ beforeRows: declareOldRecords, afterRows: returnOldRecords } )
		}
	);
})();

var latestListing = (function findLatestListing() {
	openTab(starLord);
	var declareLatestDate = ` var latestDate = { date: "" }; `;
	var jsFuncToDo = `
		var dateFound = fromRBDate( recordCells[cIndex.updated].innerText );
		if ( dateFound > latestDate.date && recordCells[cIndex.owner].innerText == "` + propertyBeingUpdated + `" ) {
			latestDate = {
				"date": dateFound,
				"i": i
			};
			var flagMultiple = false;
		}
		else if ( dateFound.getTime() === latestDate.date.getTime() ) {
			flagMultiple = true;
		}
	`;
	var getLatest = `
		if ( flagMultiple ) { latestDate.i = "ERROR";	}
		return latestDate.i;
	`;
	var latestDate = chrome.execute( starLord.tab,
		{ javascript: loopThruOldRows( jsFuncToDo,
			{ beforecIndex: fromRBDate, beforeRows: declareLatestDate, afterRows: getLatest } )
		}
	);
	if ( latestDate == "ERROR" ) {
		throwError("I can't find the most recently edited listing, so I don't know what to mark as the source.");
	}
	return latestDate;
})();

(function removeSources() {
	openTab(starLord);
	var jsFuncToDo = `
		if ( /source/i.test(recordCells[cIndex.starlord].innerText) && i!=` + latestListing + ` ) {
			recordCells[cIndex.action].querySelector('select').accessKey = "q";
			return true;
		}
	`;
	if ( chrome.execute(starLord.tab, { javascript: loopThruOldRows( jsFuncToDo ) }) ) {
		press( "anchor", "q" );
		press( "r" );
		waitForLoading();
		removeSources();
	}
})();

var newListings = (function getListingsFromText() {
	// NEED TO CREATE A WARNING ABOUT DUPLICATE LISTINGS
	// NEED TO THROWERROR IF MISSING ANY HEADERS
	openTab(slSheet);
	delay(0.25);
	var text;
	var visit = 0;
	(function getAllText() {
	    press("home cmd");
	    delay(0.25);
	    press("all copy");
	    delay(0.25);
	    text = chrome.theClipboard();
	    // chrome.displayAlert('text', { message: JSON.stringify( text ) });
	    if( !/\t/.test(text) ){
	    	if ( visit < 1 ) {
	    		press("return");
	    		visit++;
	    		getAllText();
	    	}
	    	else { throwError("There was an error while trying to grab the new listings. Are they entered into the sheet for Star Lord properly?"); }
	    }
	})();

    var cIndex = {};
    var newListings = [];
    var rows = text.split(/\r/gm);
    // chrome.displayAlert('rows', { message: JSON.stringify( rows ) });
    for ( var i = 0; i < rows.length; i++ ) {
        var cells = rows[i].split(/\t/g);
        // chrome.displayAlert('cells', { message: "Row " + i + ": " + JSON.stringify( cells ) });
        if ( i == 0 ) {
            for (var j = 0; j < cells.length; j++) {
                if ( /unit|ap.*t|num/i.test(cells[j]) ) { cIndex.unit = j; }
                else if ( /be?d/i.test(cells[j]) ) { cIndex.bed = j; }
                else if ( /rent|cost|starting|price/i.test(cells[j]) ) { cIndex.rent = j; }
                else if ( /sq.*?fe?e?t/i.test(cells[j]) ) { cIndex.sqft = j; }
                else if ( /ba/i.test(cells[j]) ) { cIndex.bath = j; }
                else if ( /date|avail/i.test(cells[j]) ) { cIndex.date = j; }
            }
            if( !('unit' in cIndex) || !('bed' in cIndex) || !('rent' in cIndex) || !('sqft' in cIndex) || !('bath' in cIndex) || !('date' in cIndex) ) {
                throwError("Please put headers into the spreadsheet so I can tell what's the rent, unit number, etc...");
            }
        }
        else {
            if ( /call/i.test(cells[cIndex.rent]) ){
                throwError("At least one of the listings that you're updating is a call for price. Please revise, then retry this script.");
            }
            var rentFound = Number( cells[ cIndex.rent ].match(/[\d.,]+/)[0].replace(",", "") ).toFixed(0);
            if (rentFound < 100) {
            	chrome.displayDialog('There is a rent of ' + rentFound + ', are you sure that\'s right?');
            }
            var sqftFound = Number(cells[ cIndex.sqft ].match(/[\d.,]+/)[0].replace(",",""));
            if (sqftFound < 100) {
            	chrome.displayDialog('There is a sqft of ' + sqftFound + ', are you sure that\'s right?');
            }
            var bedFound = cells[ cIndex.bed ].match(/[\d.]+|s(tudio)?|c(onvertible)?/i)[0].replace(/^0$/,"Studio");
            if( !isNaN(bedFound) ) {
            	bedFound = Number(bedFound);
            	if ( bedFound > 4 ) {
            		chrome.displayDialog('There is a unit with ' + bedFound + ' beds, are you sure that\'s right?');
            	}
            }
            var bathFound = Number( cells[ cIndex.bath ].match(/[\d.]+/)[0] ).toFixed(1);
            if ( (bathFound < 1) || (bathFound > 3) || (bathFound % 1 != 0 && (bathFound - 0.5) % 1 != 0) ) {
            	chrome.displayDialog('There is a unit with ' + bathFound + ' bathrooms, are you sure that\'s right?');
            }

            newListings.push( {
                unit: cells[ cIndex.unit ].replace(/^[^\d]*?[\#\s]+/gm,""),
                bed: bedFound,
                rent: rentFound,
                sqft: sqftFound,
                bath: bathFound,
                date: toRBDate( cells[ cIndex.date ] )
            } );
        }
    }
    return newListings;
})();

applyActionToListing( latestListing, "Set as source" );  // NEED A WAY TO SKIP IF IT'S ALREADY SET AS SOURCE
if ( !getSource() ) { throwError("I tried to set the latest listing as the source, but it failed. Is it a duplicate?"); }

var oldUnitNums = oldListings.map(function(o) { return o.unit; });
(function copyFromSource() {
	if ( oldUnitNums.length > 1 ) {
		selectAll();
		(function uncheckUnrelated() {
			var jsFuncToDo = `
				var checkbox = recordCells[cIndex.checkbox].querySelector('input');
				if ( recordCells[cIndex.owner].innerText != "` + propertyBeingUpdated + `" && checkbox.checked ) {
					checkbox.accessKey = "q";
					return true;
				}
			`;
			var returnSourcesFound = ` return false; `;
			chrome.execute(starLord.tab, { javascript: deleteAccesskeys });
			if ( chrome.execute(starLord.tab, { javascript: loopThruOldRows( jsFuncToDo, { afterRows: returnSourcesFound }) }) ) {
				press( "anchor", "q" );
				uncheckUnrelated();
			}
		})();
		applyBulkAction("copy");
		selectAllButSevenInfo(true);
	}
})();


var newUnitNums = newListings.map(function(o) { return o.unit; });
var alreadyListed = newUnitNums.filter(function(n) { return oldUnitNums.indexOf(n) > -1; });
var notAlreadyListed = newUnitNums.filter(function(n) { return oldUnitNums.indexOf(n) == -1; });
var orderedNewUnitNums = notAlreadyListed.concat(alreadyListed);
var allUnitsStr = JSON.stringify( newUnitNums.concat(oldUnitNums) );
var limit = 50;

var numOfListings = newUnitNums.length;
var dividingNum = 1;
var divided = Math.ceil(numOfListings / dividingNum);
while ( divided >= limit ){
	dividingNum++;
	divided = Math.ceil(numOfListings / dividingNum);
}

(function addToDatabase() {
	var theseNewListings = orderedNewUnitNums.splice(0, divided);
	alreadyListed = theseNewListings.filter(function(n) { return oldUnitNums.indexOf(n) > -1; });
	notAlreadyListed = theseNewListings.filter(function(n) { return oldUnitNums.indexOf(n) == -1; });

	(function createCopies() {
		var newToSystem = notAlreadyListed.length;
		if ( newToSystem != 0 ) {
			var sourceListing = getSource();
			if ( !sourceListing ) { throwError("Trying to create copies failed because no source was found."); }
			applyActionToListing( sourceListing, "Create copies" );
			delay(0.25);
			chrome.execute(starLord.tab, { javascript: deleteAccesskeys });
			placeAccessKey(`document.body.querySelector("div.a_popupAnchor input")`);
			press("anchor", "q");
			press( newToSystem.toString() );
			selectAllButSevenInfo();
		}
	})();

	// VERONICA'S SCRIPT BREAKS DOWN HERE, IT SKIPS PAST TO SAVING...

	chrome.execute(starLord.tab, { javascript: `(function () { document.body.querySelector("div.right > button").click(); })();` });
	var newListingsStr = JSON.stringify( newListings );
	(function editingTheListings() {
		var passInfo = `
			var notAlreadyListed = ` + JSON.stringify( notAlreadyListed ) + `;
			var alreadyListed = ` + JSON.stringify( alreadyListed ) + `;
			var newListings = ` + newListingsStr + `;
			var returnObject = {};
			function isEmpty(map) {
				for (var key in map) {
					if (key != "unit") {
						return false;
					}
				}
				return true;
			}
		`;
		var jsFuncToDo = `
			// THIS DOES NOT ACCOUNT FOR 0'S LENGTH!!!

			var thisUnitNumber = recordCells[cIndex.unit].querySelector("input").value;

			if ( alreadyListed.includes(thisUnitNumber) && recordCells[cIndex.owner].innerText == "` + propertyBeingUpdated + `" ) {
				returnObject.unit = alreadyListed.splice(alreadyListed.indexOf(thisUnitNumber), 1)[0];
			}
			else if ( recordCells[cIndex.rent].querySelector("input").value == "" && /Star Lord/i.test(recordCells[cIndex.origin].innerText) ) {
				returnObject.unit = notAlreadyListed.shift();
			}

			if ("unit" in returnObject) {
				var unitInfo = newListings.filter(function(obj) { return obj.unit == returnObject.unit; })[0];
				for (var key in unitInfo) {
					var dropDown = recordCells[ cIndex[key] ].querySelector("select");
					if ( dropDown ) { var keyValue = dropDown.options[ dropDown.selectedIndex ].innerText; }
					else { var keyValue = recordCells[ cIndex[key] ].querySelector("input").value; }

					if ( keyValue != unitInfo[key] ) { returnObject[key] = unitInfo[key]; }
				}
				if ( !isEmpty(returnObject) ) {
					recordCells[cIndex.unit].querySelector("input").accessKey = "q";
					recordCells[cIndex.bed].querySelector("select").accessKey = "w";
					recordCells[cIndex.rent].querySelector("input").accessKey = "e";
					recordCells[cIndex.sqft].querySelector("input").accessKey = "r";
					recordCells[cIndex.bath].querySelector("input").accessKey = "t";
					recordCells[cIndex.date].querySelector("input").accessKey = "y";
					returnObject.notAlreadyListed = notAlreadyListed;
					returnObject.alreadyListed = alreadyListed;
					return returnObject;
				}
				else {
					returnObject = {};
				}
			}

		`;
		chrome.execute(starLord.tab, { javascript: deleteAccesskeys });
		var returnedObject = chrome.execute(starLord.tab, { javascript: loopThruOldRows( jsFuncToDo, { beforecIndex: passInfo }) });
		if ( returnedObject ) {
			notAlreadyListed = returnedObject.notAlreadyListed;
			alreadyListed = returnedObject.alreadyListed;
			for (var key in returnedObject) {
				switch(key) {
				    case "unit":
				        press("anchor", "q");
				        break;
				    case "bed":
				        press("anchor", "w");
				        break;
				    case "rent":
				        press("anchor", "e");
				        break;
				    case "sqft":
				        press("anchor", "r");
				        break;
				    case "bath":
				        press("anchor", "t");
				        break;
				    case "date":
				        press("anchor", "y");
				        break;
				    default:
				    	continue;
				}
				press( returnedObject[key].toString() );
				if ( key == "date" ) {
					chrome.execute(starLord.tab, { javascript: `(function () { document.body.querySelector("div.a_popupContainer").click(); })();` });
				}
			}
			editingTheListings();
		}
	})();

	placeAccessKey(` document.body.querySelector("div.right > button") `);
	press("anchor", "q");
	press("space");
	waitForLoading({ elem: `document.body.querySelector("div.right > button")`, text: "Saving..." });

	(function checkForUpdates() {
		var jsFuncToDo = ` if( ! ` + allUnitsStr + `.includes(recordCells[cIndex.unit].innerText) ) { return true; } `;
		if ( chrome.execute(starLord.tab, { javascript: loopThruOldRows(jsFuncToDo) }) ) {
			delay(0.25);
			checkForUpdates();
		}
	} )();

	if( orderedNewUnitNums.length ) { addToDatabase(); }
})();

var newUnitNumStr = JSON.stringify(newUnitNums);

console.log("TESTING!!!");
console.log("There are", oldUnitNums.length, " listings in oldUnitNums:", oldUnitNums);
console.log("There are", newUnitNums.length, " listings in newUnitNums:", newUnitNums);
console.log("---------");
console.log("These need to be marked as rented:", oldUnitNums.filter(function(a){ return newUnitNums.indexOf(a) < 0; }));

if ( oldUnitNums.filter(function(a){ return newUnitNums.indexOf(a) < 0; }).length ) {  // Script won't run if there aren't any old listings that need to be marked rented
	selectAll();
	delay(0.5);
	(function uncheckForRented() {
		var jsFuncToDo = `
			var checkbox = recordCells[cIndex.checkbox].querySelector('input');
			if ( 	( ` + newUnitNumStr + `.includes(recordCells[cIndex.unit].innerText)
					|| recordCells[cIndex.owner].innerText != "` + propertyBeingUpdated + `" )
					&& checkbox.checked ) {
				checkbox.accessKey = "q";
				return true;
			}
		`;
		chrome.execute(starLord.tab, { javascript: deleteAccesskeys });
		if ( chrome.execute(starLord.tab, { javascript: loopThruOldRows(jsFuncToDo) }) ) {
			press( "anchor", "q" );
			uncheckForRented();
		}
	})();
	applyBulkAction("rented");
}

if ( newUnitNums.length ) {  // Script won't run if there aren't any new listings that need to be marked active
	selectAll();
	(function uncheckForActive() {
		var jsFuncToDo = `
			var checkbox = recordCells[cIndex.checkbox].querySelector('input');
			if ( 	( ! ` + newUnitNumStr + `.includes(recordCells[cIndex.unit].innerText)
					|| recordCells[cIndex.owner].innerText != "` + propertyBeingUpdated + `" )
					&& checkbox.checked ) {
				checkbox.accessKey = "q";
				return true;
			}
		`;
		chrome.execute(starLord.tab, { javascript: deleteAccesskeys });
		if ( chrome.execute(starLord.tab, { javascript: loopThruOldRows(jsFuncToDo) }) ) {
			press( "anchor", "q" );
			uncheckForActive();
		}
	})();
	applyBulkAction("active");
}
