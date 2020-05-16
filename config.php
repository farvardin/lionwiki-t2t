<?php 

/* Configuration file for LionWiki-t2t. */
/* https://lionwiki-t2t.sourceforge.io/ */

/* **** MAIN TITLE **** */
$WIKI_TITLE = 'LionWiki and txt2tags sample'; // name of the site

/* **** PASSWORDS **** */
// SHA1 hash of password. If empty (or commented out), no password is required

$PASSWORD = sha1("demo");
$Admin["PASSWORD"] = sha1("demo");

// if true, you need to enter the password for entering the wiki and reading pages.
// before setting to true, read http://lionwiki.0o.cz/index.php?page=UserGuide%3A+How+to+use+PROTECTED_READ
$PROTECTED_READ = false;


/* **** SKINS **** */


// Those templates are using markitup, a convenient and advanced toolbar to edit the wiki:

$TEMPLATE = 'templates/minimaxing/minimaxing.html'; // this one is the default skin

//$TEMPLATE = 'templates/red.html';
//$TEMPLATE = 'templates/txt2tags/txt2tags.html';  // used on the txt2tags wiki


//$TEMPLATE = 'templates/ElectricObsidian/ElectricObsidian.html';  // dark theme
//$TEMPLATE = 'templates/literature/literature.html';      // light theme
//$TEMPLATE = 'templates/bootstrap/bootstrap.html';  // bootstrap look. The navbar collapse menu no longer work at the moment


// Those templates are more minimalistic and use only a basic toolbar:

$TEMPLATE = 'templates/ggp/ggp.html'; 
//$TEMPLATE = 'templates/blazekiss/blazekiss.html';
//$TEMPLATE = 'templates/sissou.html';   
//$TEMPLATE = 'templates/fravashyo/fravashyo.html'; 
//$TEMPLATE = 'templates/dandelion.html';   
//$TEMPLATE = 'templates/minimal.html';     
$TEMPLATE = 'templates/terminal/terminal.html';  
//$TEMPLATE = 'templates/terminal_green.html';      
//$TEMPLATE = 'templates/terminal_white.html';      
//$TEMPLATE = 'templates/light.html';         
//$TEMPLATE = 'templates/print.html';         
//$TEMPLATE = 'templates/skeleton.html';    // doesn't work well yet

/* **** MORE OPTIONS **** */

$NO_HTML = true; // XSS protection

$START_PAGE = 'main'; // Which page should be default (start page)?

// if needed (if autodetection doesn't work), force language 
//$LANG = fr;

/* see the file config.t2t to tweak the syntax and even more! */

/* *********************************************** */