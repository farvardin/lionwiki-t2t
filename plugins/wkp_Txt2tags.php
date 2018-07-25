<?php

class Txt2Tags
{
	var $desc = array(
		array("Txt2Tags", "is a converter from txt2tags to HTML.")
	);
	
	var $menu;
	
	function Txt2Tags()
	{
		$this->localize();
		$this->menu =
		'<div id="headerContainer">
		
			<a href="#" class="toggle"><span class="txt2tagsMenu" id="markItUp" title="MarkItUp">MarkItUp</span></a>
			<span class="txt2tagsMenu" id="displayPreview" onclick="previewCache()" title="'.h($this->TXT_PREVIEW).'">'.h($this->TXT_PREVIEW).'</span>
			<span class="txt2tagsMenu" id="synchronizeButton" onclick="switchSync()" title="'.h($this->TXT_SCROLL).'">'.h($this->TXT_SCROLL).'</span>
			<span class="txt2tagsMenu" id="displayPane" onclick="switchDisplay()" title="'.h($this->TXT_DISPLAY).'">'.h($this->TXT_DISPLAY).'</span>
			<span class="txt2tagsMenu" id="changeButton" onclick="switchPlace()" title="'.h($this->TXT_EXCHANGE).'">'.h($this->TXT_EXCHANGE).'</span>
			
		</div>';
	}
	
	function template()
	{
		global $action, $HEAD, $preview, $html, $PLUGINS_DIR;

		$HEAD .= '<link rel="stylesheet" href="'.$PLUGINS_DIR.'Txt2tags/txt2tagsjs.css" />';
		
		if($action == "edit" || $preview) {
			$html = template_replace("plugin:TXT2TAGS_TEXTAREA", $this->menu, $html);
		}
	}
	
	var $en_strings = array(
		array("TXT_EXCHANGE", "Exchange"),
		array("TXT_SCROLL", "Synchronized scrolling"),
		array("TXT_DISPLAY", "Display"),
		array("TXT_PREVIEW", "Preview")
		
	);
	
	var $fr_strings = array(
		array("TXT_EXCHANGE", "Echange"),
		array("TXT_SCROLL", "Défilement synchronisé "),
		array("TXT_DISPLAY", "Affichage"),
		array("TXT_PREVIEW", "Aperçu")
	);
	
	function localize()
	{
		global $LANG;

		foreach($this->en_strings as $str)
			$this->$str[0] = $str[1];

		if($LANG != "en" && isset($this->{$LANG . "_strings"}))
			foreach($this->{$LANG . "_strings"} as $str)
				$this->$str[0] = $str[1];
	}
}