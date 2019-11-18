<?php
/**
 * Extended image functions plugin for LionWiki, (c) 2009, 2010 Adam Zivner, GPL'd
 */

class ImageExt
{
	var $desc = array(
		array("ImageExt plugin", "provides advanced image functions.")
	);

	var $dir;
	var $quality = 85;
	var $imgs = array();

	function ImageExt()
	{
		$this->dir = $GLOBALS["VAR_DIR"] . "images/";
	}

	function formatBegin()
	{
		global $CON;

		preg_match_all("#\[((https?://|\./)[^|\]\"]+\.(jpeg|jpg|gif|png))(\|[^\]]+)?\]#", $CON, $this->imgs, PREG_SET_ORDER);

		foreach($this->imgs as $img)
			$CON = str_replace($img[0], "{IMAGE}", $CON);
	}

	function formatEnd()
	{
		global $CON, $self;
		
		foreach($this->imgs as $img) {
			$link = $i_attr = $a_attr = $alt = $center = $tag = $style = "";
			$width = $height = 0;

			preg_match_all("/\|([^\]\|=]+)(=([^\]\|\"]+))?(?=[\]\|])/", $img[0], $options, PREG_SET_ORDER);
						
			foreach($options as $o)
				if($o[1] == "center") $center = true;
				else if($o[1] == "right" || $o[1] == "left") $style .= "float:$o[1];";
				else if($o[1] == "link") $link = (substr($o[3], 0, 4) == "http" || substr($o[3], 0, 2) == "./") ? $o[3] : "$self?page=" . u($o[3]);
				else if($o[1] == "alt") $alt = h($o[3]);
				else if($o[1] == "title") $a_attr .= ' title="'.h($o[3]).'"';
				else if($o[1] == "width") $width = (int) $o[3];
				else if($o[1] == "height") $height = (int) $o[3];
				else if($o[1] == "class") $i_attr .= " class=\"$o[3]\"";
				else if($o[1] == "id") $i_attr .= " id=\"$o[3]\"";
				else if($o[1] == "style") $style .= "$o[3];";
				else if($o[1] == "noborder") $style .= "border:0;outline:0;";
				else if($o[1] == "thumb") $link = $img[1];

			if($width || $height)
				$img[1] = $this->scaleImage($img[1], $width, $height);

			$tag = "<img src=\"$img[1]\" alt=\"".$alt."\" style=\"$style\"$i_attr/>";

			if($link)   $tag = "<a href=\"$link\"$a_attr>$tag</a>";
			if($center) $tag = "<div style=\"text-align:center\">$tag</div>";

			$CON = preg_replace("/\{IMAGE\}/", $tag, $CON, 1);
		}
	}
	
	function rstrtrim($str, $remove)
	{
		$len = strlen($remove);
		$offset = strlen($str) - $len;

		while($offset > 0 && $offset == strpos($str, $remove, $offset))
		{
			$str = substr($str, 0, $offset);
			$offset = strlen($str) - $len;
		}

		return rtrim($str);
	}

	function pathToFilename($path, $x, $y)
	{
		if(substr($path, 0, 7) == "http://")
			$path = substr($path, 7);
		else if(substr($path, 0, 8) == "https://")
			$path = substr($path, 8);

		$path = clear_path($path);
		
		$ext = substr($path, -4);

		if(!strcasecmp($ext, ".png") || !strcasecmp($ext, ".gif") || !strcasecmp($ext, ".jpe"))
			$path = substr($path, 0, -4);

		if(!strcasecmp($ext, ".jpeg") || !strcasecmp($ext, ".jfif"))
			$path = substr($path, 0, -5);

		$path = str_replace(array("/", ".", ":"), "_", $path);

		return $path . "-{$x}x{$y}.jpg";
	}

	function scaleImage($path, $nx, $ny)
	{
		if(!file_exists($this->dir))
			mkdir(rtrim($this->dir, "/"), 0777);

		if(substr($path, 0, 2) == "./")
			$path = ($_SERVER["HTTPS"] ? "https://" : "http://") . $_SERVER["HTTP_HOST"] . ":" . $_SERVER["SERVER_PORT"] . dirname($_SERVER["REQUEST_URI"]) . '/' . substr($path, 2);

		$filename = $this->pathToFilename($path, $nx, $ny);

		if(!file_exists($this->dir . $filename)) {
			if(!strcasecmp(substr($path, -4), ".png"))
				$img = imagecreatefrompng($path);
			else if(!strcasecmp(substr($path, -4), ".gif"))
				$img = imagecreatefromgif($path);
			else if(!strcasecmp(substr($path, -4), ".jpg") || !strcasecmp(substr($path, -5), ".jpeg") || !strcasecmp(substr($path, -4), ".jpe"))
				$img = imagecreatefromjpeg($path);

			$ox = imagesx($img);
			$oy = imagesy($img);

			if($nx && !$ny)
				$ny = (int) ($oy * $nx / $ox);
			else if(!$nx && $ny)
				$nx = (int) ($ox * $ny / $oy);

			$thumb = imagecreatetruecolor($nx, $ny);

			imagecopyresampled($thumb, $img, 0, 0, 0, 0, $nx, $ny, $ox, $oy);

			imagejpeg($thumb, $this->dir . $filename, $this->quality);
		}

		return "./" . $this->dir . $filename;
	}

}