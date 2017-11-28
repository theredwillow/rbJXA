// unitScraper.js
// This is a script that you can inject into chrome to scrape unit listings from apartment websites.

console.log("Unit Scraper 2 loaded.");

// This keeps track of whether there's already a toggleVis() eventListener
var spaceListener = false;
// These are frequently used functions for scraping
var utilFuncs = {

    // This function is used to highlight DOM elements so you can copy them.
    selectElementContents: function (el) {
        var body = document.body, range, sel;
        if (document.createRange && window.getSelection) {
            range = document.createRange();
            sel = window.getSelection();
            sel.removeAllRanges();
            try {
                range.selectNodeContents(el);
                sel.addRange(range);
            } catch (e) {
                range.selectNode(el);
                sel.addRange(range);
            }
        } else if (body.createTextRange) {
            range = body.createTextRange();
            range.moveToElementText(el);
            range.select();
        }
    },


    // This function is used to find the closest anscestor with a class name
    findAncestor: function (el, cls) {
        while ((el = el.parentElement) && !el.classList.contains(cls));
        return el;
    },

    // This function is used to get DOM from an iframe
    iframeRef: function (frameRef) {
        return frameRef.contentWindow ? frameRef.contentWindow.document : frameRef.contentDocument;
    },

    // This function is used to create a "column index", it lets the script know where to find information in an HTML table via its headers
    getcIndex: function (headers) {
        var cIndex = {};  // Column indexes
        var numOfheaders = headers.length;
        for (var i = 0; i < numOfheaders; i++) {
            var thisText = headers[i].innerText.trim();
            if ( sqftRegex.test( thisText ) ) { cIndex.sqft = i; }
            else if ( rentRegex.test( thisText ) ) { cIndex.rent = i; }
            else if ( dateRegex.test( thisText ) ) { cIndex.date = i; }
            else if ( bathRegex.test( thisText ) ) { cIndex.bath = i; }
            else if ( bedRegex.test( thisText ) ) { cIndex.bed = i; }
            else if ( aptRegex.test( thisText ) ) { cIndex.unit = i; }  // Leave this as the last one so "Unit Rent" won't be caught
            else { cIndex[thisText] = i; }
        }
        return cIndex;
    },

    // This hides the background that often gets in the way
    toggleVis: function (bgInWay) {
        if (bgInWay && !spaceListener) {
            alert("There *might* be an element in the way of your table. If so, click the space bar to toggle its visibility.");
            spaceListener = true;
            document.addEventListener('keydown', function(e) {
                if (e.code == 'Space') {
                    bgInWay.style.visibility = (bgInWay.style.visibility == "hidden") ? "visible" : "hidden";
                }
            });
        }
    },

    upperText: function (elementGiven) {
        while (elementGiven.hasChildNodes()) {
            elementGiven.removeChild(elementGiven.lastChild);
        }
        return elementGiven.innerText;
    },
    
    // This function returns a string of querySelectorAll properties (i.e. innerText)
    qsAllProp: function (elementsGiven, propGiven){
        var newText = [];
        propGiven = propGiven || "innerText";
        [].forEach.call(elementsGiven, function(a) {
            newText.push(a[propGiven]);
        });
        return newText.join(" ");
    }

};

// These are regular expressions that are frequently used
var utilRegex = {
    bed: new RegExp(/\s?be?d/gi),
    bath: new RegExp(/\s?bat?h?/gi),
    sqft: new RegExp(/\s?sq?.*?f.*?t?/gi),
    apt: new RegExp(/ap(artmen)?t|unit|num(ber)?/gi),
    rent: new RegExp(/rent|price|month|starting/gi),
    date: new RegExp(/date|avail|move/gi),
    
    num: new RegExp(/[\d.,]+/g),
    bedNum: new RegExp(/[\d.]+(?=(?:\s|(?:&nbsp;))?be?d)|studio|convertible/gi),
    bathNum:new RegExp(/[\d.]+(?=(?:\s|(?:&nbsp;))?bath)/gi),
    sqftNum: new RegExp(/[\d,.]+(?=(?:\s|(?:&nbsp;))?sq?.*?f.*?t?)/gi)
};

// These are warnings that will be added via functions if necessary
var warning = "";
var utilWarnings = {

    rent:
    [
        function notANumber() {
			var numbersFound = info[i].rent.match(/[\d,]+/g);
			if ( numbersFound ) { info[i].rent = Number( numbersFound[0].replace(",", "") ); }
            else { warning += "-Unit " + info[i].unit + ": rent not a number\n"; }
        }
    ],

    sqft:
    [
        function isZero() {
            if (info[i].sqft == "0") { warning += "-Unit " + info[i].unit + ": sqft of zero\n"; }
        }
    ],

    baths:
    [
        function catchAll() {
			if( isNaN(info[i].baths) ) {
				warning += "-Unit " + info[i].unit + ": baths not a number\n";
			}
			else {
				info[i].baths = Number(info[i].baths);
				if ( info[i].baths == 0 ) {
					if ( info[i].beds == "0" || info[i].beds == "Studio" ) {
						info[i].baths = 1;
					}
					else {
						warning += "-Unit " + info[i].unit + ": missing baths\n";
					}
				}
				else if (info[i].baths == 0) { warning += "-Unit " + info[i].unit + ": zero baths\n"; }
				else if (info[i].baths == 0.5) { warning += "-Unit " + info[i].unit + ": 0.5 baths\n"; }
				else if (info[i].baths % 1 != 0 && (info[i].baths - 0.5) % 1 != 0) { warning += "-Unit " + info[i].unit + ": bath not whole or half number\n"; }
			}
        }
    ]

};

var minLength = 4;
var tdCells = ["unit", "beds", "rent", "sqft", "baths", "date"];

// This all creates the table to display the scraped information
var table = document.createElement('table');
table.id = "scrape_results";
table.style.textAlign = "center";
table.style.align = "center";
document.body.appendChild(table);
function populateTable() {

    // Gets the minimum length for leading zeros in units
	for (i = 0; i < info.length; i++) {
		info[i].unit = info[i].unit.trim().replace(/[#\s]/g, "");
		if (info[i].unit.length > minLength) { minLength = info[i].unit.length; }
	}

    // Build the table itself
	for (i = 0; i < info.length; i++) {
		var unitId = "unitScraper" + info[i].unit.replace(/\//g,"");
		if ( !document.querySelector("#" + unitId.replace(/\//g,"")) ) {
			var tr = document.createElement('tr');

			while (info[i].unit.length < minLength) { info[i].unit = "0" + info[i].unit; }
			tr.id = unitId;

            for (var j = 0; j < tdCells.length; j++) {
                var thisTd = tdCells[j];

                // Check for warnings
                if (utilWarnings[thisTd]) {
                    for (var w = 0; w < utilWarnings[thisTd].length; w++) {
                        utilWarnings[thisTd][w](thisTd);
                    }
                }

                // Create the unit's cells
                var td = document.createElement('td');
                td.innerHTML = info[i][thisTd];
                td.className = thisTd;
                tr.appendChild(td);

            }

            table.appendChild(tr);
        }
    }

	if ( warning != "" ) { alert("WARNING!\n" + warning); }
}

var scrapers = {};
var info = [];
var defaultAlert = "Table's been added and selected, press command+c and paste it into your google sheet.";

/*

HOW TO BUILD A SCRAPER
    //url url's can be added as a comment at the top for troubleshooting
    check: boolean used to check if this url uses this scraper
    func: the function to be executed to fill the info array
    select: boolean to make the script highlight it after the scrape or not, optional defaults false
    alert: the alert that will appear when it's done, optional
        -defaultAlert variable available

*/

scrapers["realpage"] = {
    // https://www.cwsapartments.com/apartments/tx/grapevine/marquis-silver-oaks/floor-plans#k=87211
    check: document.querySelector('.center-for-reals'),
    func: function () {
        var iframe = utilFuncs.iframeRef( document.querySelector('iframe') );
        var units = iframe.querySelectorAll('.table tbody tr');

        for (i = 0; i < units.length; i++) {
            var bedbaths = utilFuncs.findAncestor(units[i], "search-results").querySelector('.floorplan-description .pull-left').innerHTML;
            var tds = units[i].querySelectorAll('td');
            info.push({
                unit: tds[1].innerHTML,
                beds: bedbaths.match(bedNumRegex)[0],
                rent: tds[2].querySelector('span').innerHTML,
                sqft: tds[4].innerHTML,
                baths: bedbaths.match(bathNumRegex)[0],
                date: tds[5].innerHTML
            });
        }
    },
    select: true
};

// This is the loop that will actually decide which scraper to run and run it
for (var scraper in scrapers) {
    if (!scraper.check) { continue; }
    scraper.func();
    populateTable();
    if (scraper.select) { selectElementContents(table); }
    if (scraper.alert) { alert(scraper.alert); }
    console.log( "SCRAPE RESULTS" );
    console.log( info.length, "units found" );
    console.log( "Scraper used:", scraper );
    break;
}
