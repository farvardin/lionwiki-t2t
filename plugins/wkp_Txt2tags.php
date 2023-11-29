<?php
/**
 * * * Based on BetterEditor

 * BetterEditor is plugin for LionWiki which adds:
 * 1) toolbar with a few formatting buttons (bold, italics etc.)
 * 2) resizing arrows which allow to resize the textarea
 *
 * Both are used for classical editing, Ajax editing and comments.
 *
 * (c) 2009, Adam Zivner, <adam.zivner@gmail.com>. GPL'd
 */

class Txt2Tags
{
	var $desc = array(
		array("Txt2Tags", "is a converter from txt2tags to HTML.")
	);
	
	var $menu;
	var $strings = array();
	
	//function Txt2Tags()
	function __construct()
	{
		$this->localize();
		$this->menu =		
		/*
		'<div id="headerContainer">
		
			<a href="#" class="toggle"><span class="txt2tagsMenu" id="markItUp" title="MarkItUp">MarkItUp</span></a>

		<span class="txt2tagsMenu" id="displayPreview" onclick="previewCache()" title="'.$this->strings["TXT_PREVIEW"][1].'">'.$this->strings["TXT_PREVIEW"][0].'</span>
			<span class="txt2tagsMenu" id="synchronizeButton" onclick="switchSync()" title="'.$this->strings["TXT_SCROLL"][0].'">'.$this->strings["TXT_SCROLL"][0].'</span>
			<span class="txt2tagsMenu" id="displayPane" onclick="switchDisplay()" title="'.$this->strings["TXT_DISPLAY"][2].'">'.$this->strings["TXT_DISPLAY"][2].'</span>
			<span class="txt2tagsMenu" id="changeButton" onclick="switchPlace()" title="'.$this->strings["TXT_EXCHANGE"][1].'">'.$this->strings["TXT_EXCHANGE"][1].'</span>
			
		</div>';
		*/
		
			/* automatic translation isn't working anymore so we hardcode the default txt to english */
				
		'<div id="headerContainer">
		
			<a href="#" class="toggle"><span class="txt2tagsMenu" id="markItUp" title="Enable / Disable MarkItUp toolbar">MarkItUp</span></a>

		<span class="txt2tagsMenu" id="displayPreview" onclick="previewCache()" title="Enable / Disable Preview">Preview</span>
			<span class="txt2tagsMenu" id="synchronizeButton" onclick="switchSync()" title="Lock Scroll">Scroll</span>
			<span class="txt2tagsMenu" id="displayPane" onclick="switchDisplay()" title="Display preview panes below">Display</span>
			<span class="txt2tagsMenu" id="changeButton" onclick="switchPlace()" title="Swap panes">Swap</span>
			
		</div>';
		
	}
	
	function template()
	{
		global $action, $HEAD, $preview, $html, $PLUGINS_DIR;

		// we will load it in the supported templates only:
		//$HEAD .= '<link rel="stylesheet" href="'.$PLUGINS_DIR.'Txt2tags/txt2tagsjs.css" />';
		
		if($action == "edit" || $preview) {
			$html = template_replace("plugin:TXT2TAGS_TEXTAREA", $this->menu, $html);
		}
	}
	
	/* translation isn't working anymore*/
	
	var $en_strings = array(
		array("TXT_EXCHANGE", array("Exchange", "Exchange")),
		array("TXT_SCROLL", array("Synchronized scrolling")),
		array("TXT_DISPLAY", array("Display")),
		array("TXT_PREVIEW", array("Preview"))
		
	);
	
	var $fr_strings = array(
		array("TXT_EXCHANGE", array("Échange", "Échange")),
		array("TXT_SCROLL", array("Défilement synchronisé ")),
		array("TXT_DISPLAY", "Affichage"),
		array("TXT_PREVIEW", array("Aperçu"))
	);
	
	function localize()
	{
		global $LANG;

		foreach($this->en_strings as $str)
			$this->strings[$str[0]] = $str[1];

		if($LANG != "en" && isset($this->{$LANG . "_strings"}))
			foreach($this->{$LANG . "_strings"} as $str)
				$this->strings = $str[1];
				
	}
}
