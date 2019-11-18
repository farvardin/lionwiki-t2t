<?php
/*
 * Plugin for fixing backlinks to just renamed pages.
 * It supports two link types:
 * - classic - [Title|PageName#paragraph]
 * - image link [Image.jpg|link=PageName#Paragraph]
 *
 * (c) Adam Zivner 2010 adam.zivner@gmail.com, GPL'd
 */

class RenameFix {
	var $desc = array(
		array("RenameFix", "fixes links pointing to moved page.")
	);

	function pageWritten()
	{
		global $moveto, $PG_DIR;

		// page is already set to $moveto, we need to take original page name from the request
		$orig_name = clear_path($_REQUEST["page"]);

		if(!$moveto || $moveto == $orig_name) // page was not moved, nothing to do
			return;

		for($dir = opendir($PG_DIR); $f = readdir($dir);) {
			$content = @file_get_contents($PG_DIR . $f);

			// "classic" link
			$changed = preg_replace("/\[(([^|\]]+)\|)?" . preg_quote($orig_name, '/') . "(#([^\]]+))?\]/", "[${1}$moveto$3]", $content);
			// image link
			$changed = preg_replace("/\[([^]]*)\|link=\s*" . preg_quote($orig_name, '/') . "(#([^\]]+))?([|\]])/", "[$1|link=$moveto$2$4", $changed);
			// redirect
			$changed = preg_replace("/{redirect:\s*" . preg_quote($orig_name, '/') . "([^}]*)}/", "{redirect:$moveto$1}", $changed);

			if($changed != $content) {
				$h = fopen($PG_DIR . $f, 'w');
				fwrite($h, $changed);
				fclose($h);
			}
		}
	}
}