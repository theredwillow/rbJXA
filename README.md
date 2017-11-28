# RB MC Script Helper

This will make your job easier. Come here to get the latest version of the .scpt file.

#### The .js file is the bookmarklet.
* Create a bookmark in your browser with the code in the box below as the URL. (Warning: Chrome protects its users from viruses, but this is safe, make sure the word "javascript:" isn't deleted from the front when you paste it.)

```
javascript:(function(){document.body.appendChild(document.createElement('script')).src="https://rawgit.com/theredwillow/rbJXA/master/unitScraper.js";})();
```

Default Column Order: Unit	Bed	Rent	SQFT	Bath	Date 

#### The .scpt file is the Script Editor script you'll need.
* Step 1) Copy it [raw (click here)](https://raw.githubusercontent.com/theredwillow/rbJXA/master/StarLordHelper.scpt) from github.
* Step 2) Open the Script Editor in Mac and make sure it's set to JavaScript in the top left hand side.
* Step 3) Paste.
* Step 4) Save.
* Step 5) Press play when you have everything set up (i.e. the SSL spreadsheet and SL open).

#### Spreadsheet requirements
* Keep the spreadsheet in the same window as Star Lord
* Title your spreadsheet "Sheet for Star Lord"
* Freeze the first row (the headers)

#### Starlord requirements
* Until I fix it, have these columns selected in display before you first run the script
"Status    Address    Apt #    Owner    #Bdrm    Rent    Sq. Footage    #Bthrms    Phone    Owner Pays    Date Available    Last Updated    Modified By    Origin Source    Star Lord    Listing Summary"
* Until I fix it, keep only one chrome window open at a time

###### Reporting errors
* If something unexpected happens, please report it to Jared in the Dallas office.
* If you think you can reproduce the problem: open Quicktime (command+space, then type quicktime), right click it in the dock, click the option to record the screen, then run the script again. After, you'll have a video the tech team can use to diagnose and fix the problem.
