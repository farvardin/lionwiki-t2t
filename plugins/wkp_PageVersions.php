<?php
/*
 * PageVersions is a LionWiki plugin which tries to find other language versions of current page.
 *
 * Example: "Syntax.en" and Syntax or "Syntax.en" and "Syntax.de" are language variants of the
 * same page.
 *
 * Plugin supports both bulleted list of versions and simple comma separated list.
 *
 * It can be used in both template ({plugin:VERSIONS} and {plugin:VERSIONS_LIST}) and in page content ({VERSIONS} and {VERSIONS_LIST})
 *
 * (c) Adam Zivner 2008, 2009, adam.zivner@gmail.com, GPL'd
 */

class PageVersions
{
	var $desc = array(
		array("PageVersions", "provides list of language versions of current article.")
	);

	var $default_lang = "en"; // what language is it if no lang code is given?

	var $lang_names = array(
		"ar" => "العربية",
		"bg" => "Български",
		"ca" => "Català",
		"cs" => "Čeština",
		"de" => "Deutsch",
		"de-ch" => "Schweizerdeutsch",
		"da" => "Dansk",
		"en" => "English",
		"eo" => "Esperanto",
		"es" => "Español",
		"fi" => "Suomi",
		"fr" => "Français",
		"he" => "עברית",
		"hr" => "Hrvatski",
		"hu" => "Magyar",
		"it" => "Italiano",
		"nl" => "Nederlands",
		"pl" => "Polski",
		"pt" => "Português",
		"pt-br" => "Português brasileiro",
		"ro" => "Română",
		"ru" => "Русский",
		"sk" => "Slovenština",
		"sv" => "Svenska",
		"uk" => "Українська",
		"zh-tw" => "臺灣國語"
	);

	function template()
	{
		global $CON, $html, $page, $PG_DIR, $action, $self;

		if(!empty($action))
			return;

		if(($pos = strpos($page, ".")) !== false)
			$p = preg_quote(substr($page, 0, $pos));
		else
			$p = preg_quote($page);

		$versions = array();

		if($dir = @opendir($PG_DIR))
			while($file = readdir($dir))
				if(preg_match("/$p\.([a-z\-]+)\.txt|$p\.txt/", $file, $match))
					$versions[isset($match[1]) ? $match[1] : $this->default_lang] = $p;

		ksort($versions);

		if(count($versions) == 1)
			array_pop($versions);

		$arr_versions = array();

		foreach($versions as $code => $art)
			$arr_versions[] = "<a href=\"$self?page=".u(basename($art, ".txt") . ".$code")."\">".h(trim($this->lang_names[$code]))."</a>";

		if(!empty($arr_versions))
			$ul_list = "<ul class=\"subpage\"><li>\n" . implode("</li><li>\n", $arr_versions) . "</li></ul>";

		$CON = template_replace("VERSIONS", $ul_list, $CON);
		$html = template_replace("plugin:VERSIONS", $ul_list, $html);

		if(!empty($arr_versions))
			$p_list = implode(", ", $arr_versions);

		$CON = template_replace("VERSIONS_LIST", $p_list, $CON);
		$html = template_replace("plugin:VERSIONS_LIST", $p_list, $html);
	}
}