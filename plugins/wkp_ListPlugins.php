<?php
/*
 * List plugins lists all active plugins and presents functions they offer. It creates
 * unordered (possibly nested) list of plugins and their functions.
 *
 * It is activated by ?action=listplugins
 */

class ListPlugins
{
	var $desc = array(
		array("ListPlugins", "provides this page :)")
	);

	// print nested functions/description
	function getUL($arr)
	{
		$ret = "";

		if(is_array($arr))
			foreach($arr as $line)
				if(is_array($line[0]))
					$ret .= "<ul>\n" . $this->getUL($line) . "</ul>\n";
				else
					$ret .= "<li>" . $line[0] . " " . $line[1] . "</li>\n";

		return $ret;
	}

	function action($a)
	{
		global $plugins, $CON, $TITLE, $editable;

		if($a == "listplugins") {
			$editable = false;
			$TITLE = "List of plugins";

			$CON = "<ul>\n";

			foreach($plugins as $p) {
				$CON .= $this->getUL($p->desc);

				$p = array();
			}

			$CON .= "</ul>\n";

			return true;
		}

		return false;
	}

	function template()
	{
		global $html, $self;

		$html = template_replace("plugin:LIST_OF_PLUGINS", "<a href=\"$self?action=listplugins\" rel=\"nofollow\">List of installed plugins</a>", $html);
	}
}