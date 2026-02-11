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
 * 
 * 2024 Farvardin
 */

class SelectTemplate
{
    var $desc = array(
    array("SelectTemplate", "creates select box in which you can choose template.")
    );

    var $tpls = array(
    "templates/bootstrap/bootstrap.html" => "Bootstrap",
    "templates/minimaxing/minimaxing.html" => "Minimaxing",
    "templates/minimaxing/minimaxing_links.html" => "Minimaxing links",
    "templates/ggp/ggp.html" => "GGP",
    "templates/newspaper/newspaper.html" => "Newspaper",
    "templates/ElectricObsidian/ElectricObsidian.html" => "ElectricObsidian",
    "templates/literature/literature.html" => "Literature",
    "templates/red.html" => "Red panel",
    "templates/dandelion.html" => "Dandelion",
    "templates/minimal.html" => "Minimal",
    "templates/sissou.html" => "Sissou",
    "templates/geek/geek.html" => "Geek",
    "templates/terminal/terminal.html" => "New terminal",
    "templates/terminal_green.html" => "Green terminal",
    "templates/terminal_white.html" => "White terminal",
    "templates/blazekiss/blazekiss.html" => "Blazekiss",
    "templates/lagrange/lagrange.html" => "Lagrange",
    "templates/light.html" => "Light",
    "templates/simple.html" => "Simple",
    "templates/simple2.html" => "Simple 2",
    "templates/the-monospace-web.html" => "The monospace Web",
    "templates/cafe.html" => "Cafe",
    "templates/brut/brut.html" => "Brut",
    "templates/paper/paper.html" => "Paper",
    "templates/mimoza/mimoza.html" => "Mimoza",
    "templates/txt2tags/txt2tags.html" => "txt2tags",
    "templates/upload.html" => "Upload",
    "templates/gopher.html" => "Gopher",
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

            if($_REQUEST["permanent"] == 1) {
                setcookie('LW_TEMPLATE', $TEMPLATE_request, time() + 365 * 86400);
            }
        }
        else if(!empty($_COOKIE["LW_TEMPLATE"])) {
            $TEMPLATE_request = $_COOKIE["LW_TEMPLATE"];
        }
        
        // verify $TEMPLATE (whitelisting) added by (as) 2012-01-08
        foreach(array_keys($this->tpls) as $t_file) {
            if (isset($TEMPLATE_request) && $t_file == $TEMPLATE_request ) {
                $TEMPLATE = $TEMPLATE_request; 
                break;
            }
        }
    }
}
