<?php
/*
 * Tags plugin for LionWiki, (c) Adam Zivner 2008, licensed under GNU GPL
 *
 * Tags plugin provides nonhiearchical categorizing. It can display Tag list and/or Tag cloud
 *
 * Syntax: insert {tags:Biography, LionWiki, Another tag}
 *
 * Tags are case insensitive
 *
 * Tags plugin supports both Tag List (shows tags for current page) and Tag Cloud.
 * You can use them in template (will be displayed on every page) by inserting
 * {plugin:TAG_LIST} or {plugin:TAG_CLOUD}, or in page by inserting {TAG_LIST} or {TAG_CLOUD}
 *
 * Internals: tags for all pages are stored in one file - usually plugins/data/tags.txt
 * This file has simple format - it's filled with pairs of lines. First line is name of
 * the page and second is comma separated list of tags belonging to this page.
 */

class Tags
{
	var $desc = array(
		array("Tags", "supports assigning tags to pages, can create list of tags and/or tag cloud.")
	);

	var $tagfile;

	var $tag_cloud_max = 20; // number of tags in cloud
	var $font_min = 10, $font_max = 14;

	function Tags()
	{
		$this->tagfile =  $GLOBALS["PLUGINS_DATA_DIR"] . "tags.txt";
	}

	// returns tag array of given page

	function getTags($page)
	{
		if(!file_exists($this->tagfile))
			return array();

		$f = fopen($this->tagfile, "rb");

		if(!$f)
			return array();

		while($line = fgets($f)) {
			if(trim($line) == $page)
				return array_map("trim", explode(",", fgets($f)));
			else
				fgets($f);
		}

		return array();
	}

	function action()
	{
		global $action;

		/*
		 * ?action=regenerate-tags regenerates tags for all pages on a wiki. Good in situations when tag file
		 * is lost or corrupted, or when changes to pages are made not using web interface.
		 *
		 * As of now it's quite hackish, it's gonna be quite slow on large wikis.
		 */

		if($action == "regenerate-tags") {
			global $PG_DIR, $page, $content, $CON;

			@unlink($this->tagfile);

			$dir = opendir($PG_DIR);

			while($file = readdir($dir))
				if(preg_match("/\.txt$/", $file)) {
					$content = file_get_contents($PG_DIR . $file);
					$page = basename($file, ".txt");

					$this->pageWritten();
				}

			$CON = "Tags were successfully (re)generated.";
			$action = "view-html";

			return false;
		}
		else if($action == "tagsearch") { // displays tag search results page
			global $TITLE, $CON;

			$tag = trim($_GET["tag"]);

			$TITLE = 'List of pages tagged with "' . h($tag) . '"';

			$CON = $this->getPagesListForTag($tag);
		}
	}

	function getPagesListForTag($tag)
	{
		global $self;
		
		$f = fopen($this->tagfile, "rb");

		if(!$f)
			return;

		$results = array();

		while($page = fgets($f)) {
			$tags = array_map("trim", explode(",", fgets($f)));

			if($this->inCaseArray($tag, $tags))
				$results[] = trim($page);
		}

		if(empty($results))
			$list = "<b>No pages are tagged with this tag.</b>"; // shouldn't happen at all
		else {
			$list = "<ul>\n";

			foreach($results as $r)
				$list .= "	<li><a href=\"$self?page=".u($r)."\">".h($r)."</a></li>\n";

			$list .= "</ul>\n";
		}

		return $list;
	}

	function pageWritten()
	{
		global $page, $content;

		$tags = array();

		preg_match_all("/\{tags:(.+)\}/U", $content, $matches, PREG_SET_ORDER);

		foreach($matches as $match)
			$tags = array_merge($tags, explode(",", $match[1]));

		$tags = array_unique(array_map("trim", $tags));

		$file_tags = $this->getTags($page);

		$same = true;

		foreach($tags as $tag)
			if(!$this->inCaseArray($tag, $file_tags)) {
				$same = false;
				break;
			}
			
		// in case page was just moved
		$orig_name = clear_path($_REQUEST["page"]);

		if(count($tags) != count($file_tags) || !$same || $page != $orig_name) { // if tags are same, don't bother writing
			if(!file_exists($this->tagfile))
				touch($this->tagfile);

			$f = fopen($this->tagfile, "rb");

			$file_lines = array();

			while($line = fgets($f))
				$file_lines[] = $line;

			fclose($f);

			$f = fopen($this->tagfile, "wb");

			$line_count = count($file_lines);

			for($i = 0; $i < $line_count; $i += 2)
				if(trim($file_lines[$i]) != trim($page) && trim($file_lines[$i]) != trim($orig_name))
					fputs($f, $file_lines[$i] . $file_lines[$i + 1]);

			fputs($f, $page . "\n");
			fputs($f, implode(",", $tags) . "\n");

			fclose($f);
		}

		return false;
	}

	/*
	 * Comma separated list of tags in current page. Wrapping div has "tagList" class.
	 *
	 * Use {plugin:TAG_LIST} in templates or {TAG_LIST} in pages
	 */

	function tagList()
	{
		global $page, $self;

		$tags = $this->getTags($page);

		$tag_array = array();

		foreach($tags as $tag)
			$tag_array[] = "<a class=\"tagLink\" href=\"$self?action=tagsearch&amp;tag=".u(trim($tag))."\">".h($tag)."</a>";

		return empty($tag_array) ? "" : "<div class=\"tagList\">Tags: \n" . implode(", ", $tag_array) . "</div>\n";
	}

	/*
	 * Tag "cloud" with all tags on all pages. Size of font is roughly proportional to the number of occurences.
	 *
	 * Use {plugin:TAG_CLOUD} in templates or {TAG_CLOUD} in pages
	 */

	function tagCloud()
	{
		global $self;

		$f = @fopen($this->tagfile, "rb");

		if(!$f)
			return "";

		$tag_counts = array();

		while(fgets($f)) {
			$tags = explode(",", @fgets($f));

			foreach($tags as $tag) {
				$tag = trim($tag);

				$arr_count = count($tag_counts);

				for($i = 0; $i < $arr_count; $i++)
					if(!strcasecmp($tag_counts[$i]["name"], $tag)) {
						$tag_counts[$i]["count"]++;

						break;
					}

				if($i == $arr_count)
					$tag_counts[] = array("name" => $tag, "count" => 1);
			}
		}

		if(empty($tag_counts))
			return;

		$count_max = 0;
		$count_min = 999999999; // some big number

		foreach($tag_counts as $tag) {
			if($tag["count"] > $count_max)
				$count_max = $tag["count"];

			if($tag["count"] < $count_min)
				$count_min = $tag["count"];
		}

		shuffle($tag_counts);

		$t = "<div class=\"tagCloud\"><b>Tag cloud</b><br />\n";

		foreach($tag_counts as $tag) {
			if($count_max == $count_min)
				$tagsize = 11;
			else
				$tagsize = floor(($tag["count"] - $count_min) / ($count_max - $count_min) * ($this->font_max - $this->font_min) + $this->font_min);

			$t .= "<a class=\"tagCloudLink\" style=\"font-size:{$tagsize}px\" href=\"$self?action=tagsearch&amp;tag=".u($tag["name"])."\">".h($tag["name"])."</a>\n";
		}

		return $t . "</div>\n";
	}

	function formatEnd()
	{
		global $CON;

		$CON = preg_replace("/\{tags:.+\}/U", "", $CON);

		if(template_match("TAG_LIST", $CON, $null))
			$CON = template_replace("TAG_LIST", $this->tagList(), $CON);

		if(template_match("TAG_CLOUD", $CON, $null))
			$CON = template_replace("TAG_CLOUD", $this->tagCloud(), $CON);

		while(preg_match("/\{PAGES_TAGGED_WITH:\s*([^}]+)\}/", $CON, $m))
			$CON = str_replace($m[0], $this->getPagesListForTag($m[1]), $CON);
	}

	function template()
	{
		global $html, $action;

		if(!empty($action))
			return;

		if(template_match("plugin:TAG_LIST", $html, $null))
			$html = template_replace("plugin:TAG_LIST", $this->tagList(), $html);

		if(template_match("plugin:TAG_CLOUD", $html, $null))
			$html = template_replace("plugin:TAG_CLOUD", $this->tagCloud(), $html);
	}

	function inCaseArray($needle, $arr)
	{
		if(is_array($arr))
			foreach($arr as $item)
				if(!strcasecmp($item, $needle))
					return true;

		return false;
	}
}