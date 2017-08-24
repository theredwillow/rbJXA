// This is a script that you can inject into chrome (perhaps through keyboard maestro) to scrape unit listings from apartment websites.

// http://trinithis.awardspace.com/commentStripper/stripper.html
// http://mrcoles.com/bookmarklet/

// This function is used to select DOM elements so you can copy them.
function selectElementContents(el) {
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
}

// This function is used to find the closest anscestor with a class name
function findAncestor (el, cls) {
    while ((el = el.parentElement) && !el.classList.contains(cls));
    return el;
}

// This function is used to get DOM from an iframe
function iframeRef(frameRef) {
    return frameRef.contentWindow ? frameRef.contentWindow.document : frameRef.contentDocument;
}

// This function is used to create a "column index", it lets the script know where to find information in an HTML table via its headers
function getcIndex(headers) {
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
}

// This hides the background that often gets in the way
var spaceListener = false;
function toggleVis(bgInWay) {
	if (bgInWay && !spaceListener) {
		alert("There *might* be an element in the way of your table. If so, click the space bar to toggle its visibility.");
		spaceListener = true;
		document.addEventListener('keydown', function(event) {
			if (event.code == 'Space') {
				bgInWay.style.visibility = (bgInWay.style.visibility == "hidden") ? "visible" : "hidden";
			}
		});
	}
}

// This function creates the table to display the scraped information
var table = document.createElement('table');
function populateTable(info) {

	var warning = "";

	var minLength = 4;
	var addLeadingZeros = true;
	for (i = 0; i < info.length; i++) {
		info[i].unit = info[i].unit.trim().replace(/[#\s]/g, "");
		if( ! /^[\d-]+$/gi.test(info[i].unit) ){ addLeadingZeros = false; }
		if( addLeadingZeros && info[i].unit.length > minLength ){ minLength = info[i].unit.length; }
	}

	console.log(info.length, "units found, adding table to bottom. -" + scraper + " Scraper");
	for (i = 0; i < info.length; i++) {

		var unitId = "kmScraper" + info[i].unit.replace(/\//g,"");

		if( !document.querySelector("#" + unitId.replace(/\//g,"")) ) {
			var tr = document.createElement('tr');

			while (info[i].unit.length < minLength) { info[i].unit = "0" + info[i].unit; }
			tr.setAttribute("id", unitId);

			var td1 = document.createElement('td');
			var unit = document.createTextNode(info[i].unit);
			td1.appendChild(unit);

			var td2 = document.createElement('td');
			var beds = document.createTextNode(info[i].beds);
			td2.appendChild(beds);

			var td3 = document.createElement('td');
			var numbersFound = info[i].rent.match(/[\d,]+/g);
			if ( numbersFound ) { info[i].rent = Number( numbersFound[0].replace(",", "") ); }
			else { warning += "-Unit " + info[i].unit + ": rent not a number\n"; }
			var rent = document.createTextNode(info[i].rent);
			if (info[i].rent == info[i].sqft) { warning += "-Unit " + info[i].unit + ": sqft equals rent\n"; }
			td3.appendChild(rent);

			var td4 = document.createElement('td');
			var sqft = document.createTextNode(info[i].sqft);
			if (info[i].sqft == "0") { warning += "-Unit " + info[i].unit + ": sqft of zero\n"; }
			td4.appendChild(sqft);

			var td5 = document.createElement('td');
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
			var baths = document.createTextNode(info[i].baths);
			td5.appendChild(baths);

			var td6 = document.createElement('td');
			var date = document.createTextNode(info[i].date);
			td6.appendChild(date);

			tr.appendChild(td1);
			tr.appendChild(td2);
			tr.appendChild(td3);
			tr.appendChild(td4);
			tr.appendChild(td5);
			tr.appendChild(td6);
			table.appendChild(tr);
		}
	}
	table.style.textAlign = "center";
	table.style.align = "center";
	document.body.appendChild(table);
	if ( warning != "" ) { alert("WARNING!\n" + warning); }
}

function upperText(elementGiven) {
	while (elementGiven.hasChildNodes()) {
    	elementGiven.removeChild(elementGiven.lastChild);
	}
	return elementGiven.innerText;
}

// This function returns a string of querySelectorAll properties (i.e. innerText)
function qsAllProp(elementsGiven, propGiven){
	var newText = [];
	propGiven = propGiven || "innerText";
	[].forEach.call(elementsGiven, function(a) {
		newText.push(a[propGiven]);
	});
	return newText.join(" ");
}

var bedRegex = new RegExp(/\s?be?d/gi);
var bathRegex = new RegExp(/\s?bath/gi);
var sqftRegex = new RegExp(/\s?sq.*?f.*?t/gi);
var aptRegex = new RegExp(/apartment|unit|number|apt/gi);
var rentRegex = new RegExp(/rent|price|month|starting/gi);
var dateRegex = new RegExp(/date|avail|move/gi);

var bedNumRegex = new RegExp(/[\d.]+(?=(?:\s|(?:&nbsp;))?be?d)|studio|convertible/gi);
var bathNumRegex = new RegExp(/[\d.]+(?=(?:\s|(?:&nbsp;))?bath)/gi);
var sqftNumRegex = new RegExp(/[\d,.]+(?=(?:\s|(?:&nbsp;))?sq?.*?f.*?t?)/gi);

var info = [];
var scraper;
//THIS PART FINDS WHICH FUNCTION TO CALL
if( document.querySelector('.center-for-reals') ) {
	// EXAMPLE: https://www.cwsapartments.com/apartments/tx/grapevine/marquis-silver-oaks/floor-plans#k=87211
	scraper = "cws";
	var iframe = iframeRef( document.querySelector('iframe') );
	var units = iframe.querySelectorAll('.table tbody tr');

	for (i = 0; i < units.length; i++) {
		var bedbaths = findAncestor(units[i], "search-results").querySelector('.floorplan-description .pull-left').innerHTML;
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
	populateTable(info);
	selectElementContents(table);
	alert( "Table's been added and selected, press ctrl+c and paste it into your google sheet." );
}

else if ( document.querySelector('table.fpSelectedItem label') ) {
	// AMLI
	scraper = "amli";
	var labels = document.body.querySelectorAll('table.fpSelectedItem span>label');
	var [bed, bath] = labels[0].innerHTML.split(", ");
	bed = bed.replace(bedRegex, "");
	bath = bath.replace(bathRegex, "");
	var sqft = labels[1].innerHTML.replace(sqftRegex, "");
	var rows = document.querySelectorAll('table.tblSummary tr[class^="highlightRow"]');
	for (i = 0; i < rows.length; i++) {
		var spans = rows[i].querySelectorAll('td div>span');
		info.push({
			unit: spans[1].innerText,
			beds: bed,
			rent: spans[4].innerText,
			sqft: sqft,
			baths: bath,
			date: spans[3].innerText
		});
	}
	populateTable(info);
	selectElementContents(table);
	alert("Table's on bottom. Watch out, clicking into another floorplan will get rid of it.");
}

else if ( document.querySelector('div.result') ) {
	// http://grandcourtyards.maac.com/#available-apartments
	scraper = "maac";
	var listing = document.querySelectorAll('div.result');
	for (i = 0; i < listing.length; i++) {
		var lifinder = listing[i].querySelectorAll('li');

		info.push({
			unit: listing[i].querySelector('h3').innerHTML.match(/\d+/g)[0],
			beds: lifinder[1].innerText.match(/\d+/g)[0],
			rent: listing[i].querySelector('a.price-range').innerText,
			sqft: lifinder[3].innerText.match(/\d+/g)[0],
			baths: lifinder[2].innerText.match(/[\d\.]+/g)[0],
			date: lifinder[4].innerText.replace("Move-In: ", "")
		});
	}
	populateTable(info);
	selectElementContents(table);
	alert("Table's on bottom and selected. Copy now. Make sure you have all the units, not just a page.");
}

else if ( document.querySelector('div.iui-cards-floorplan-details') ) {
	// http://www.ariosoliving.com/apartments/tx/grand-prairie/floor-plans
	scraper = "ariosoliving";
	var floorplan = document.querySelector('div.iui-cards-floorplan-details');
	var beds = floorplan.querySelector('div.unit-beds').querySelector('span').innerHTML;
	var baths = floorplan.querySelector('div.unit-baths').querySelector('span').innerHTML;
	var sqft = floorplan.querySelector('div.unit-size').innerHTML.replace(" Sq. Ft.", "");
	var units = floorplan.querySelectorAll('div.unit-numbers');

	for (i = 0; i < units.length; i++) {
		var spans = units[i].querySelectorAll('span');

		info.push({
			unit: spans[1].innerHTML.replace("Unit #", ""),
			beds: beds,
			rent: spans[0].innerHTML,
			sqft: sqft,
			baths: baths,
			date: spans[2].innerHTML.replace("Available ", "")
		});
	}
	populateTable(info);
}

/*
else if ( document.querySelector(".iui-floorplan") ) {
	// http://www.montoroapartments.com/p/apartments/floor_plans_7891/irving-tx-75061/montoro-apartments-7891
	scraper = "montoro";
	var floorplans = document.querySelectorAll(".iui-floorplan");
	var numOffloorplans = floorplans.length;
	for (var i = 0; i < numOffloorplans; i++) {
		var thisfloorplan = floorplans[i].querySelectorAll(".iui-number");
		var beds = thisfloorplan[0];
		var baths = thisfloorplan[1];
		var sqft = thisfloorplan[2];
		var unitsFound = floorplans[i].querySelectorAll(".iui-child-unit");
		var numOfunitsFound = unitsFound.length;
		for (var j = 0; j < numOfunitsFound; j++) {
			var thisunitFound = unitsFound[j].querySelectorAll(".iui-number");
			info.push({
				unit: spans[0].innerHTML.replace(/<.*?>/gi, ""),
				beds: beds,
				rent: spans[1].innerHTML.replace(/<.*?>/gi, ""),
				sqft: sqft,
				baths: baths,
				date: spans[2].innerHTML.replace(/<.*?>/gi, "")
			});
		}
	}

}
*/

else if ( document.querySelector('p.floorplaninfotext') ) {
	// https://www.gables.com/communities/texas/plano/junction-15/
	scraper = "gables";
	var floorplan = document.querySelectorAll('p.floorplaninfotext');
	var beds = floorplan[0].innerHTML.match(/[\d.]+/g)[0].replace(/<.*?>/gi, "");
	var baths = floorplan[1].innerHTML.match(/[\d.]+/g)[0].replace(/<.*?>/gi, "");
	var sqft = floorplan[2].innerHTML.match(/[\d.]+/g)[0].replace(/<.*?>/gi, "");
	var units = document.querySelectorAll('.unitrow');
	for (i = 0; i < units.length; i++) {
		var spans = units[i].querySelectorAll('div');
		info.push({
			unit: spans[0].innerHTML.replace(/<.*?>/gi, ""),
			beds: beds,
			rent: spans[1].innerHTML.replace(/<.*?>/gi, ""),
			sqft: sqft,
			baths: baths,
			date: spans[2].innerHTML.replace(/<.*?>/gi, "")
		});
	}
	populateTable(info);
	selectElementContents(table);
	alert("Table's on the bottom, but the page changes and deletes it... So I selected it, press ctrl+c and paste it into SSL.");
}

else if ( document.querySelector('.ul_units li') ) {
	// http://www.ovationatlewisville.com/floorplans
	scraper = "ovationatlewisville";
	var floorplan = document.querySelectorAll('.ul_units li');
	for (i = 0; i < floorplan.length; i++) {
		var floorplanTable = floorplan[i].parentNode.parentNode.querySelector('.unitdetails');
		info.push({
			unit: floorplan[i].querySelector('a.unit_link').innerHTML.match(/\d+/gi)[0],
			beds: floorplanTable.querySelector('.bed').innerHTML,
			rent: floorplanTable.querySelector('.rent').innerHTML.replace(/From\s/gi, ""),
			sqft: floorplanTable.querySelector('.footage').innerHTML,
			baths: floorplanTable.querySelector('.bath').innerHTML,
			date: floorplan[i].previousSibling.previousSibling.innerHTML.replace(/Available:\s/gi, "")
		});
	}
	populateTable(info);
	alert("Table\'s on bottom, table select function doesn\'t work with this property");
}

else if ( document.querySelector('.rent-value') ) {
	// https://s2capital.myresman.com/Portal/Applicants/Availability?a=1080&p=194d2a20-9e27-4f24-96ab-5dd04a852882
	scraper = "s2capital";
	var units = document.body.querySelectorAll('div.unit');
	for (i = 0; i < units.length; i++) {
		var spans = units[i].querySelectorAll('.fw .fv');
		info.push({
			unit: units[i].querySelector('.panel-heading h4').innerHTML,
			beds: spans[1].innerHTML,
			rent: units[i].querySelector('.rent-value').innerHTML,
			sqft: spans[0].innerHTML,
			baths: spans[2].innerHTML,
			date: units[i].querySelector('.available-on').innerHTML.replace(/AVAILABLE ON /i, "")
		});
	}
	populateTable(info);
	selectElementContents( table );
	alert( "Table's been added and selected, press ctrl+c and paste it into your google sheet. By the way, it likely caught every floor plan. There's no need to open and copy each one." );
	toggleVis(document.querySelector("#App"));
}

else if ( document.querySelector('div.unit-row.js-unit-row') ) {
	// http://www.montecitoclub.com/Apartments/module/property_info/property%5Bid%5D/262177/tab/1/
	scraper = "montecitoclub";
	var unitrows = document.querySelectorAll('div.unit-row.js-unit-row');
	var beds = document.querySelector('li.fp-stats-item.modal-beds span.stat-value').innerHTML;
	var baths = document.querySelector('li.fp-stats-item.modal-baths span.stat-value').innerHTML;
	var rent = document.querySelector('li.fp-stats-item.rent span.stat-value');
	if (rent) { rent = rent.innerHTML.match(/\$([\d,]+)\s?-?/i)[1]; }  // Used if the unit doesn't have a price
	else { rent = "IDK???";	}
	for (i = 0; i < unitrows.length; i++) {
		var unitRent = unitrows[i].querySelector('div.unit-col.rent span.unit-col-text');
		if ( unitRent != null ) {
			unitRent = unitRent.innerHTML.replace(/<.*>/gi, "");
		}
		else {
			unitRent = rent;
		}
		info.push({
			unit: unitrows[i].querySelector('div.unit-col.unit span.unit-col-text').innerHTML,
			beds: beds,
			rent: unitRent,
			sqft: unitrows[i].querySelector('div.unit-col.sqft span.unit-col-text').innerHTML,
			baths: baths,
			date: unitrows[i].querySelector('div.unit-col.availability span.unit-col-text').innerHTML
		});
	}
	populateTable(info);
	toggleVis(document.querySelector(".fullwidth-container"));

}

else if ( document.querySelector('.available-units-list li.unit-list-item') ) {
	// http://originatfriscobridges.com/floor-plans/
	scraper = "friscobridges";
	var unitrows = document.querySelectorAll('.available-units-list li.unit-list-item:not(.black)');
	var floorplaninfo = document.querySelectorAll('.plan-details-list li');
	var bedsbaths = floorplaninfo[0].querySelector('.black').innerHTML;
	var bed = bedsbaths.match(bedNumRegex)[0];
	var bath = bedsbaths.match(bathNumRegex)[0];
	var sqft = floorplaninfo[2].querySelector('.black').innerHTML.replace(/(\s-\s\d+)? SQ. FT./gi, "");

	for (i = 0; i < unitrows.length; i++) {
		var unitinfo = unitrows[i].querySelectorAll('.unit-detail-link>div');
		info.push({
			unit: unitinfo[0].innerHTML.replace(/<.*?>|(Unit:)/gi, ""),
			beds: bed,
			rent: unitinfo[3].innerHTML.replace(/<.*>/gi, ""),
			sqft: sqft,
			baths: bath,
			date: unitinfo[1].innerHTML.replace(/(<.*?>)|(Next Available:)/gi, "")
		});
	}
	populateTable(info);
}

else if ( document.querySelector('#RentCafeContent') ) {
	// http://www.westdale-hills.com/availableunits.aspx?myOlePropertyId=47087&MoveInDate=&t=0.7749214425958568
	scraper = "rentcafe";
	var url = window.location.href;
	if( /[&?]f.+p.+\=.*(\&|$)/i.test(url) ) {
		alert("I don't think this page has all the floorplans. I'm redirecting you. Please try scraping again once you land there.");
		window.location.href = url.replace(/[&?]f.+p.+\=.*(\&|$)/gi, "&");
		// Original, didn't work well with https://theiconatross.securecafe.com/onlineleasing/the-icon-at-ross/oleapplication.aspx?stepname=Apartments&myOlePropertyId=221134&floorPlans=1035749
		// window.location.href = url.match(/^.*\?/)[0] + url.match(/myOlePropertyId=\d+/i)[0];
	}
	else {
		console.log("Rent Cafe, myOlePropertyId scraper running");
	    var cIndex = getcIndex( document.querySelector('thead').querySelectorAll('.table-header') );
	    var unitrows = document.querySelectorAll('.AvailUnitRow');
		for (i = 0; i < unitrows.length; i++) {
			var bedsnbaths = unitrows[i].parentNode.parentNode.parentNode.parentNode.previousSibling.querySelector('#other-floorplans').innerHTML.replace(/<.*?>/gi, "");
			var tds = unitrows[i].querySelectorAll('td');
			if ( 'date' in cIndex ) {
				var date = tds[ cIndex.date ].innerHTML.replace(/<.*?>/gi, "");
			}
			else {
				var date = "Now";
			}
			info.push({
				unit: tds[ cIndex.unit ].innerText.replace("#", ""),
				beds: bedsnbaths.match(bedNumRegex)[0],
				rent: tds[ cIndex.rent ].innerText,
				sqft: tds[ cIndex.sqft ].innerText,
				baths: bedsnbaths.match(bathNumRegex)[0],
				date: date
			});
		}
		populateTable(info);
		selectElementContents( table );
		alert( "Table's been added and selected, press ctrl+c and paste it into your google sheet." );
	}

}

else if ( document.querySelector('#beds_1_Content') ) {
	// http://www.bellapartmentliving.com/tx/dallas/oak-forest/floor-plans-pricing.asp#beds_all
	scraper = "bell";
	var floorplans = document.querySelectorAll('.fpItem');
	for (i = 0; i < floorplans.length; i++) {
		var floorplaninfo = floorplans[i].querySelector('.fpRent').innerHTML;
		var bed = floorplaninfo.match(bedNumRegex)[0];
		var bath = floorplaninfo.match(bathNumRegex)[0];
		var sqft = floorplaninfo.match(sqftNumRegex)[0];
		var unitrows = floorplans[i].querySelectorAll('#FloorApplyTable>table tr');
		for (j = 1; j < unitrows.length; j++) {
			var unitinfo = unitrows[j].querySelectorAll('td');
			info.push({
				unit: unitinfo[0].innerHTML.replace(/<.*?>/gi, ""),
				beds: bed,
				rent: unitinfo[2].innerHTML.match(/[\d,]+/g)[0].replace(",",""),
				sqft: sqft,
				baths: bath,
				date: unitinfo[1].innerHTML
			});
		}
	}
	populateTable(info);
	selectElementContents( table );
	alert( "Table's been added and selected, press ctrl+c and paste it into your google sheet." );
}

else if ( document.querySelector("#list-view") ) {
	scraper = "on-site";
	var cIndex = getcIndex( document.querySelector('thead').querySelectorAll('th') );
	var unitsFound = document.querySelectorAll("tr.unit_display");
	var numOfunitsFound = unitsFound.length;
	for (var j = 0; j < numOfunitsFound; j++) {
		var unitInfo = unitsFound[j].querySelectorAll('td');
		var bedbathsqft = unitsFound[j].closest(".floor_plan").querySelector(".floor_plan_size").innerText;
		if ("bed" in cIndex) { var bed = unitInfo[ cIndex.bed ].innerText; }
		else { var bed = bedbathsqft.match(bedNumRegex)[0]; }
		if ("bath" in cIndex) { var bath = unitInfo[ cIndex.bath ].innerText; }
		else {
			var bath = bedbathsqft.match(bathNumRegex);
			if (bath) { bath = bath[0]; }
			else { bath = "1"; }
		}
		if ("sqft" in cIndex) { var sqft = unitInfo[ cIndex.sqft ].innerText; }
		else { var sqft = bedbathsqft.match(sqftNumRegex)[0]; }
		info.push({
			unit: unitInfo[ cIndex.unit ].innerText,
			beds: bed,
			rent: unitInfo[ cIndex.rent ].innerText,
			sqft: sqft,
			baths: bath,
			date: unitInfo[ cIndex.date ].innerText
		});
	}
	populateTable(info);
	selectElementContents( table );
	alert( "Table's been added and selected, press ctrl+c and paste it into your google sheet." );
}

else if ( document.querySelector('#availableFloorplansmsg') ) {
	// http://www.platinumcastlehills.com/Floor-plans.aspx
	// http://www.residenceatarlington.com/Floor-plans.aspx
	scraper = "leasestar";

	if (document.querySelector(".unit-show-hide").innerText == "Loading..."){
		alert("This scraper only works if you wait for the 'Loading...' message to disappear. Please wait for it to change, then run the scraper again.");
		location.reload();
		// window.location.href
	}
	else {

		var floorplans = document.querySelectorAll('.floorplan-block');
		for (i = 0; i < floorplans.length; i++) {
			var floorplaninfo = floorplans[i].querySelectorAll('.specification li strong,.specification>span>span');
			var bed = floorplaninfo[0].innerHTML;
			var bath = floorplaninfo[1].innerHTML;
			if  ( document.querySelectorAll('#unitInfoPanel').length == 0 ){
				var unitrows = floorplans[i].querySelectorAll('table tr');
			}
			else {
				var floorPlanName = floorplans[i].querySelector('h2').innerText;
				var floorPlanUnits = document.querySelectorAll('.fp-name');
				var numOffloorPlanUnits = floorPlanUnits.length;
				for (var k = 0; k < numOffloorPlanUnits; k++) {
					if ( floorPlanUnits[k].innerText == floorPlanName ) {
						var unitrows = floorPlanUnits[k].parentNode.parentNode.querySelectorAll('div.unit-container');  // .par-units 
						break;
					}
				}
			}
			for (j = 0; j < unitrows.length; j++) {
				var headers = unitrows[j].querySelectorAll("th");
				if (headers.length) {
					var cIndex = getcIndex(headers);
					var cIndexGiven = true;
					continue;
				}
				var unitinfo = unitrows[j].querySelectorAll('td,.unit-container>div>div');

				if (!cIndexGiven) {
					var cIndex = {
						"unit": 0,
						"sqft": 1,
						"date": 2
					};
					if ( /\$/.test(unitinfo[3].innerText) ) { cIndex.rent = 3; }
					else { cIndex.rent = 4; }
				}

				var unitRent = unitinfo[cIndex.rent];
				if (unitRent) { unitRent = unitRent.innerText.replace(/[$,]/gi,""); }
				if ( !unitRent || isNaN(unitRent) ) {
					if (floorplaninfo[3]) { unitRent = floorplaninfo[3].innerHTML; }
					else { var noRent; }
				}
				
				info.push({
					unit: unitinfo[cIndex.unit].innerText.replace(/Unit\s\#?/i, ""),
					beds: bed,
					rent: unitRent,
					sqft: unitinfo[cIndex.sqft].innerText.replace(sqftRegex, ""),
					baths: bath,
					date: unitinfo[cIndex.date].innerText.replace(/Available:?\s?/i, "")
				});
			}
		}
		if (noRent) { alert("I don't think this website has any rent prices."); }
		else {
			populateTable(info);
			selectElementContents( table );
			// alert("WARNING: This scraper is potentially broken.");
			alert( "Table's been added and selected, press ctrl+c and paste it into your google sheet." );
			toggleVis(document.querySelector("#form"));
		}

	}
}

else if ( document.querySelector('.available-apartment-card') ) {
	// https://www.camdenliving.com/irving-tx-apartments/camden-valley-park/apartments
	scraper = "camdenliving";
	var floorplansFound = document.querySelectorAll('.available-apartment-card');
	var numOffloorplansFound = floorplansFound.length;
	for (var i = 0; i < numOffloorplansFound; i++) {
		var thisfloorplanFound = floorplansFound[i];
		var floorplanInfo = thisfloorplanFound.querySelectorAll('.unit-info span');
		var beds = floorplanInfo[2].innerText.match(/[\d,]+|studio|convertible/i)[0];
		var sqft = floorplanInfo[1].innerText.match(/[\d,]+/)[0];
		var baths = floorplanInfo[3].innerText.match(/[\d,]+/)[0];

		var units = thisfloorplanFound.querySelectorAll('.unit-table tr');
		var cIndex = getcIndex( units[0].querySelectorAll('th') );
		var numOfunits = units.length;
		for (var j = 1; j < numOfunits; j++) {
			var unitInfo = units[j].querySelectorAll('td');
			info.push({
				unit: unitInfo[cIndex.unit].innerText,
				beds: beds,
				rent: unitInfo[cIndex.rent].innerText,
				sqft: sqft,
				baths: baths,
				date: unitInfo[cIndex.date].innerText
			});
		}
		
	}
	populateTable(info);
    selectElementContents(table);
    alert( "Table's been added and selected, press ctrl+c and paste it into your google sheet." );
}

else if ( document.querySelector(".mainContent .floorplanDetail") ) {
	// http://thekelton.com/floorplans/detail/S1
	scraper = "kelton";
	var floorplan = document.querySelector(".mainContent .floorplanDetail");
	var floorplaninfo = floorplan.querySelector("p").innerText;
	var beds = floorplaninfo.match(bedNumRegex)[0];
	var baths = floorplaninfo.match(bathNumRegex)[0];
	var sqft = floorplaninfo.match(sqftNumRegex)[0];
	var units = floorplan.querySelectorAll("#availability tr");
	var cIndex = getcIndex( units[0].querySelectorAll('th') );
	var numOfunits = units.length;
	for (var i = 1; i < numOfunits; i++) {
		var unitCells = units[i].querySelectorAll('td');
		info.push({
			unit: unitCells[ cIndex.unit ].innerText,
			beds: beds,
			rent: unitCells[ cIndex.rent ].innerText,
			sqft: sqft,
			baths: baths,
			date: unitCells[ cIndex.date ].innerText
		});
	}
	populateTable(info);
    selectElementContents(table);
    alert( "Table's been added and selected, press ctrl+c and paste it into your google sheet." );
}

else if ( document.querySelector('.floorplan_single_wrap') ) {
	// http://livethealexan.com/floorplans/the-ellum/
	scraper = "alexan";
	var fpInfo = qsAllProp( document.querySelectorAll('.fps_info_details,.fps_title h2,.fps_title h3') );
	var beds = fpInfo.match(bedNumRegex)[0];
	var baths = fpInfo.match(bathNumRegex)[0];
	var sqft = fpInfo.match(sqftNumRegex)[0];
	var unitRows = document.querySelectorAll('#availability tr,.fps_avail_table tr:not(.lease_terms)');
	var cIndex = getcIndex( unitRows[0].querySelectorAll('th') );
	var numOfunitRows = unitRows.length;
	for (i = 1; i < numOfunitRows; i++) {
		var unitCells = unitRows[i].querySelectorAll('td');
		var numOfunitCells = unitCells.length;
		info.push({
			unit: unitCells[ cIndex.unit ].innerText.replace("Apt #: ", ""),
			beds: beds,
			rent: unitCells[ cIndex.rent ].innerText.replace(/\D/ig, ""),
			sqft: sqft,
			baths: baths,
			date: unitCells[ cIndex.date ].innerText.replace(/(Availab(ility|le)(\son|\:)?)\s/gi, "")
		});
	}
	populateTable(info);
    selectElementContents( table );
    alert( "Table's been added and selected, press ctrl+c and paste it into your google sheet." );
}

else if ( document.querySelector('.floorplan-tile h2') ) {
	// UDR
    scraper = "udr";
    var bedbath = document.querySelector('.information').innerText.split(", ");
    var bed = bedbath[0].replace(/\s.*/, "");
    var bath = bedbath[1].replace(/\s.*/, "");
    var floorPlanName = document.querySelector('.floorplan-tile h2').innerText;
    var unitRows = document.querySelectorAll('ul.unit');
    var numOfunitRows = unitRows.length;
    for (var i = 0; i < numOfunitRows; i++) {
        info.push({
            beds: bed,
            baths: bath,
            sqft: unitRows[i].querySelector(".sqft").innerText,
            rent: unitRows[i].querySelector(".price").innerText,
            date: unitRows[i].querySelector(".available").innerText,
            unit: unitRows[i].querySelector(".apt").innerText
        });
    }
    populateTable(info);
    selectElementContents( table );
    alert( "Table's been added and selected, press ctrl+c and paste it into your google sheet." );
}

else if ( document.querySelector('.realpage,#fp_ollContainer,[realpage-oll-widget="RealPage-OLL-Widget"]') ) {
	// http://www.twincreekscrossing.com/apartments/tx/allen/classic#k=31023
	scraper = "realpage";
	var iframe = iframeRef( document.querySelector('iframe') );
	var floorplans = iframe.querySelectorAll('.search-row .search-results');
	var numOffloorplans = floorplans.length;

	for (var i = 0; i < numOffloorplans; i++) {
		var thisfloorplan = floorplans[i];
		var thisfpInfo = thisfloorplan.querySelector('h2').innerText;
		var bed = thisfpInfo.match(bedNumRegex);
		if (bed) { bed = bed[0]; }
		else { bed = "IDK???"; }
		var bath = thisfpInfo.match(bathNumRegex);
		if (bath) { bath = bath[0]; }
		else { bath = "IDK???"; }

		var unitsFound = thisfloorplan.querySelectorAll('.table tr');
		var cIndex = getcIndex( unitsFound[0].querySelectorAll('th') );
		var numOfunitsFound = unitsFound.length;
		for (var j = 1; j < numOfunitsFound; j++) {
			var unitInfo = unitsFound[j].querySelectorAll('td');
			info.push({
				unit: unitInfo[ cIndex.unit ].innerText,
				beds: bed,
				rent: unitInfo[ cIndex.rent ].innerText,
				sqft: unitInfo[ cIndex.sqft ].innerText,
				baths: bath,
				date: unitInfo[ cIndex.date ].innerText
			});
		}	
	}
	populateTable(info);
	selectElementContents( table );
	alert( "Table's been added and selected, press ctrl+c and paste it into your google sheet. Remember to do this on each page of listings!" );
}

else if ( document.querySelector('.mfp-iframe') ) {
	// http://www.emersonfrisco.com/floorplans/
	scraper = "emersonfrisco";
	var thisfloorplan = iframeRef( document.querySelector('iframe') );

	var fpInfo = thisfloorplan.querySelector('.fpContainer').innerText;
	var bed = fpInfo.match(bedNumRegex)[0];
	var bath = fpInfo.match(bathNumRegex)[0];
	var sqft = fpInfo.match(sqftNumRegex)[0];

	var unitsFound = thisfloorplan.querySelectorAll('table tr');
	var cIndex = getcIndex( unitsFound[0].querySelectorAll('th') );
	var numOfunitsFound = unitsFound.length;
	for (var j = 1; j < numOfunitsFound; j++) {
		var unitInfo = unitsFound[j].querySelectorAll('td');
		info.push({
			unit: unitInfo[ cIndex.unit ].innerText,
			beds: bed,
			rent: unitInfo[ cIndex.rent ].innerText,
			sqft: sqft,
			baths: bath,
			date: unitInfo[ cIndex.date ].innerText.replace(/\s\(.*\)/,"")
		});
	}	

	populateTable(info);
}

else if ( document.querySelector('.FloorPlansV1') ) {
	scraper = "fpwidget";
	var fpwidget = document.querySelector('#fp_widget');

	var unitInfo = fpwidget.querySelector('.fpw_fpSelectButtonActive .fpw_fpSelectButton_fpDetails').innerText;
	var beds = fpwidget.querySelector('.fpw_col3head_fpDetails').innerText.match(bedNumRegex)[0];
	var baths = unitInfo.match(bathNumRegex)[0];
	var sqft = unitInfo.match(sqftNumRegex)[0];
	var fpRent = unitInfo.match(/\$([\d,]{2,})/);
	if (fpRent) { fpRent = fpRent[1]; }

	var activeUnits = fpwidget.querySelectorAll('.fpw_avUnit_table');
	var unitLength = activeUnits.length;
	for (i = 0; i < unitLength; i++) {
		var unitCells = activeUnits[i].querySelectorAll('td');
		var rent = fpRent;
		if (unitCells.length > 4) {
			var unitRent = unitCells[5].innerText.match(/\$([\d,]{2,})/);
			if (unitRent) { rent = unitRent[0]; }
		}
		info.push({
			unit: unitCells[0].innerText.replace("Apt: ", ""),
			beds: beds,
			rent: rent,
			sqft: sqft,
			baths: baths,
			date: unitCells[3].innerText
		});
	}
	populateTable(info);
	selectElementContents( table );
	alert( "Table's been added and selected, press ctrl+c and paste it into your google sheet. Remember to do this on each page of listings!" );
}

else if ( document.querySelector(".mbl-pad") ) {
	// http://www.emerybayapartments.com/
	scraper = "emerybay";
	var floorplans = document.querySelectorAll(".mbl-pad");
	var numOffloorplans = floorplans.length;
	for (var i = 0; i < numOffloorplans; i++) {
		var fpRows = floorplans[i].querySelectorAll(".mobilegrid tr");
		var fpInfo = floorplans[i].querySelector('.unittype')
			.innerText.replace(/one/gi, "1").replace(/two/gi, "2").replace(/three/gi, "3");
		var beds = fpInfo.match(bedNumRegex);
		var baths = fpInfo.match(bathNumRegex);
		var cIndex = getcIndex( fpRows[0].querySelectorAll("th") );
		var numOffpRows = fpRows.length;
		for (var j = 1; j < numOffpRows; j++) {
			var theseCells = fpRows[j].querySelectorAll("td");
			info.push({
				unit: theseCells[ cIndex.unit ].innerText,
				beds: beds,
				rent: theseCells[ cIndex.rent ].innerText,
				sqft: theseCells[ cIndex.sqft ].innerText,
				baths: baths,
				date: theseCells[ cIndex.date ].innerText
			});
		}
	}
	populateTable(info);
	selectElementContents( table );
	alert( "Table's been added and selected, press ctrl+c and paste it into your google sheet. Remember to do this on each page of listings! --- Or check for iframes..." );
}

else if ( document.querySelector("#cfaUnitResultsTable") ) {
	// http://property.onesite.realpage.com/ol2/(S(lcdw2fwimosldonlnl4fkwyr))/sites/esignature_rms/default.aspx?siteID=3834999
	scraper = "onesite";
	var cIndex = getcIndex( document.querySelector("#cfaUnitResultsTable").querySelectorAll("th") );
	var unitRows = document.querySelectorAll("tr.ExactMatchedApartments,tr.OtherMatchedApartments");
	for (i = 0; i < unitRows.length; i++) {
		var theseCells = unitRows[i].querySelectorAll("td");
		var bedbath = theseCells[ cIndex.bath ].innerText.split(" / ");
		info.push({
			unit: theseCells[ cIndex.unit ].innerText,
			beds: bedbath[0],
			rent: theseCells[ cIndex.rent ].innerText,
			sqft: theseCells[ cIndex.sqft ].innerText,
			baths: bedbath[1],
			date: theseCells[ cIndex.date ].innerText
		});
	}
	populateTable(info);
	selectElementContents( table );
	alert("Table's been added and selected, press ctrl+c and paste it into your google sheet.");
	// SELECT FUNCTION? ALERTS?
}

else if ( document.querySelector('td.fp_opt') ) {
	// http://venterraliving.com/ilume/rent_pricing_availability?beds=&price=&plan=A1&date=2017%2F07%2F11&PromoCode=&extid=TX4IL&cid=3465&REQUEST=%3C%3Fxml+version%3D%271.0%27+encoding%3D%27UTF-8%27%3F%3E%0D%0A%3CUnitAvailRequest%3E%0D%0A%09%3CCommunity+ExternalId%3D%27TX4IL%27%3E%0D%0A%09%09%3CCriteria%3E%0D%0A%09%09%09%3CBedrooms%3E%3C%2FBedrooms%3E%0D%0A%09%09%09%3CMaxPrice%3E%3C%2FMaxPrice%3E%0D%0A%09%09%09%3CMoveInDate%3E2017%2F07%2F11%3C%2FMoveInDate%3E%0D%0A%09%09%09%3CFloorPlanId%3EA1%3C%2FFloorPlanId%3E%0D%0A%09%09%09%3CAmenityIds%3E%3C%2FAmenityIds%3E%0D%0A%09%09%09%3CPromoCode%3E%3C%2FPromoCode%3E%0D%0A%09%09%3C%2FCriteria%3E%0D%0A%09%3C%2FCommunity%3E%0D%0A%3C%2FUnitAvailRequest%3E
	scraper = "venterra";
	var unittable = document.querySelectorAll('#floorplans tr');
	var numofUnitTable = unittable.length;
	for (i = 0; i < numofUnitTable; i++) {
		var firstRow = unittable[i].querySelector(".fp_opt");
		var spansFound = firstRow.querySelectorAll("span");
		for (j = 0; j < spansFound.length; j++) {
			spansFound[j].remove();
		}
		var secondRow = unittable[i].querySelector(".fp_opt1").innerText;
		info.push({
			unit: firstRow.innerText.trim().replace(/(^.*\:)|\s/g,""),
			beds: secondRow.match(bedNumRegex)[0],
			rent: spansFound[1].innerText.replace(/\s\-\s.*$/,"").replace(/[^\d]/,""),
			sqft: secondRow.match(sqftNumRegex)[0],
			baths: secondRow.match(bathNumRegex)[0],
			date: spansFound[2].innerText.replace(/^.*\:\s/,"")
		});
	}
	populateTable(info);
	selectElementContents( table );
	alert("Table's been added and selected, press ctrl+c and paste it into your google sheet. ...Sorry about tearing up the website, refresh the page to verify the information.");
}

else if ( document.querySelector("#floorplan-details,.floorplan-details") ) {
	// http://thebrickyardapts.com/floorplans/detail/THA1
	scraper = "brickyards";
	var fpInfo = document.querySelector("#floorplan-details p,.floorplan-details p").innerText;
	var bed = fpInfo.match(bedNumRegex)[0];
	var bath = fpInfo.match(bathNumRegex)[0];
	var sqft = fpInfo.match(sqftNumRegex)[0];
	var unitsFound = document.querySelector("#availabilityTable");
	var cIndex = getcIndex( unitsFound.querySelectorAll("th") );
	var unitRows = unitsFound.querySelectorAll("tr");
	var numOfunitRows = unitRows.length;
	for (var i = 1; i < numOfunitRows; i++) {
		var theseCells = unitRows[i].querySelectorAll("td");
		info.push({
			unit: theseCells[ cIndex.unit ].innerText,
			beds: bed,
			rent: theseCells[ cIndex.rent ].innerText,
			sqft: sqft,
			baths: bath,
			date: theseCells[ cIndex.date ].innerText
		});
	}
	populateTable(info);
	selectElementContents( table );
	alert("Table's been added and selected, press ctrl+c and paste it into your google sheet.");
}

else if ( document.querySelector("#unit-filter-container") ) {
	scraper = "emerald";
	var cIndex = getcIndex( document.querySelectorAll("th") );
	var unitRows = document.querySelectorAll("tr.unit-row");
	var numOfunitRows = unitRows.length;
	var unitBubbles = document.querySelectorAll(".unit-popup");
	if ( unitBubbles.length < numOfunitRows ) {
		alert("Please close the unit information window over the map and run this again.");
	}
	else {
		for (var i = 0; i < numOfunitRows; i++) {
			var theseCells = unitRows[i].querySelectorAll("td");
			info.push({
				unit: theseCells[ cIndex.unit ].innerText,
				beds: theseCells[ cIndex.bed ].innerText,
				rent: theseCells[ cIndex.rent ].innerText,
				sqft: unitBubbles[i].querySelector(".sq-ft").innerText.match(/[\d,]+/)[0].replace(",", ""),
				baths: theseCells[ cIndex.bath ].innerText,
				date: theseCells[ cIndex.date ].innerText
			});
		}
		populateTable(info);
		selectElementContents( table );
		alert("Table's been added and selected, press ctrl+c and paste it into your google sheet.");
	}
}

else if ( document.querySelector("#ContentPlaceHolder1_gvFloorPlans") ) {
	scraper = "watersedgeplano.com";
	if ( /ascentvictorypark\.com/i.test(window.location.href) ){
		alert('This particular website is dumb, redirecting you to their realpage.');
		window.location.href = "https://4695035.onlineleasing.realpage.com/#k=49064";
	}
	var fpTables = document.querySelectorAll(".section.group");  // This was the old if selector
	var numOffpTables = fpTables.length;
	for (var i = 0; i < numOffpTables; i++) {
		var thesefpTables = fpTables[i].querySelectorAll(".rowclass");
		var thisfpInfo = thesefpTables[i].querySelector(".unittype").innerText.replace(/one/gi, "1").replace(/two/gi, "2").replace(/three/gi, "3").replace(/four/gi, "4");
		var bed = thisfpInfo.match(bedNumRegex);
		if (bed) { bed = bed[0]; }
		else { bed = "IDK???"; }
		var bath = thisfpInfo.match(bathNumRegex);
		if (bath) { bath = bath[0]; }
		else { bath = "IDK???"; }
		var numOfthesefpTables = thesefpTables.length;
		var cIndex = getcIndex( document.querySelectorAll(".gridheader2") );
		for (var j = 0; j < numOfthesefpTables; j++) {
			var theseCells = unitRows[j].querySelectorAll("td");
			info.push({
				unit: theseCells[ cIndex.unit ].innerText,
				beds: bed,
				rent: theseCells[ cIndex.rent ].innerText,
				sqft: sqft,
				baths: bath,
				date: theseCells[ cIndex.date ].innerText
			});
		}
	}
	populateTable(info);
	selectElementContents( table );
	alert("Table's been added and selected, press ctrl+c and paste it into your google sheet.");
}

else if ( document.querySelector("iframe,frame") ) {
	alert("I\'m sorry. This website doesn\'t appear to have a scraper prepared for it yet, unless it's in an iframe... I'm going to redirect you to the frame's source. Maybe the scrape script will work there.");
	window.location.href = document.querySelector("iframe,frame").getAttribute("src");
}

else {
	alert("I\'m sorry. This website doesn\'t appear to have a scraper prepared for it yet.");
}
