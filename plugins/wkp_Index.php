<?php
/*
 * Written by Swen Wetzel <xanatoswetzel@web.de> for LionWiki, minor changes made by Adam Zivner
 * With {INDEX_COMMA} or {INDEX_LIST}, you can insert list of all pages into the page.
 * {INDEX_COMMA} gives you comma separated list, {INDEX_LIST} <ul> HTML list
 */

class Index
{
	var $desc = array(
		array("Index plugin", "gives list of pages in the wiki.")
	);

	function pagesList($type)
	{
		global $self, $PG_DIR;

		$list = array();

		$dir = opendir($PG_DIR);

		while($file = readdir($dir))
			if(preg_match("/\.txt$/", $file))
				$files[] = substr($file, 0, strlen($file) - 4);

		if(is_array($files)) {
			sort($files);

			foreach($files as $file)
				$list[] = "<a href=\"$self?page=" . u($file) . "\">" . h($file) . "</a>";
		}

		if($type == "comma")
			$ret = implode(", ", $list);
		else if($type == "list")
			$ret = "<ul><li>" . implode("</li><li>", $list) . "</li></ul>";

		return $ret;
	}

	function formatBegin()
	{
		global $CON;

		$CON = template_replace("INDEX_COMMA", $this->pagesList("comma"), $CON);
		$CON = template_replace("INDEX_LIST", $this->pagesList("list"), $CON);
	}
}