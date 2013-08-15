<?php
/*
 * SelectLanguage plugin for LionWiki, (c) Adam Zivner, adam.zivner@gmail.com, GPL'd
 *
 * This plugin produces select box with (more or less arbitrary) list of languages.
 * Although LionWiki has a built-in detection of user's language, there are cases
 * in which LionWiki's choice is wrong. This plugin allows user to change
 *
 * LionWiki's language. This affects two things:
 * - interface language (if available)
 * - page version (in case that there are more language variants of the same page)
 *
 * This is actually just an interface to built-in LionWiki function:
 *
 * index.php?page=Whatever&lang=cs
 */

class SelectLanguage
{
	var $desc = array(
		array("SelectLanguage", "creates select box in which you can choose language.")
	);

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
		global $self, $html, $LANG, $LANG_DIR, $CON, $action, $page;

		$langs = array();

		if(is_dir($LANG_DIR) && ($dir = opendir($LANG_DIR))) // common plugins
			while(($file = readdir($dir)) !== false)
				if(!is_dir($LANG_DIR . $file))
					$langs[] = basename($file, ".php");

		sort($langs);

		$select = "
<form action=\"$self\" id=\"formSelectLanguage\" method=\"get\">
<input type=\"hidden\" name=\"page\" value=\"" . basename($page, ".$LANG") . "\" />
<input type=\"hidden\" name=\"action\" value=\"" . h($action) . "\" />
<select name=\"lang\" id=\"selectLanguage\" onchange=\"this.form.submit();\">
";

		foreach($langs as $l) {
			$selected = $l == $LANG ? " selected=\"selected\" " : "";

			$select .= "<option value=\"".h($l)."\"$selected>" . h($this->lang_names[$l]) . "</option>\n";
		}

		$select .= "</select></form>\n";

		$html = template_replace("plugin:SELECT_LANGUAGE", $select, $html);
		$CON = str_replace("{SELECT_LANGUAGE}", $select, $CON);
	}
}