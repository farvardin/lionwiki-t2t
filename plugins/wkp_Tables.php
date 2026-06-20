<?php
/*
 * Tables - plugin providing flexible and powerful syntax for tables
 *
 * Programmed by TigerWiki and WiKiss programmers, thanks to them.
 * (the only piece of LionWiki practically unmodified from WiKiss)
 */

class Tables
{
    var $desc = array(
    array("Tables", "provides flexible and powerful syntax. Help how to use it is located <a href=\"http://lionwiki.0o.cz/index.php?page=UserGuide%3A+Tables+plugin\">here</a>.")
    );

    function table_style($s)
    {
        $r = '';
        $st = '';

        if(strpos($s, 'h') !== false) {
            $r .= ' class="em"';
        }

        if(strpos($s, 'l') !== false) {
            $st .= 'text-align: left; ';
        } elseif(strpos($s, 'r') !== false) {
            $st .= 'text-align: right; ';
        }

        if(strpos($s, 't') !== false) {
            $st .= 'vertical-align: top; ';
        } elseif(strpos($s, 'b') !== false) {
            $st .= 'vertical-align: bottom; ';
        }

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
        $s = preg_replace_callback(
            '/\|(([hlrtb]* ){0,1})\s*(\d*)\s*,{0,1}(\d*)\s*(.*?)\|/',
            function ($m) {
                return "<td".($m[3]?" colspan=\"$m[3]\"":" ").("$m[4]"?" rowspan=\"$m[4]\"":" ").Tables::table_style("$m[1]").">$m[5]</td>"; 
            }, $s
        );

        if($nblinks > 0) {
            // preg_replace_callback remplace déjà les [LINK] de gauche à droite
            // en un seul passage : pas besoin de array_fill ni de create_function
            // (supprimé en PHP 8.0).
            $idxlink = 0;
            $s = preg_replace_callback("/\[LINK\]/", function ($m) use (&$idxlink) {
                global $matches_links;
                return "[".$matches_links[1][$idxlink++]."]";
            }, $s);
        }

        return stripslashes($s);
    }

    function formatBegin()
    {
        global $CON;

        $CON = preg_replace_callback(
            "/((^ *\|[^\n]*\| *$\n)+)/m", function ($m) {
                return "<table class=\"wikitable\">".stripslashes(Tables::make_table($m[1]))."</table>\n"; 
            }, $CON
        );
    }
}