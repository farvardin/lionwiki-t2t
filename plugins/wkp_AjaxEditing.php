<?php
/*
 * AjaxEditing plugin for LionWiki, licensed under GNU/GPL
 *
 * (c) Adam Zivner 2009 adam.zivner@gmail.com, GPL'd
 */

class AjaxEditing
{
	var $desc = array(
		array("AjaxEditing", "Guess what. AJAX editing :)")
	);

	/*
	 * Number of rows of edit textarea reflects number of lines of edited paragraphs.
	 * Too big or too small edit textarea wouldn't be good, so here are the limits:
	 */

	var $rows_min = 3;
	var $rows_max = 20;

	/*
	 * Substitute edit template
	 */

	function formatFinished()
	{
		global $CON, $content, $self, $showsource, $page, $esum, $error, $preview, $action, $html;
		global $T_PASSWORD, $T_EDIT_SUMMARY, $T_PREVIEW, $T_DONE, $T_DISCARD_CHANGES;

		if(!$_REQUEST["ajax"])
			return;
		else if($action != "edit" && !$preview) {
			$CON = substr($CON, strpos($CON, ">") + 1); // $CON contains <div class="pre-div"> ... </div> and we don't want this "wrapper"
			$CON = substr($CON, 0, strlen($CON) - 6);

			die($CON);
		}

		$rows = count(explode("\n", $CON));

		if($this->rows_min > $rows)
			$rows = $this->rows_min;
		else if($this->rows_max < $rows)
			$rows = $this->rows_max;

		if(!authentified() && !$showsource) { // if not logged on, require password
			$FORM_PASSWORD = $T_PASSWORD;
			$FORM_PASSWORD_INPUT = "<input class=\"ajaxPasswordInput\" type=\"password\" name=\"sc\" />";
		}


		$CON_FORM_BEGIN = "<form action=\"$self\" class=\"ajaxForm\" method=\"post\"><input type=\"hidden\" name=\"action\" value=\"save\" /><input class=\"ajaxShowSource\" type=\"hidden\" name=\"showsource\" value=\"$showsource\" />";

		$CON_FORM_END = "</form>";

		$CON_TEXTAREA = "<textarea name=\"content\" class=\"ajaxContentTextarea contentTextarea\" cols=\"83\" rows=\"$rows\">" . h($content ? $content : $CON) . "</textarea><input type=\"hidden\" id=\"ajaxPage\" name=\"page\" value=\"".h($page)."\" />";

		if(!$showsource) {
			$CON_SUBMIT = "<input class=\"submit ajaxContentSubmit\" onclick=\"ajaxAction('save', this);return false;\" type=\"submit\" value=\"$T_DONE\" />";

			$EDIT_SUMMARY_TEXT = $T_EDIT_SUMMARY;
			$EDIT_SUMMARY = "<input type=\"text\" name=\"esum\" class=\"ajaxEsum\" value=\"".h($esum)."\" />";
		}

		$CON_PREVIEW = "<input class=\"ajaxContentPreview\" class=\"submit\" onclick=\"ajaxAction('save&preview=1', this);return false;\" type=\"submit\" name=\"preview\" value=\"$T_PREVIEW\" /> <input type=\"submit\" onclick=\"ajaxAction('', this);return false;\" value=\"$T_DISCARD_CHANGES\" />";

		$subs = array(
			array("CONTENT_FORM", $CON_FORM_BEGIN),
			array("\/CONTENT_FORM", $CON_FORM_END),
			array("CONTENT_TEXTAREA", $CON_TEXTAREA),
			array("FORM_PASSWORD", $FORM_PASSWORD),
			array("FORM_PASSWORD_INPUT", $FORM_PASSWORD_INPUT),
			array("EDIT_SUMMARY_TEXT", $EDIT_SUMMARY_TEXT),
			array("EDIT_SUMMARY_INPUT", $EDIT_SUMMARY),
			array("CONTENT_SUBMIT", $CON_SUBMIT),
			array("CONTENT_PREVIEW", $CON_PREVIEW),
			array("ERROR", $error)
		);

		$html = @file_get_contents($GLOBALS["PLUGINS_DIR"]."/AjaxEditing/template.html");

		plugin("template"); // plugin specific template substitutions

		foreach($subs as $s)
			$html = template_replace($s[0], $s[1], $html);

		$html = preg_replace("/\{([^}]* )?plugin:.+( [^}]*)?\}/U", "", $html); // getting rid of absent plugin tags

		die(($preview ? $CON : "") . $html);
	}

	function pageWritten()
	{
		global $CON;

		if($_REQUEST["ajax"]) {
			$CON = $_REQUEST["content"];

			return true;
		}
		else
			return false;
	}

	function formatBegin()
	{
		$GLOBALS["HEAD"] .= '<script type="text/javascript" src="'.$GLOBALS['PLUGINS_DIR'].'/AjaxEditing/ajax.js"></script>';
	}
}