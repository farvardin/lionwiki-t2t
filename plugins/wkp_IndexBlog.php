<?php
/*
 * Written by Swen Wetzel <xanatoswetzel@web.de> for LionWiki, minor changes made by Adam Zivner
 * With {BLOG_COMMA} or {BLOG_LIST}, you can insert list of all pages into the page.
 * {BLOG_COMMA} gives you comma separated list, {BLOG_LIST} <ul> HTML list
 */

class IndexBlog
{
	var $desc = array(
		array("Blog Index plugin", "gives list of pages starting with 'blog_' in the wiki.")
	);

	function pagesListBlog($type)
	{
		global $self, $PG_DIR;

		$list = array();
        $blogheader = array();
        $line = array();

		$dir = opendir($PG_DIR);


		while($file = readdir($dir))
        {
			if(preg_match("/blog_.*\.txt$/", $file))
              { 
                $myfile = "var/pages/" . $file . "";
                $blogopen = fopen($myfile, "r");
                $blogheadline = fgets($blogopen) ;
                $blogRESUME = fread($blogopen,200) ;
                $fileDATE2 = substr($file, 5, 10 ) ;
                $blogcontents[] = "<h2><b>" . $fileDATE2 . "</b>b></h2>" . fread($blogopen, 200) ;
               // warning sinon: fclose($myfile);
			
            //$files[] = substr($file, 0, strlen($file) - 4) . " : " . "<b>" . $blogheadline . "</b>" . " <br/> &nbsp; &nbsp; <i>" . $blogRESUME . "<a href=\"index.php?page=".substr($file, 0, strlen($file) - 4) . "\">/.../</a>" . "</i><br/><br/>" ;
            
            //$files[] = substr($file, 0, strlen($file) - 4) . " : " . "<b>" . $blogheadline . "</b>" . " <br/> &nbsp; &nbsp; <i>" . $blogRESUME . "<a href=\"index.php?page=". "blog_" .$fileDATE2.  "\">/.../</a>" . "</i><br/><br/>" ;
            
            $files[] = substr($file, 0, strlen($file) - 4) . " : " . "<b>" . $blogheadline . "</b>" . " <br/> &nbsp; &nbsp; <i>" . $blogRESUME .  "&nbsp;/... /" . "</i><br/><br/>" ;
            
            //print_r($files);
            
            //foreach($files as $file) {                $blogcontents[] = $blogcontent;  }
            
            //$files[] = substr($file, 0, strlen($file) - 4) ;

            }
        }
        
		if(is_array($files)) {
			arsort($files);

			foreach($files as $file) {
                //$fileTITLE = implode ("", $filesTITLE) ;
                //$fileTITLE = substr($file, -16, strlen($file) ) ;
                $fileURL = substr($file, 0, 15 ) ;
                $fileDATE = substr($file, 5, 10 ) ;
                $fileTITLE = substr($file, 16) ;
                
                 $blogallcontents[] = "<br/><h2>" . $fileDATE . "</h2>" . fread($blogopen, 200) ;
                 
                //preg_match_all('/==[.*]==/', $fileTITLE, $mymatches);
                $TITLE = preg_replace("/=/", " ", $fileTITLE);
                
                    //$list[] = "<a href=\"$self?page=" . u($file) . "\">" . h($fileTITLE) . "</a>" . " ";   
                    //print_r($fileTITLE);
                    //print_r($TITLE);
                    $list[] = "<a href=\"$self?page=" . u($fileURL) . "\">" . h($fileDATE) . "</a> " . $TITLE;
                   // $list[] = "<a href=\"$self?page=" . u($fileURL) . "\">" . h($fileDATE) . "</a> " . "<a href=\"$self?page=" . u($fileURL) . "\">" .$TITLE. "</a> ";
                
                 //$myfile = "var/pages/" . $file . "";
                 //sort($myfile, SORT_NATURAL);
                $blogopen = fopen($myfile, "r");
                $blogcontent2 = fread($blogopen, 200) ;
                //print_r($blogcontent2);
                //$blogcontent = implode("<br/><br/><br/>", $blogcontents);
                
                  $readmore[] = "<br/><h2>" . $fileDATE . "</h2>" . $blogcontent2. "<a href=\"$self?page=" . u($fileURL) . "\">" . "<i>lire plus... </i>" . "</a> "  ;
                    
                        }
            }

		if($type == "comma")
			$ret = implode(" -, ", $list) ; //. implode("", $blogheadline ) ;
            
            
		else if($type == "list")
			$ret = "<ul><li>" . implode("</li><li>", $list) ;//. " " . implode(": ", $blogheadlineTEST) . "</li></ul>";

		else if($type == "includeall")
            $ret = "<ul><li>" . implode("</li><li>", $list) ; // . " " . implode(": ", $blogRESUME) . "</li></ul>";
        /*
        {
            //print_r($blogcontents);
            
            $blogcontent = implode(" /.../ <br/><br/><br/>", $blogcontents);
            $allincluded[] =  $blogcontent ;
            
			$ret = implode("", $allincluded ) ;
        }
*/


        
		return $ret;
	}

	function formatBegin()
	{
		global $CON;

		$CON = template_replace("BLOG_COMMA", $this->pagesListBlog("comma"), $CON); // NOT WORKING YET
		$CON = template_replace("BLOG_LIST", $this->pagesListBlog("list"), $CON);
        $CON = template_replace("BLOG_INCLUDE_ALL", $this->pagesListBlog("includeall"), $CON); // NOT WORKING YET
	}
}
