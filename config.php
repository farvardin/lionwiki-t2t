<?php /* Configuration file for LionWiki. */
$WIKI_TITLE = 'LionWiki and txt2tags sample'; // name of the site

// SHA1 hash of password. If empty (or commented out), no password is required

$PASSWORD = sha1("demo");

$TEMPLATE = 'templates/dandelion.html'; // presentation template
$TEMPLATE = 'templates/fravashyo.html';
//$TEMPLATE = 'templates/sissou.html';
$TEMPLATE = 'templates/blazekiss.html'; 
$TEMPLATE = 'templates/minimaxing.html';
//$TEMPLATE = 'templates/literature.html';
// $TEMPLATE = 'templates/minimal.html';

// if true, you need to fill password for reading pages too
// before setting to true, read http://lionwiki.0o.cz/index.php?page=UserGuide%3A+How+to+use+PROTECTED_READ
$PROTECTED_READ = false;

$NO_HTML = true; // XSS protection

$START_PAGE = 'main'; // Which page should be default (start page)?
