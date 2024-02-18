<?php
/*
 * Written by Swen Wetzel <xanatoswetzel@web.de> for LionWiki, minor changes made by Adam Zivner
 * With {INDEX_COMMA} or {INDEX_LIST}, you can insert list of all pages into the page.
 * {INDEX_COMMA} gives you comma separated list, {INDEX_LIST} <ul> HTML list
 */

class Index
{
    var $desc = array(
    array("Index plugin", "gives list of pages in the wiki.")
    );

    function pagesList($type)
    {
        global $self, $PG_DIR;

        $list = array();

        $dir = opendir($PG_DIR);

        while($file = readdir($dir)) {
            if(preg_match("/\.txt$/", $file)) {
                $files[] = substr($file, 0, strlen($file) - 4);
            }
        }

        if(is_array($files)) {
            sort($files);

            foreach($files as $file) {
                
                // green
                if(preg_match("/#CG#/", $file)) { 
                     $myfilename = preg_replace("/(\w+)#C(\w+)#/", '$1', $file);
                     $list[] = "<span style='background-color:#c7ecc1;'><a href=\"$self?page=" . u($file) . "\">" . h($myfilename) . "</a></span>";    
                }
                // blue
                elseif(preg_match("/#CB#/", $file)) {
                    $myfilename = preg_replace("/(\w+)#C(\w+)#/", '$1', $file);
                    $list[] = "<span style='background-color:#c1dfec;'><a href=\"$self?page=" . u($file) . "\">" . h($myfilename) . "</a></span>";    
                }
                // red
                elseif(preg_match("/#CR#/", $file)) { 
                    $myfilename = preg_replace("/(\w+)#C(\w+)#/", '$1', $file);
                    $list[] = "<span style='background-color:#ecb8b8;'><a href=\"$self?page=" . u($file) . "\">" . h($myfilename) . "</a></span>";    
                }
                // yellow
                elseif(preg_match("/#CY#/", $file)) {
                      $myfilename = preg_replace("/(\w+)#C(\w+)#/", '$1', $file);
                      $list[] = "<span style='background-color:#eceab6;'><a href=\"$self?page=" . u($file) . "\">" . h($myfilename) . "</a></span>";    
                }
                // magenta
                elseif(preg_match("/#CM#/", $file)) {
                    $myfilename = preg_replace("/(\w+)#C(\w+)#/", '$1', $file);
                    $list[] = "<span style='background-color:#ec9bc5;'><a href=\"$self?page=" . u($file) . "\">" . h($myfilename) . "</a></span>";    
                }
                // violet
                elseif(preg_match("/#CV#/", $file)) {
                    $myfilename = preg_replace("/(\w+)#C(\w+)#/", '$1', $file);
                    $list[] = "<span style='background-color:#ba96ec;'><a href=\"$self?page=" . u($file) . "\">" . h($myfilename) . "</a></span>";    
                }        
                // orange
                elseif(preg_match("/#CV#/", $file)) {
                    $myfilename = preg_replace("/(\w+)#C(\w+)#/", '$1', $file);
                    $list[] = "<span style='background-color:#ecbe9d;'><a href=\"$self?page=" . u($file) . "\">" . h($myfilename) . "</a></span>";    
                }        
                
                elseif(preg_match("/#C(\w+)#/", $file)) { 
                    $mycolor = preg_replace("/[^*.]+#C(\w+)#/", '$1', $file);
                    $myfilename = preg_replace("/(\w+)#C(\w+)#/", '$1', $file);
                    $list[] = "<span style='background-color:#" . $mycolor . ";'><a href=\"$self?page=" . u($file) . "\">" . h($myfilename) . "</a></span>";    
                }
                
                else
                {
                    $list[] = "<a href=\"$self?page=" . u($file) . "\">" . h($file) . "</a>";
                }
            }
        }

        if($type == "comma") {
            $ret = implode(", ", $list);
        } else if($type == "list") {
            $ret = "<ul><li>" . implode("</li><li>", $list) . "</li></ul>";
        }

        return $ret;
    }

    function formatBegin()
    {
        global $CON;

        $CON = template_replace("INDEX_COMMA", $this->pagesList("comma"), $CON);
        $CON = template_replace("INDEX_LIST", $this->pagesList("list"), $CON);
    }
}

