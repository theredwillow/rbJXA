// unitScraper.js
// This is a script that you can inject into chrome to scrape unit listings from apartment websites.

// Add jQuery
var script = document.createElement('script');
script.src = 'https://code.jquery.com/jquery-1.11.0.min.js';
script.type = 'text/javascript';
document.getElementsByTagName('head')[0].appendChild(script);

// This keeps track of whether there's already a toggleVis() eventListener
var spaceListener = false;
// Column indexes
var cIndex = {};
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
        for (var i = 0; i < headers.length; i++) {
            var thisText = headers[i].innerText.trim();
            if ( utilRegex.sqft.test( thisText ) ) { cIndex.sqft = i; }
            else if ( utilRegex.rent.test( thisText ) ) { cIndex.rent = i; }
            else if ( utilRegex.date.test( thisText ) ) { cIndex.date = i; }
            else if ( utilRegex.bath.test( thisText ) ) { cIndex.bath = i; }
            else if ( utilRegex.bed.test( thisText ) ) { cIndex.bed = i; }
            else if ( utilRegex.apt.test( thisText ) ) { cIndex.unit = i; }  // Leave this as the last one so "Unit Rent" won't be caught
            else { cIndex[thisText] = i; }
        }
        console.log("cIndex:", cIndex);
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
			var numbersFound = info.listings[i].rent.match(/[\d,]+/g);
			if ( numbersFound ) { info.listings[i].rent = Number( numbersFound[0].replace(",", "") ); }
            else { warning += "-Unit " + info.listings[i].unit + ": rent not a number\n"; }
        }
    ],

    sqft:
    [
        function isZero() {
            if (info.listings[i].sqft == "0") { warning += "-Unit " + info.listings[i].unit + ": sqft of zero\n"; }
        }
    ],

    baths:
    [
        function catchAll() {
			if( isNaN(info.listings[i].baths) ) {
				warning += "-Unit " + info.listings[i].unit + ": baths not a number\n";
			}
			else {
				info.listings[i].baths = Number(info.listings[i].baths);
				if ( info.listings[i].baths == 0 ) {
					if ( info.listings[i].beds == "0" || info.listings[i].beds == "Studio" ) {
						info.listings[i].baths = 1;
					}
					else {
						warning += "-Unit " + info.listings[i].unit + ": missing baths\n";
					}
				}
				else if (info.listings[i].baths == 0) { warning += "-Unit " + info.listings[i].unit + ": zero baths\n"; }
				else if (info.listings[i].baths == 0.5) { warning += "-Unit " + info.listings[i].unit + ": 0.5 baths\n"; }
				else if (info.listings[i].baths % 1 != 0 && (info.listings[i].baths - 0.5) % 1 != 0) { warning += "-Unit " + info.listings[i].unit + ": bath not whole or half number\n"; }
			}
        }
    ]

};

var bail = false;  // Will be filled with an alert string if the user needs to do something to make the scraper run
var minLength = 4;
var tdCells = ["unit", "beds", "rent", "sqft", "baths", "date"];

var updateJsonFile = function() {
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(info));
    document.querySelector("#downloadAnchorElem").setAttribute("href", dataStr );
};

// This all creates the table to display the scraped information
var table = document.createElement('table');
table.id = "scrape_results";
table.style.textAlign = "center";
table.style.align = "center";
document.body.appendChild(table);
function populateTable() {

    // Gets the minimum length for leading zeros in units
	for (i = 0; i < info.listings.length; i++) {
		info.listings[i].unit = info.listings[i].unit.trim().replace(/[#\s]/g, "");
		if (info.listings[i].unit.length > minLength) { minLength = info.listings[i].unit.length; }
	}

    // Build the table itself
	for (i = 0; i < info.listings.length; i++) {
		var unitId = "unitScraper" + info.listings[i].unit.replace(/\//g,"");
		if ( !document.querySelector("#" + unitId.replace(/\//g,"")) ) {
			var tr = document.createElement('tr');

			while (info.listings[i].unit.length < minLength) { info.listings[i].unit = "0" + info.listings[i].unit; }
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
                var span = document.createElement('span');
                span.contentEditable = true;
                span.innerHTML = info.listings[i][thisTd];
                span.id = i + "___" + thisTd;
                span.onblur = function () {
                    var thisId = this.id.split("___");
                    var prevVal = info.listings[thisId[0]][thisId[1]];
                    var newVal = this.innerHTML;
                    if ( prevVal != newVal ) {
                        info.listings[thisId[0]][thisId[1]] = newVal;
                        info.changes.push({
                            i: thisId[0],
                            type: thisId[1],
                            prevVal: prevVal,
                            newVal: newVal
                        });
                        updateJsonFile();
                        console.log("User updated:", prevVal, "to", newVal);
                    }
                };
                td.className = thisTd;
                td.appendChild(span);
                tr.appendChild(td);

            }

            table.appendChild(tr);
        }
    }

    if ( warning != "" ) { alert("WARNING!\n" + warning); }
    
    // Add the additional informaton footer to the table
    var tr = document.createElement('tr');
    tr.id = "Additonal-Information";
    table.appendChild(tr);

    // Add the download button for the JSON file
    var td = document.createElement('td');
    var downloadLink = document.createElement('a');
    downloadLink.id = "downloadAnchorElem";
    downloadLink.innerHTML = "Download the JSON file";
    downloadLink.setAttribute("download", info.time + "-scrape.json");
    td.appendChild(downloadLink);
    tr.appendChild(td);
    updateJsonFile();

}

var scrapers = {};
var info = {
    url: window.location.href,
    time: Date.now(),
    listings: [],
    changes: []
};

// Place various commonly used alert strings here
var defaultAlert = "A table has been added and highlighted, press command+c after closing this alert and then paste it into your google sheet.";
var pageAlert = "Everything that is currently visible has been added to a table at the bottom. However, if there are more pages, you'll need to run the script again to collect the others.";
var everyFPAlert = "\n\nBy the way, it likely caught every floor plan. There's no need to open and copy each one.";

/*

HOW TO BUILD A SCRAPER
    //url url's can be added as a comment at the top for troubleshooting
    check: boolean used to check if this url uses this scraper
    func: the function to be executed to fill the info array
    select: boolean to make the script highlight it after the scrape or not, optional defaults false
    alert: the alert that will appear when it's done, optional
        -defaultAlert variable available

*/

scrapers["realpageiframe"] = {
    // https://www.cwsapartments.com/apartments/tx/grapevine/marquis-silver-oaks/floor-plans#k=87211
    check: document.querySelector('.center-for-reals'),
    func: function () {
        var iframe = utilFuncs.iframeRef( document.querySelector('iframe') );
        var units = iframe.querySelectorAll('.table tbody tr');

        for (i = 0; i < units.length; i++) {
            var bedbaths = utilFuncs.findAncestor(units[i], "search-results").querySelector('.floorplan-description .pull-left').innerHTML;
            var tds = units[i].querySelectorAll('td');
            info.listings.push({
                unit: tds[1].innerHTML,
                beds: bedbaths.match(utilRegex.bedNum)[0],
                rent: tds[2].querySelector('span').innerHTML,
                sqft: tds[4].innerHTML,
                baths: bedbaths.match(utilRegex.bathNum)[0],
                date: tds[5].innerHTML
            });
        }
    },
    select: true,
    alert: pageAlert
};

scrapers["realpage"] = {
    // http://www.twincreekscrossing.com/apartments/tx/allen/classic#k=31023
    check: document.querySelector('.realpage,#fp_ollContainer,[realpage-oll-widget="RealPage-OLL-Widget"]'),
    func: function() {
        var iframe = utilFuncs.iframeRef( document.querySelector('iframe') );
        var floorplans = iframe.querySelectorAll('.search-row .search-results'); 
        for (var i = 0; i < floorplans.length; i++) {
            var thisfloorplan = floorplans[i];
            var thisfpInfo = thisfloorplan.querySelector('h2').innerText;
            var bed = thisfpInfo.match( utilRegex.bedNum );
            if (bed) { bed = bed[0]; }
            else { bed = "IDK???"; }
            var bath = thisfpInfo.match( utilRegex.bathNum );
            if (bath) { bath = bath[0]; }
            else { bath = "IDK???"; }
    
            var unitsFound = thisfloorplan.querySelectorAll('.table tr');
            utilFuncs.getcIndex( unitsFound[0].querySelectorAll('th') );
            for (var j = 1; j < unitsFound.length; j++) {
                var unitInfo = unitsFound[j].querySelectorAll('td');
                info.listings.push({
                    unit: unitInfo[ cIndex.unit ].innerText,
                    beds: bed,
                    rent: unitInfo[ cIndex.rent ].innerText,
                    sqft: unitInfo[ cIndex.sqft ].innerText,
                    baths: bath,
                    date: unitInfo[ cIndex.date ].innerText
                });
            }	
        }
    },
    select: true,
    alert: pageAlert
};

scrapers["maac"] = {
	// http://grandcourtyards.maac.com/#available-apartments
    check: document.querySelector('#available-apartments div.result'),
    func: function() {
        var listing = document.querySelectorAll('div.result');
        for (i = 0; i < listing.length; i++) {
            var lifinder = listing[i].querySelectorAll('li');
            info.listings.push({
                unit: listing[i].querySelector('h3').innerHTML.match(/\d+/g)[0],
                beds: lifinder[1].innerText.match(/\d+/g)[0],
                rent: listing[i].querySelector('a.price-range').innerText,
                sqft: lifinder[3].innerText.match(/\d+/g)[0],
                baths: lifinder[2].innerText.match(/[\d\.]+/g)[0],
                date: lifinder[4].innerText.replace(/.*:\s/, "")
            });
        }
    },
	select: true,
	alert: pageAlert
};

scrapers["amli"] = {
    // https://www.amli.com/apartments/dallas/north-dallas-suburbs/frisco/ballpark/floorplans
    check: document.querySelector('table.fpSelectedItem label'),
    func: function() {
        var labels = document.body.querySelectorAll('table.fpSelectedItem span>label');
        var bedbath = labels[0].innerHTML.split(", ");
        var sqft = labels[1].innerHTML.replace(utilRegex.sqft, "");
        var rows = document.querySelectorAll('table.tblSummary tr[class^="highlightRow"]');
        for (i = 0; i < rows.length; i++) {
            var spans = rows[i].querySelectorAll('td div>span');
            info.listings.push({
                unit: spans[1].innerText,
                beds: bedbath[0].replace(utilRegex.bed, ""),
                rent: spans[4].innerText,
                sqft: sqft,
                baths: bedbath[1].replace(utilRegex.bath, ""),
                date: spans[3].innerText
            });
        }
    },
	select: true,
	alert: "The table is on the bottom and highlighted, but watch out, clicking into another floorplan will get rid of it."
};

scrapers["iuicards"] = {
    // http://www.ariosoliving.com/apartments/tx/grand-prairie/floor-plans
    check: document.querySelector('div.iui-cards-floorplan-details'),
    func: function() {
        var floorplan = document.querySelector('div.iui-cards-floorplan-details');
        var beds = floorplan.querySelector('div.unit-beds').querySelector('span').innerHTML;
        var baths = floorplan.querySelector('div.unit-baths').querySelector('span').innerHTML;
        var sqft = floorplan.querySelector('div.unit-size').innerHTML.replace(" Sq. Ft.", "");
        var units = floorplan.querySelectorAll('div.unit-numbers');

        for (i = 0; i < units.length; i++) {
            var spans = units[i].querySelectorAll('span');

            info.listings.push({
                unit: spans[1].innerHTML.replace("Unit #", ""),
                beds: beds,
                rent: spans[0].innerHTML,
                sqft: sqft,
                baths: baths,
                date: spans[2].innerHTML.replace("Available ", "")
            });
        }
    }
};

scrapers["gables"] = {
    // https://www.gables.com/communities/texas/plano/junction-15/
    check: document.querySelector('p.floorplaninfotext'),
    func: function() {
        var floorplan = document.querySelectorAll('p.floorplaninfotext');
        var beds = floorplan[0].innerHTML.match(/[\d.]+/g)[0].replace(/<.*?>/gi, "");
        var baths = floorplan[1].innerHTML.match(/[\d.]+/g)[0].replace(/<.*?>/gi, "");
        var sqft = floorplan[2].innerHTML.match(/[\d.]+/g)[0].replace(/<.*?>/gi, "");
        var units = document.querySelectorAll('.unitrow');
        for (i = 0; i < units.length; i++) {
            var spans = units[i].querySelectorAll('div');
            info.listings.push({
                unit: spans[0].innerHTML.replace(/<.*?>/gi, ""),
                beds: beds,
                rent: spans[1].innerHTML.replace(/<.*?>/gi, ""),
                sqft: sqft,
                baths: baths,
                date: spans[2].innerHTML.replace(/<.*?>/gi, "")
            });
        }
    },
	select: true,
	alert: pageAlert
};

scrapers["emerald"] = {
    // https://www.ovationatlewisville.com/floorplans/#availabilities/floorplan/14642/
    check: document.querySelector("#unit-filter-container"),
    func: function() {
        utilFuncs.getcIndex( document.querySelectorAll("th") );
        var unitRows = document.querySelectorAll("tr.unit-row");
        var numOfunitRows = unitRows.length;
        var unitBubbles = document.querySelectorAll(".unit-popup");
        if ( unitBubbles.length < numOfunitRows ) {
            bail = "Please close the unit information window over the map, refresh the page, and then try running this again.";
            return;
        }
        if ( document.querySelector("#deselect-unit") ) {
            bail = "This is an inefficient way to scrape this site. Please click the View All units button, then try running this script again.";
            return;
        }
        for (var i = 0; i < numOfunitRows; i++) {
            var theseCells = unitRows[i].querySelectorAll("td");
            info.listings.push({
                unit: theseCells[ cIndex.unit ].innerText,
                beds: theseCells[ cIndex.bed ].innerText,
                rent: theseCells[ cIndex.rent ].innerText,
                sqft: unitBubbles[i].querySelector(".sq-ft").innerText.match(/[\d,]+/)[0].replace(",", ""),
                baths: theseCells[ cIndex.bath ].innerText,
                date: theseCells[ cIndex.date ].innerText
            });
        }
    },
    select: true,
    alert: defaultAlert
};

scrapers["s2capital"] = {
    // https://s2capital.myresman.com/Portal/Applicants/Availability?a=1080&p=194d2a20-9e27-4f24-96ab-5dd04a852882
    check: document.querySelector('.rent-value'),
	func: function () {
        var units = document.body.querySelectorAll('div.unit');
        for (i = 0; i < units.length; i++) {
            var spans = units[i].querySelectorAll('.fw .fv');
            info.listings.push({
                unit: units[i].querySelector('.panel-heading h4').innerHTML,
                beds: spans[1].innerHTML,
                rent: units[i].querySelector('.rent-value').innerHTML,
                sqft: spans[0].innerHTML,
                baths: spans[2].innerHTML,
                date: units[i].querySelector('.available-on').innerHTML.replace(/AVAILABLE ON /i, "")
            });
        }
    },
	select: true,
	alert: defaultAlert + everyFPAlert,
	hide: document.querySelector("#App")
};

scrapers["friscobridges"] = {
	// http://originatfriscobridges.com/floor-plans/
    check: document.querySelector('.available-units-list li.unit-list-item'),
    func: function() {
        var unitrows = document.querySelectorAll('.available-units-list li.unit-list-item:not(.black)');
        var floorplaninfo = document.querySelectorAll('.plan-details-list li');
        var bedsbaths = floorplaninfo[0].querySelector('.black').innerHTML;
        var bed = bedsbaths.match(utilRegex.bedNum)[0];
        var bath = bedsbaths.match(utilRegex.bathNum)[0];
        var sqft = floorplaninfo[2].querySelector('.black').innerHTML.replace(/(\s-\s\d+)? SQ. FT./gi, "");
        for (i = 0; i < unitrows.length; i++) {
            var unitinfo = unitrows[i].querySelectorAll('.unit-detail-link>div');
            info.listings.push({
                unit: unitinfo[0].innerHTML.replace(/<.*?>|(Unit:)/gi, ""),
                beds: bed,
                rent: unitinfo[3].innerHTML.replace(/<.*>/gi, ""),
                sqft: sqft,
                baths: bath,
                date: unitinfo[1].innerHTML.replace(/(<.*?>)|(Next Available:)/gi, "")
            });
        }
    },
    select: true,
    alert: defaultAlert
};

scrapers["rentcafe"] = {
	// http://www.westdale-hills.com/availableunits.aspx?myOlePropertyId=47087&MoveInDate=&t=0.7749214425958568
    check: document.querySelector('#RentCafeContent'),
    func: function () {
        var url = window.location.href;
        if( /[&?]f.+p.+\=.*(\&|$)/i.test(url) ) {
            alert("I don't think this page has all the floorplans. I'm redirecting you. Please try scraping again once you land there.");
            window.location.href = url.replace(/[&?]f.+p.+\=.*(\&|$)/gi, "&");
            // Original, didn't work well with https://theiconatross.securecafe.com/onlineleasing/the-icon-at-ross/oleapplication.aspx?stepname=Apartments&myOlePropertyId=221134&floorPlans=1035749
            // window.location.href = url.match(/^.*\?/)[0] + url.match(/myOlePropertyId=\d+/i)[0];
        }
        else {
            utilFuncs.getcIndex( document.querySelector('thead').querySelectorAll('.table-header') );
            var unitrows = document.querySelectorAll('.AvailUnitRow');
            for (i = 0; i < unitrows.length; i++) {
                var bedsnbaths = unitrows[i].parentNode.parentNode.parentNode.parentNode.previousSibling.querySelector('#other-floorplans').innerHTML.replace(/<.*?>/gi, "");
                var tds = unitrows[i].querySelectorAll('td');
                if ( 'date' in cIndex ) { var date = tds[ cIndex.date ].innerHTML.replace(/<.*?>/gi, ""); }
                else { var date = "Now"; }
                info.listings.push({
                    unit: tds[ cIndex.unit ].innerText.replace("#", ""),
                    beds: bedsnbaths.match( utilRegex.bedNum )[0],
                    rent: tds[ cIndex.rent ].innerText,
                    sqft: tds[ cIndex.sqft ].innerText,
                    baths: bedsnbaths.match( utilRegex.bathNum )[0],
                    date: date
                });
            }
        }
    },
    select: true,
    alert: defaultAlert
};

scrapers["bell"] = {
	// http://www.oakforestapartments.net/profile_floorplans.asp?AID=15772#beds_all
    check: document.querySelector('#beds_1_Content'),
    func: function() {
        var floorplans = document.querySelectorAll('.fpItem');
        for (i = 0; i < floorplans.length; i++) {
            var floorplaninfo = floorplans[i].querySelector('.fpRent').innerHTML;
            var bed = floorplaninfo.match( utilRegex.bedNum )[0];
            var bath = floorplaninfo.match( utilRegex.bathNum )[0];
            var sqft = floorplaninfo.match( utilRegex.sqftNum )[0];
            var unitrows = floorplans[i].querySelectorAll('#FloorApplyTable>table tr');
            for (j = 1; j < unitrows.length; j++) {
                var unitinfo = unitrows[j].querySelectorAll('td');
                info.listings.push({
                    unit: unitinfo[0].innerHTML.replace(/<.*?>/gi, ""),
                    beds: bed,
                    rent: unitinfo[2].innerHTML.match(/[\d,]+/g)[0].replace(",",""),
                    sqft: sqft,
                    baths: bath,
                    date: unitinfo[1].innerHTML
                });
            }
        }
    },
	select: true,
	alert: defaultAlert
};

scrapers["onsite"] = {
    // https://www.on-site.com/web/online_app/choose_unit?goal=6&attr=x20&property_id=175669&lease_id=0&unit_id=0&required=
    check: document.querySelector("#list-view"),
    func: function () {
        utilFuncs.getcIndex( document.querySelector('thead').querySelectorAll('th') );
        var unitsFound = document.querySelectorAll("tr.unit_display");
        for (var j = 0; j < unitsFound.length; j++) {
            var unitInfo = unitsFound[j].querySelectorAll('td');
            var bedbathsqft = unitsFound[j].closest(".floor_plan").querySelector(".floor_plan_size").innerText;
            if ("bed" in cIndex) { var bed = unitInfo[ cIndex.bed ].innerText; }
            else { var bed = bedbathsqft.match( utilRegex.bedNum )[0]; }
            if ("bath" in cIndex) { var bath = unitInfo[ cIndex.bath ].innerText; }
            else {
                var bath = bedbathsqft.match( utilRegex.bathNum );
                if (bath) { bath = bath[0]; }
                else { bath = "1"; }
            }
            if ("sqft" in cIndex) { var sqft = unitInfo[ cIndex.sqft ].innerText; }
            else { var sqft = bedbathsqft.match( utilRegex.sqftNum )[0]; }
            info.listings.push({
                unit: unitInfo[ cIndex.unit ].innerText,
                beds: bed,
                rent: unitInfo[ cIndex.rent ].innerText,
                sqft: sqft,
                baths: bath,
                date: unitInfo[ cIndex.date ].innerText
            });
        }
    },
	select: true,
	alert: defaultAlert
};

scrapers["camdenliving"] = {
	// https://www.camdenliving.com/irving-tx-apartments/camden-valley-park/apartments
    check: document.querySelector('.available-apartment-card'),
    func: function() {
        var floorplansFound = document.querySelectorAll('.available-apartment-card');
        for (var i = 0; i < floorplansFound.length; i++) {
            var thisfloorplanFound = floorplansFound[i];
            var floorplanInfo = thisfloorplanFound.querySelectorAll('.unit-info span');
            var beds = floorplanInfo[2].innerText.match(/[\d,]+|studio|convertible/i)[0];
            var sqft = floorplanInfo[1].innerText.match(/[\d,]+/)[0];
            var baths = floorplanInfo[3].innerText.match(/[\d,]+/)[0];
            var units = thisfloorplanFound.querySelectorAll('.unit-table tr');
            utilFuncs.getcIndex( units[0].querySelectorAll('th') );
            for (var j = 1; j < units.length; j++) {
                var unitInfo = units[j].querySelectorAll('td');
                info.listings.push({
                    unit: unitInfo[cIndex.unit].innerText,
                    beds: beds,
                    rent: unitInfo[cIndex.rent].innerText,
                    sqft: sqft,
                    baths: baths,
                    date: unitInfo[cIndex.date].innerText
                });
            }
            
        }
    },
	select: true,
    alert: defaultAlert
};

scrapers["kelton"] = {
	// http://thekelton.com/floorplans/detail/S1
    check: document.querySelector(".mainContent .floorplanDetail"),
    func: function () {
        var floorplan = document.querySelector(".mainContent .floorplanDetail");
        var floorplaninfo = floorplan.querySelector("p").innerText;
        var beds = floorplaninfo.match( utilRegex.bedNum )[0];
        var baths = floorplaninfo.match( utilRegex.bathNum )[0];
        var sqft = floorplaninfo.match( utilRegex.sqftNum )[0];
        var units = floorplan.querySelectorAll("#availability tr");
        utilFuncs.getcIndex( units[0].querySelectorAll('th') );
        for (var i = 1; i < units.length; i++) {
            var unitCells = units[i].querySelectorAll('td');
            info.listings.push({
                unit: unitCells[ cIndex.unit ].innerText,
                beds: beds,
                rent: unitCells[ cIndex.rent ].innerText,
                sqft: sqft,
                baths: baths,
                date: unitCells[ cIndex.date ].innerText
            });
        }
    },
    select: true,
    alert: defaultAlert
};

scrapers["fpwidget"] = {
    check: document.querySelector('.FloorPlansV1'),
    func: function () {
        var fpwidget = document.querySelector('#fp_widget');
        var unitInfo = fpwidget.querySelector('.fpw_fpSelectButtonActive .fpw_fpSelectButton_fpDetails').innerText;
        var beds = fpwidget.querySelector('.fpw_col3head_fpDetails').innerText.match( utilRegex.bedNum )[0];
        var baths = unitInfo.match( utilRegex.bathNum )[0];
        var sqft = unitInfo.match( utilRegex.sqftNum )[0];
        var fpRent = unitInfo.match(/\$([\d,]{2,})/);
        if (fpRent) { fpRent = fpRent[1]; }

        var activeUnits = fpwidget.querySelectorAll('.fpw_avUnit_table');
        for (i = 0; i < activeUnits.length; i++) {
            var unitCells = activeUnits[i].querySelectorAll('td');
            var rent = fpRent;
            if (unitCells.length > 4) {
                var unitRent = unitCells[5].innerText.match(/\$([\d,]{2,})/);
                if (unitRent) { rent = unitRent[0]; }
            }
            info.listings.push({
                unit: unitCells[0].innerText.replace("Apt: ", ""),
                beds: beds,
                rent: rent,
                sqft: sqft,
                baths: baths,
                date: unitCells[3].innerText
            });
        }
    },
	select: true,
	alert: pageAlert
}

scrapers["emerybay"] = {
	// http://www.emerybayapartments.com/
    check: document.querySelector(".mbl-pad"),
    func: function() {
        var floorplans = document.querySelectorAll(".mbl-pad");
        for (var i = 0; i < floorplans.length; i++) {
            var fpRows = floorplans[i].querySelectorAll(".mobilegrid tr");
            var fpInfo = floorplans[i].querySelector('.unittype')
                .innerText.replace(/one/gi, "1").replace(/two/gi, "2").replace(/three/gi, "3");
            var beds = fpInfo.match( utilRegex.bedNum );
            var baths = fpInfo.match( utilRegex.bathNum );
            utilFuncs.getcIndex( fpRows[0].querySelectorAll("th") );
            for (var j = 1; j < fpRows.length; j++) {
                var theseCells = fpRows[j].querySelectorAll("td");
                info.listings.push({
                    unit: theseCells[ cIndex.unit ].innerText,
                    beds: beds,
                    rent: theseCells[ cIndex.rent ].innerText,
                    sqft: theseCells[ cIndex.sqft ].innerText,
                    baths: baths,
                    date: theseCells[ cIndex.date ].innerText
                });
            }
        }
    },
	select: true,
	alert: pageAlert
};

scrapers["brickyards"] = {
	// http://thebrickyardapts.com/floorplans/detail/THA1
    check: document.querySelector("#floorplan-details,.floorplan-details"),
    func: function(){
        var fpInfo = document.querySelector("#floorplan-details p,.floorplan-details p").innerText;
        var bed = fpInfo.match( utilRegex.bedNum )[0];
        var bath = fpInfo.match( utilRegex.bathNum )[0];
        var sqft = fpInfo.match( utilRegex.sqftNum )[0];
        var unitsFound = document.querySelector("#availabilityTable");
        utilFuncs.getcIndex( unitsFound.querySelectorAll("th") );
        var unitRows = unitsFound.querySelectorAll("tr");
        for (var i = 1; i < unitRows.length; i++) {
            var theseCells = unitRows[i].querySelectorAll("td");
            info.listings.push({
                unit: theseCells[ cIndex.unit ].innerText,
                beds: bed,
                rent: theseCells[ cIndex.rent ].innerText,
                sqft: sqft,
                baths: bath,
                date: theseCells[ cIndex.date ].innerText
            });
        }
    },
	select: true,
	alert: defaultAlert
};

scrapers["imtresidential"] = {
    check: document.querySelector(".wrapper-property-floorplans.sitemap-toggle-target "),
    func: function(){
        var fpTables = document.querySelectorAll("#floorplans-container .floorplans-row");
        for (var i = 0; i < fpTables.length; i++) {
            var fpInfo = fpTables[i].querySelectorAll(".subtitle");
            for (var j = 0; j < fpInfo.length; j++) {
                var thisfpInfo = fpInfo[j].innerText;
                if (  utilRegex.bed.test(thisfpInfo) || utilRegex.bedNum.test(thisfpInfo) ) { var bed = thisfpInfo.match( utilRegex.bedNum )[0]; }
                else if ( utilRegex.bath.test(thisfpInfo) ) { var bath = thisfpInfo.match( utilRegex.bathNum )[0]; }
                else if ( utilRegex.sqft.test(thisfpInfo) ) { var sqft = thisfpInfo.match( utilRegex.sqftNum )[0]; }
                else if ( utilRegex.rent.test(thisfpInfo) ) {
                    var rent = thisfpInfo.match( utilRegex.num );
                    if ( rent ){ rent = rent[0]; }
                    else { rent = "N/A"; }
                }
            }
            if ( rent == "N/A" ) { break; }
            utilFuncs.getcIndex( fpTables[i].querySelectorAll(".header-table") );
            var unitsFound = fpTables[i].querySelectorAll(".table-row");
            for (var k = 1; k < unitsFound.length; k++) {  // Start at 1 to avoid headers
                var theseCells = unitsFound[k].querySelectorAll(".data-table");
                if ('bed' in cIndex) { bed = theseCells[ cIndex.bed ].innerText.match( utilRegex.num )[0]; }
                if ('rent' in cIndex) { rent = theseCells[ cIndex.rent ].innerText.match( utilRegex.num )[0]; }
                if ('sqft' in cIndex) { sqft = theseCells[ cIndex.sqft ].innerText.match( utilRegex.num )[0]; }
                if ('bath' in cIndex) { bath = theseCells[ cIndex.bath ].innerText.match( utilRegex.num )[0]; }
                info.listings.push({
                    unit: theseCells[ cIndex.unit ].innerText,
                    beds: bed,
                    rent: rent,
                    sqft: sqft,
                    baths: bath,
                    date: theseCells[ cIndex.date ].innerText
                });
            }
        }
    },
	select: true,
	alert: defaultAlert
};

scrapers["watersedgeplano"] = {
    check: document.querySelector("#ContentPlaceHolder1_gvFloorPlans"),
    func: function(){
        if ( /ascentvictorypark\.com/i.test(window.location.href) ){
            alert('This particular website is dumb, redirecting you to their realpage.');
            window.location.href = "https://4695035.onlineleasing.realpage.com/#k=49064";
        }
        var fpTables = document.querySelectorAll(".section.group");  // This was the old if selector
        for (var i = 0; i < fpTables.length; i++) {
            var thesefpTables = fpTables[i].querySelectorAll(".rowclass");
            var thisfpInfo = thesefpTables[i].querySelector(".unittype").innerText.replace(/one/gi, "1").replace(/two/gi, "2").replace(/three/gi, "3").replace(/four/gi, "4");
            var bed = thisfpInfo.match(bedNumRegex);
            if (bed) { bed = bed[0]; }
            else { bed = "IDK???"; }
            var bath = thisfpInfo.match(bathNumRegex);
            if (bath) { bath = bath[0]; }
            else { bath = "IDK???"; }
            utilFuncs.getcIndex( document.querySelectorAll(".gridheader2") );
            for (var j = 0; j < thesefpTables.length; j++) {
                var theseCells = unitRows[j].querySelectorAll("td");
                info.listings.push({
                    unit: theseCells[ cIndex.unit ].innerText,
                    beds: bed,
                    rent: theseCells[ cIndex.rent ].innerText,
                    sqft: sqft,
                    baths: bath,
                    date: theseCells[ cIndex.date ].innerText
                });
            }
        }
    },
	select: true,
	alert: defaultAlert
};

// This is the function used to create the scrape results
var scrape = function(scraperName) {
    var scraper = scrapers[scraperName];
    scraper.func();
    if (bail) {
        alert(bail);
        return;
    }
    populateTable();
    if (scraper.select) { utilFuncs.selectElementContents(table); }
    if (scraper.alert) { alert(scraper.alert); }
    if (scraper.hide) { utilFuncs.toggleVis(scraper.hide); }
    console.log( "SCRAPE RESULTS: " + scraperName + " found " + info.listings.length + " units", info);
};

// This is the loop that will actually decide which scraper to run and run it
var possibleScrapers = Object.keys(scrapers).filter(function(s) { return scrapers[s].check != null; });
switch (possibleScrapers.length) {

    case 0:
        alert("I\'m sorry. This website doesn\'t appear to have a scraper prepared for it yet.");
        break;

    case 1:
        scrape(possibleScrapers[0]);
        break;

    default:
        alert("There appears to be multiple possible scrapers for this website. Please contact a scraper maker about this. I'm putting both results at the bottom.");
        for (var s in possibleScrapers) { scrape(s); }
        break;

}
