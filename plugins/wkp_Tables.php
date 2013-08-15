<?php
/*
 * Tables - plugin providing flexible and powerful syntax for tables
 *
 * Programmed by TigerWiki and WiKiss programmers, thanks to them.
 * (the only piece of LionWiki practically unmodified from WiKiss)
 */

class Tables {
	var $desc = array(
		array("Tables", "provides flexible and powerful syntax. Help how to use it is located <a href=\"http://lionwiki.0o.cz/index.php?page=UserGuide%3A+Tables+plugin\">here</a>.")
	);

	function table_style($s)
	{
		$r = '';
		$st = '';

		if(strpos($s, 'h') !== FALSE)
			$r .= ' class="em"';

		if(strpos($s, 'l') !== FALSE)
			$st .= 'text-align: left; ';
		elseif(strpos($s, 'r') !== FALSE)
			$st .= 'text-align: right; ';

		if(strpos($s, 't') !== FALSE)
			$st .= 'vertical-align: top; ';
		elseif(strpos($s, 'b') !== FALSE)
			$st .= 'vertical-align: bottom; ';

		return $r . ($st ? ' style="' . $st . '"' : '');
	}

	function make_table($s)
	{
		global $matches_links;
		// Suppression des espaces en debut et fin de ligne
		//~ $s = trim($s);
		// on enleve les liens contenants |
		$regex = "/\[([^]]+\|.+)\]/Ums";
		$nblinks = preg_match_all($regex, $s, $matches_links);
		$s = preg_replace($regex, "[LINK]", $s);
		// Double |
		$s = str_replace('|', '||', $s);

		// Create rows first
		$s = preg_replace('/^\s*\|(.*)\|\s*$/m', '<tr>$1</tr>', $s);
		$s = str_replace("\n", "", $s);

		// Creation des <td></td> en se servant des |
		$s = preg_replace('/\|(([hlrtb]* ){0,1})\s*(\d*)\s*,{0,1}(\d*)\s*(.*?)\|/e', '"<td".("$3"?" colspan=\"$3\"":" ").("$4"?" rowspan=\"$4\"":" ").$this->table_style("$1").">$5</td>"', $s);

		if($nblinks > 0)
			$s = preg_replace_callback(array_fill(0, $nblinks, "/\[LINK\]/"), create_function('$m', 'global $matches_links;static $idxlink=0;return "[".$matches_links[1][$idxlink++]."]";'), $s);

		return stripslashes($s);
	}

	function formatBegin()
	{
		global $CON;

		$CON = preg_replace("/((^ *\|[^\n]*\| *$\n)+)/me", '"<table class=\"wikitable\">".stripslashes($this->make_table("$1"))."</table>\n"', $CON);
	}
}