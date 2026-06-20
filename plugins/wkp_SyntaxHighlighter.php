<?php
/*
 * SyntaxHighlighter plugin is a integrating plugin to the powerful GeSHI syntax highlighter.
 *
 * As of 13. 9. 2009 it is:
 * - stable and functioning
 * - not very configurable (given the awesome possibilities of GeSHI)
 * - caching - GeSHI is quite slow, so we use caching of generated HTML code
 * - trimmed. GeSHI contains by default a huge number of languages, most of them are obscure and have little practical
 * use. If this plugin does not contain support for you language of choice, check GeSHI website, it's quite possible
 * that it's part of the official release but I didn't include it here. Then simply copy language file to plugins/SyntaxHighlighter/
 * and it's gonna work.
 *
 * Not part of LionWiki official distribution, must be downloaded separately.
 * Homepage: http://lionwiki.0o.cz/index.php?page=UserGuide%3A+SyntaxHighlighter+plugin
 *
 * (c) Adam Zivner 2009, adam.zivner@gmail.com, GPL'd
 *
 * GeSHI copyright:
 * (c) 2004-2007 Nigel McNie,
 * (c) 2007-2008 Benny Baumann
 * (c) 2008 Milian Wolff
 */
class SyntaxHighlighter
{
	/*
	 * Firefox and other gecko based browsers contains bug which makes copy and paste of code with line numbers unusable.
	 * There are three possible workarounds:
	 * - ignore firefox :)
	 * - turn off line_numbers
	 * - provide $plain_text_link which contains link to "almost plain text" version of the code which is possible
	 * to copy&paste in firefox.
	 */

	var $line_numbers = true;
	var $language_name = true; // language name in the footer
	var $plain_text_link = true; // link to the plain text version, for usable copy&paste in FF with line numbers turned on

	var $version = "1.1.2";
	var $n_codes = 0;
	var $codes = array(); // sinon propriete dynamique, depreciee en PHP 8.2

	var $desc = array(
		array("SyntaxHighlighter plugin", "plugin provides syntax highlighting for a lot of programming languages. Syntax: {source php} echo 'This is my code!'; {/source}.")
	);

	function subPagesLoaded()
	{
		global $CON;

		/*
		 * We must put aside the source codes to "protect them" from being interpreted and formatted by LionWiki core.
		 * After LionWiki does its job, we'll substitute it back (in formatEnd() method).
		 */

		$this->n_codes = preg_match_all("/(?<!\^)(\{syntax (.+)\}(.+)\{\/syntax\})/Ums", $CON, $arr, PREG_SET_ORDER);

		foreach($arr as $code) {
			$this->codes[md5(trim($code[3]))] = $code;
			$CON = str_replace($code[1], "{SYNTAX}", $CON);
		}

		if(!empty($_GET["plaincode"])) // "almost plain text"
			die("<pre>" . h($this->codes[$_GET["hash"] ?? ""][3] ?? "") . "</pre>");
	}

	function formatEnd()
	{
		global $CON, $PLUGINS_DIR, $PLUGINS_DATA_DIR, $page, $self;

		if($this->n_codes > 0) {
			include_once $PLUGINS_DIR . 'SyntaxHighlighter/geshi.php';

			$cache_dir = $PLUGINS_DATA_DIR . '/SyntaxHighlighter';

			// Check existence of SyntaxHighlighter cache directory
			if(!file_exists($cache_dir))
				mkdir($cache_dir, 0777);

			foreach($this->codes as $code) {
				$language = $code[2];
				$source = trim($code[3]);

				$hash = md5($source);
				$cached_file_path = $cache_dir . "/" . $hash . ".html";

				// Is code cached?
				if(file_exists($cached_file_path)) // Yeah, just use the cached one
					$html = file_get_contents($cached_file_path);
				else { // code is not cached, need to generate it
					$geshi = new GeSHi($source, $language);

					// Here you can play with various GeSHI configuration possibilities, see http://qbnz.com/highlighter/geshi-doc.html

					$geshi->set_header_type(GESHI_HEADER_PRE);

					if($this->line_numbers)
						$geshi->enable_line_numbers(GESHI_NORMAL_LINE_NUMBERS);

					if($this->language_name || $this->plain_text_link) {
						$header_template = '<div style="float: right;">';

						if($this->language_name)
							$header_template .= "{LANGUAGE} ";

						if($this->plain_text_link)
							$header_template .= '(<a href="'.$self.'?page='.u($page).'&amp;plaincode=1&amp;hash='.$hash.'">plain</a>)';

						$header_template .= '</div>';

						$geshi->set_header_content($header_template);
					}
					
					$html = $geshi->parse_code();

					$cached = fopen($cached_file_path, 'w');
					fwrite($cached, $html);
					fclose($cached);
				}

				// callback : $html insere litteralement (preg_replace interpreterait $N/backref dans le code colore)
				$CON = preg_replace_callback("/{SYNTAX}/Us", function() use ($html) { return $html; }, $CON, 1);
			}
		}
	}
}