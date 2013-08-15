<?php
/*
 * SelectTemplate plugin, (c) Adam Zivner, adam.zivner@gmail.com, GPL'd
 *
 * This plugin creates a select box with available templates.
 *
 * It is actually just an interface to built-in LionWiki function:
 *
 * index.php?page=Whatever&template=my_template_of_choice.html
 *
 * Because this plugin is not really useful, it may be removed from official
 * distribution in future.
 */

class SelectTemplate
{
	var $desc = array(
		array("SelectTemplate", "creates select box in which you can choose template.")
	);

	var $tpls = array(
		"templates/dandelion.html" => "Dandelion",
		"templates/red.html" => "Red panel",
		"templates/minimal.html" => "Minimal",
		"templates/terminal.html" => "Green terminal",
		"templates/wikiss.html" => "WiKiss"
	);

	function template()
	{
		global $html, $page, $action, $TEMPLATE, $CON, $self;

		$select = "
<form action=\"$self\" method=\"get\">
<input type=\"hidden\" name=\"page\" value=\"" . h($page) . "\" />
<input type=\"hidden\" name=\"action\" value=\"" . h($action) . "\" />
<input type=\"hidden\" name=\"permanent\" value=\"1\" />
<select name=\"template\" id=\"selectTemplate\" onchange=\"this.form.submit();\">
";

		foreach($this->tpls as $t_file => $t_name) {
			$selected = $TEMPLATE == $t_file ? " selected " : "";

			$select .= "<option value=\"".h($t_file)."\"$selected>".h($t_name)."</option>\n";
		}

		$select .= "</select></form>\n";

		$html = template_replace("plugin:SELECT_TEMPLATE", $select, $html);
		$CON = template_replace("SELECT_TEMPLATE", $select, $CON);
	}

	function actionBegin()
	{
		global $TEMPLATE;

		if(!empty($_REQUEST["template"])) {
			$TEMPLATE_request = $_REQUEST["template"];

			if($_REQUEST["permanent"] == 1)
				setcookie('LW_TEMPLATE', $TEMPLATE_request, time() + 365 * 86400);
		}
		else if(!empty($_COOKIE["LW_TEMPLATE"]))
			$TEMPLATE_request = $_COOKIE["LW_TEMPLATE"];
		
		// verify $TEMPLATE (whitelisting) added by (as) 2012-01-08
		foreach(array_keys($this->tpls) as $t_file) {
			if ($t_file == $TEMPLATE_request) {
				$TEMPLATE = $TEMPLATE_request; 
				break;
			}
		}
	}
}