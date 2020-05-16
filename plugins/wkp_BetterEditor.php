<?php
/**
 * BetterEditor is plugin for LionWiki which adds:
 * 1) toolbar with a few formatting buttons (bold, italics, headings etc.)
 * 2) resizing arrows which allow to resize the textarea
 *
 * Both are used for classical editing, Ajax editing and comments.
 *
 * (c) 2009, Adam Zivner, <adam.zivner@gmail.com>. GPL'd
 *     modified in 2013 by Eric Forgeot for using with txt2tags
 */

class BetterEditor
{
	var $desc = array(
		array("BetterEditor", "provides toolbar and resizing of textareas.")
	);

	var $step_up = -100;
	var $step_down = 100;

	var $resize_html;
	var $basic_toolbar_html; // used for comments
	var $advanced_toolbar_html; // used for page editing

	function BetterEditor()
	{
		$this->localize();

		$this->resize_html = '
<span class="resizeTextarea">
	<a href="javascript:" title="' . h($this->TP_RESIZE_DOWN) . '" onclick="resizeTextarea(this, ' . $this->step_down . ');" class="resizeTextareaDown">&darr;</a>
	<a href="javascript:" title="' . h($this->TP_RESIZE_UP) . '" onclick="resizeTextarea(this, ' . $this->step_up . ');" class="resizeTextareaUp">&uarr;</a>
</span>';
		$common_toolbar = '
<span class="toolbarTextarea">
	<a class="toolbarTextareaItem" href="javascript:" onclick="insertSyntax(this, \'\\\*\\\*\', \'\\\*\\\*\', \''.$this->TP_BOLD[2].'\');" title="'.$this->TP_BOLD[1].'">B<b>'.$this->TP_BOLD[0].'</b></a>
	<a class="toolbarTextareaItem" href="javascript:" onclick="insertSyntax(this, \'\\\/\\\/\', \'\\\/\\\/\', \''.$this->TP_ITALIC[2].'\');" title="'.$this->TP_ITALIC[1].'">I<i style="font-family: serif;">'.$this->TP_ITALIC[0].'</i></a>
	<a class="toolbarTextareaItem" href="javascript:" onclick="insertSyntax(this, \'__\', \'__\', \''.$this->TP_UNDERLINED[2].'\');" title="'.$this->TP_UNDERLINED[1].'" style="text-decoration: underline;">'.$this->TP_UNDERLINED[0].'U</a>
	<a class="toolbarTextareaItem" href="javascript:" onclick="insertSyntax(this, \'--\', \'--\', \''.$this->TP_STRIKETHROUGH[2].'\');" title="'.$this->TP_STRIKETHROUGH[1].'" style="text-decoration: line-through;">'.$this->TP_STRIKETHROUGH[0].'S</a>
	
	<a class="toolbarTextareaItem" href="javascript:" onclick="insertSyntax(this, \'== \', \' ==\', \''.$this->TP_H2[2].'\');" title="'.$this->TP_H2[1].'">H2<span style="font-variant: small-caps;">'.$this->TP_H2[0].'</span></a>
	
	<a class="toolbarTextareaItem" href="javascript:" onclick="insertSyntax(this, \'=== \', \' ===\', \''.$this->TP_H3[2].'\');" title="'.$this->TP_H3[1].'">H3<span style="font-variant: small-caps;">'.$this->TP_H3[0].'</span></a>
	
	<a class="toolbarTextareaItem" href="javascript:" onclick="insertSyntax(this, \'[[\', \']]\', \''.$this->TP_INLINK[2].'\');" title="'.$this->TP_INLINK[1].'" style="text-decoration: none;">'.$this->TP_INLINK[0].'wiki-link</a>

	<a class="toolbarTextareaItem" href="javascript:" onclick="insertSyntax(this, \'[\', \' http:\/\/]\', \''.$this->TP_LINK[2].'\');" title="'.$this->TP_LINK[1].'" style="text-decoration: underline;">'.$this->TP_LINK[0].'ext-link</a>';

    // basic toolbar is used in comments plugin
		$this->basic_toolbar_html = $common_toolbar . '</span>';

    // advanced toolbar is used in both regular editing textarea and AjaxEditing plugin
		$this->advanced_toolbar_html = $common_toolbar . '
	<a class="toolbarTextareaItem" href="javascript:" onclick="insertSyntax(this, \' [\', \'] \', \''.$this->TP_IMAGE[2].'\');" title="'.$this->TP_IMAGE[1].'">'.$this->TP_IMAGE[0].'img</a>
	<a class="toolbarTextareaItem" href="javascript:" onclick="insertSyntax(this, \'``\', \'``\', \''.$this->TP_CODE[2].'\');" title="'.$this->TP_CODE[1].'">'.$this->TP_CODE[0].'code</a>
' . ($GLOBALS["NO_HTML"] ? "" : '<a class="toolbarTextareaItem" href="javascript:" onclick="insertSyntax(this, \'{html}\', \'{/html}\', \''.$this->TP_HTML[2].'\');" title="'.$this->TP_HTML[1].'">'.$this->TP_HTML[0].'html</a>') . '
	<a class="toolbarTextareaItem" href="javascript:" onclick="insertSyntax(this, \'\\n- \', \'\', \''.$this->TP_ULIST[2].'\');" title="'.$this->TP_ULIST[1].'">'.$this->TP_ULIST[0].'list</a>
	<a class="toolbarTextareaItem" href="javascript:" onclick="insertSyntax(this, \'|| \', \' |\', \''.$this->TP_TABLE[2].'\');" title="'.$this->TP_TABLE[1].'">'.$this->TP_TABLE[0].'table</a>
</span>';
	}

	function template()
	{
		global $action, $HEAD, $preview, $html, $PLUGINS_DIR;

		$HEAD .= '<script type="text/javascript" src="'.$PLUGINS_DIR.'BetterEditor/bettereditor.js"></script>';

		if($action == "edit" || $preview) {
			$html = template_replace("plugin:RESIZE_TEXTAREA", $this->resize_html, $html);
			$html = template_replace("plugin:TOOLBAR_TEXTAREA", $this->advanced_toolbar_html, $html);
		}
	}

	function commentsTemplate()
	{
		global $comments_html;
		
		$comments_html = template_replace("plugin:RESIZE_TEXTAREA", $this->resize_html, $comments_html);
		$comments_html = template_replace("plugin:TOOLBAR_TEXTAREA", $this->basic_toolbar_html, $comments_html);
	}

	// Localization strings

	var $cs_strings = array(
		array("TP_RESIZE_UP", "Zmenšit editor"),
		array("TP_RESIZE_DOWN", "Zvětšit editor"),
		array("TP_BOLD", array("B", "Tučně", "tučně")),
		array("TP_ITALIC", array("I", "Kurzíva", "kurzíva")),
		array("TP_UNDERLINED", array("U", "Podtržení", "podtržení")),
		array("TP_STRIKETHROUGH", array("S", "Přeškrtnutí", "přeškrtnutí")),
		array("TP_H2", array("h2", "h2", "Heading level 2")),
		array("TP_H3", array("h3", "h3", "Heading level 3")),
		array("TP_INLINK", array("[[local link]]", "Wiki odkaz", "description")),
		array("TP_LINK", array("link", "Web odkaz", "description")),
		array("TP_IMAGE", array("obr", "Obrázek", "var/upload/your-image.jpg")),
		array("TP_CODE", array("kód", "Kód", "kód")),
		array("TP_HTML", array("HTML", "HTML", 'HTML kód')),
		array("TP_ULIST", array("list", "Odrážkový seznam", 'první položka\\n - podpoložka první položky\\n- druhá položka'))
	);

	var $en_strings = array(
		array("TP_RESIZE_UP", "Shrink editor"),
		array("TP_RESIZE_DOWN", "Enlarge editor"),
		array("TP_BOLD", array("B", "Bold", "bold")),
		array("TP_ITALIC", array("I", "Italic", "italic")),
		array("TP_UNDERLINED", array("U", "Underlined", "underlined")),
		array("TP_STRIKETHROUGH", array("S", "Strikethrough", "strikethrough")),
		array("TP_H2", array("h2", "h2", "Heading level 2")),
		array("TP_H3", array("h3", "h3", "Heading level 3")),
		array("TP_INLINK", array("local link", "[[local Wiki link]]", "description")),
		array("TP_LINK", array("link", "Web link", "description")),
		array("TP_IMAGE", array("image", "Image", "var/upload/your-image.jpg")),
		array("TP_CODE", array("code", "Code", "code")),
		array("TP_HTML", array("HTML", "HTML", 'HTML code')),
		array("TP_ULIST", array("list", "Unordered list", 'first item\\n - subitem\\n- second item')),
		array("TP_TABLE", array("table", "Table", 'title01 | title02 |\\n| item01 | item02 |\\n| item03 | item04'))
	);

	var $fr_strings = array(
		array("TP_RESIZE_UP", "Réduire la fenêtre d'édition"),
		array("TP_RESIZE_DOWN", "Agrandir la fenêtre d'édition"),
		array("TP_BOLD", array("G", "Caractère gras", "gras")),
		array("TP_ITALIC", array("I", "Caractère italique", "italique")),
		array("TP_UNDERLINED", array("S", "Caractère souligné", "souligné")),
		array("TP_STRIKETHROUGH", array("B", "Caractère barré", "barré")),
		array("TP_H2", array("h2", "h2", "Titre niveau 2")),
		array("TP_H3", array("h3", "h3", "Titre niveau 3")),
		array("TP_INLINK", array("[[lien local]]", "Lien Wiki local", "description")),
		array("TP_LINK", array("lien", "Lien Web", "description")),
		array("TP_IMAGE", array("image", "Insérer une image", "var/upload/your-image.jpg")),
		array("TP_CODE", array("code", "Insérer un paragraphe en mode Code", "code")),
		array("TP_HTML", array("HTML", "Insérer du code HTML", 'code HTML')),
		array("TP_ULIST", array("list", "Liste non ordonnée", 'premier élément\\n - sous-élément\\n- second élément')),
		array("TP_TABLE", array("table", "Table", 'titre01 | titre02 |\\n| élément01 | élément02 |\\n| élément03 | élément04'))
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
