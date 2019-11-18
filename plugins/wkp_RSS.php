<?php
/*
 * RSS plugin for LionWiki, (c) Adam Zivner, adam.zivner@gmail.com, GPL'd
 * 
 * Plugin produces RSS feed of all changes of all pages in a wiki.
 * Feed is composed of a diffs. It's default location is in var/rss.xml
 * 
 * Although it is based on original WiKiss code, it is almost completely
 * rewritten.
 */

class RSS {
	var $desc = array(
		array("RSS plugin", "tracks all changes made to pages in form of diffs. Default location for feed is <a href=\"var/rss.xml\">here</a>.")
	);

	var $max_changes = 50; // RSS contains $max_changes last changes
	var $short_diff = false; // RSS omits unchanged lines

	var $template = '<rss version="2.0">
<channel>
<title>{WIKI_TITLE}</title>
<link>{PAGE_LINK}</link>
<description>{WIKI_DESCRIPTION}</description>
<language>{LANG}</language>
{CONTENT_RSS}
</channel>
</rss>'; // don't change template. This exact form is needed for correct functioning.

	function pageWritten()
	{
		global $WIKI_TITLE, $PG_DIR, $page, $HIST_DIR, $LANG, $VAR_DIR, $PROTECTED_READ;

		if($PROTECTED_READ)
			return false;

		$pagelink = ($_SERVER["HTTPS"] ? "https://" : "http://") . $_SERVER["SERVER_NAME"] . ":" . $_SERVER["SERVER_PORT"] . $_SERVER["SCRIPT_NAME"];

		preg_match("/<\/language>(.*)<\/channel>/s", @file_get_contents($VAR_DIR . "rss.xml"), $matches);

		$items = $matches[1];

		$pos = -1;

		// count items
		for($i = 0; $i < $this->max_changes - 1; $i++)
			if(!($pos = strpos($items, "</item>", $pos + 1)))
				break;

		if($pos) // if count is higher than $max_changes - 1, cut out the rest
			$items = substr($items, 0, $pos + 7);

		if($opening_dir = @opendir($HIST_DIR . $page . "/")) {
			// find two last revisions of page
			$files = array();
			while($filename = @readdir($opening_dir))
				if(preg_match('/\.bak$/', $filename))
					$files[] = $filename;

			rsort($files);

			$newest = diff($files[0], $files[1], $this->short_diff); // LionWiki diff function
			clearstatcache();
			$timestamp = filemtime($PG_DIR . $page . ".txt");

			$n_item = "
	<item>
	  <title>".h($page)."</title>
	  <pubDate>".date("r", $timestamp)."</pubDate>
	  <link>".h($pagelink)."?page=".u($page)."</link>
	  <description>$newest</description>
	</item>";
		} else
			echo "RSS plugin: can't open history directory!";

		$rss = str_replace('{WIKI_TITLE}', h($WIKI_TITLE), $this->template);
		$rss = str_replace('{PAGE_LINK}', h($pagelink), $rss);
		$rss = str_replace('{LANG}', h($LANG), $rss);
		$rss = str_replace('{WIKI_DESCRIPTION}', "RSS feed from " . h($WIKI_TITLE), $rss);
		$rss = str_replace('{CONTENT_RSS}', $n_item . $items, $rss);

		if(!$file = @fopen($VAR_DIR . "rss.xml", "w")) {
			echo "Opening file for writing RSS file is not possible! Please create file rss.xml in your var directory and make it writable (chmod 666).";

			return false;
		}

		fwrite($file, $rss);
		fclose($file);

		return false;
	}

	function template()
	{
		global $HEAD;

		$HEAD .= "\n<link rel=\"alternate\" type=\"application/rss+xml\" title=\"RSS\" href=\"var/rss.xml\" />\n";

		return false;
	}
}