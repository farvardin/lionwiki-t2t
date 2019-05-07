<?php
/*
 * Comments plugin for LionWiki, (c) 2009 Adam Zivner, adam.zivner@gmail.com
 *
 * There are two ways to add comments section to your pages:
 * 1) insert {plugin:COMMENTS} on appropriate place in your template
 *	If you then don't want comments on some particular page, insert {NO_COMMENTS} into that page content.
 * 2) insert {COMMENTS} into your page content. Good if you want discussion only on some pages.
 *
 * Comments are almost totally templatable, see plugins/Comments/template.html, it
 * should be quite self explanatory.
 *
 * Comments are stored in var/comments/ in the same directory structure as history.
 */

class Comments
{
	var $desc = array(
		array("Comments", "adds support for comments.")
	);

	var $sorting_order = "asc"; // "asc" means from oldest to newest, "desc" means newest first

	var $data_dir;
	var $comments_dir;
	var $template = "template.html";

	var $rss_use = true; // turn on/off creating comments RSS
	var $rss_file;
	var $rss_max_comments = 50;
	var $rss_template = '<rss version="2.0">
<channel>
<title>{WIKI_TITLE}</title>
<link>{PAGE_LINK}</link>
<description>{WIKI_DESCRIPTION}</description>
<language>{LANG}</language>
{CONTENT_RSS}
</channel>
</rss>'; // don't change template. This exact form is needed for correct functioning.

	var $strings = array();

	function Comments()
	{
		$this->data_dir = $GLOBALS["PLUGINS_DIR"] . "Comments/"; // CSS and JS for comments
		$this->comments_dir = $GLOBALS["VAR_DIR"] . "comments/"; // actual comments
		$this->rss_file = $GLOBALS["VAR_DIR"] . "comments-rss.xml";

		$this->localize();
	}

	/*
	 * Process comment content, i.e. turn wiki syntax into HTML.
	 *
	 * Because of LionWiki core structure, we need to duplicate the functionality :(
	 *
	 * Supported features are: bold, italics, underscore, strikethrough, link
	 */

	function processComment($txt)
	{
		global $PG_DIR, $self;

		$txt = str_replace(array("<", "&"), array("&lt;", "&amp;"), $txt);
		$txt = preg_replace("/&amp;([a-z]+;|\#[0-9]+;)/U", "&$1", $txt); // keep HTML entities
		
		$txt = preg_replace("#\[([^\]\|\"]+)\|(\./([^\]\"]+)|(https?://[^\]\"]+))\]#U", '<a href="$2" class="external">$1</a>', $txt);
		$txt = preg_replace("#(?<!\")(https?://[^\]\"]+)#i", '<a href="$0" class="external">$1</a>', $txt);

		preg_match_all("/\[(?:([^|\]\"]+)\|)?([^\]#\"]+)(?:#([^\]\"]+))?\]/", $txt, $matches, PREG_SET_ORDER); // matching Wiki links

		foreach($matches as $m) {
			$m[1] = $m[1] ? $m[1] : $m[2]; // is page label same as its name?
			$m[3] = $m[3] ? "#".u(preg_replace("/[^\da-z]/i", "_", $m[3])) : ""; // anchor

			$attr = file_exists("$PG_DIR$m[2].txt") ? $m[3] : '&amp;action=edit" class="pending"';

			$txt = str_replace($m[0], '<a href="'.$self.'?page='.u($m[2]).$attr.'">'.$m[1].'</a>', $txt);
		}

		$txt = preg_replace('#([0-9a-zA-Z\./~\-_]+@[0-9a-z/~\-_]+\.[0-9a-z\./~\-_]+)#i', '<a href="mailto:$0">$0</a>', $txt);
		$txt = preg_replace("/'--(.*)--'/Um", '<del>$1</del>', $txt); // strikethrough
		$txt = str_replace("--", "&mdash;", $txt); // --
		$txt = preg_replace("/'__(.*)__'/Um", '<u>$1</u>', $txt); // underlining
		$txt = preg_replace("/'''(.*)'''/Um", '<strong>$1</strong>', $txt); // bold
		$txt = preg_replace("/''(.*)''/Um", '<em>$1</em>', $txt); // italic

		$txt = preg_replace("/(\r\n|\r)/", "\n", $txt); // unifying newlines to Unix ones
		$txt = str_replace("\n", "<br />", $txt);

		return $txt;
	}

	function template()
	{
		global $CON, $html, $action, $preview, $page, $HEAD, $self, $comments_html, $comment_captcha_failed;

		/*
		 * Include comments if:
		 * - {plugin:COMMENTS} is in template and {NO_COMMENTS} is not in page content
		 * - {COMMENTS} is in page content
		 */

		if($action == "" && !$preview && ((template_match("plugin:COMMENTS", $html, $null) && strpos($CON, "{NO_COMMENTS}") === false)
			|| strpos($CON, "{COMMENTS}") !== false)) {

			$HEAD .= '<script type="text/javascript" src="plugins/Comments/comments.js"></script>';
			$HEAD .= '<style type="text/css" media="all">@import url("plugins/Comments/comments.css");</style>';

			$tmpl = file_get_contents($this->data_dir . $this->template);

			$tmpl = strtr($tmpl, array(
				"{FORM_NAME}" => $this->strings["TP_FORM_NAME"],
				"{FORM_EMAIL}" => $this->strings["TP_FORM_EMAIL"],
				"{FORM_CONTENT}" => $this->strings["TP_FORM_CONTENT"],
				// Following 3 are for failed captcha test
				"{FORM_NAME_VALUE}" => $comment_captcha_failed ? h($_POST["name"]) : "",
				"{FORM_EMAIL_VALUE}" => $comment_captcha_failed ? h($_POST["email"]) : "",
				"{FORM_CONTENT_VALUE}" => $comment_captcha_failed ? h($_POST["content"]) : "",
				"{FORM_SUBMIT}" => $this->strings["TP_FORM_SUBMIT"],
				"{FORM_SELF}" => h($self),
				"{FORM_PAGE}" => h($page),
				"{COMMENTS}" => $this->strings["TP_COMMENTS"]
			));

			$items_str = "";

			if($dir = @opendir($this->comments_dir . $page)) {
				$item_tmpl = "";

				if(preg_match("/\{item\}(.*)\{\/item\}/Us", $tmpl, $m))
					$item_tmpl = $m[1];

				$filenames = array();

				while($filename = @readdir($dir))
					if(preg_match("/([0-9]{8}-[0-9]{4}-[0-9]{2})\.txt/", $filename, $m))
						$filenames[] = $filename;

				if($this->sorting_order == "asc")
					sort($filenames);
				else if($this->sorting_order == "desc")
					rsort($filenames);

				$comment_num = 0;

				foreach($filenames as $filename) {
					$comment_num++;

					$file = file_get_contents($this->comments_dir . $page . "/" . $filename);

					$delimiter = strpos($file, "\n");

					$meta = substr($file, 0, $delimiter);
					$content = substr($file, $delimiter + 1);

					list($ip, $name, $email) = explode("\t", $meta);

					$processed_content = $this->processComment($content);

					$items_str .= strtr($item_tmpl, array(
						"{CONTENT}" => $processed_content,
						"{NAME}" => h($name),
						"{EMAIL}" => h($email),
						"{NAME_TO_EMAIL}" => $email == "" ? h($name) : ("<a href=\"mailto:".h($email)."\">" . h($name) . "</a>"),
						"{IP}" => h($ip),
						"{DATE}" => rev_time(basename($filename, ".txt")),
						"{ID}" => basename($filename, ".txt"),
						"{NUMBER}" => $comment_num,
						"{DELETE}" => h($this->strings["TP_DELETE"]),
						"{DELETE_LINK}" => "$self?action=admin-deletecomment&amp;page=" . u($page) . "&amp;filename=" . u($filename),
						"{DELETE_CONFIRM}" => h($this->strings["TP_DELETE_CONFIRM"])
					));
				}
			}

			$tmpl = str_replace("{NUMBER_OF_COMMENTS}", count($filenames), $tmpl);

			$comments_html = preg_replace("/\{item\}.*\{\/item\}/Us", $items_str, $tmpl);

			plugin("commentsTemplate");

			$html = template_replace("plugin:COMMENTS", $comments_html, $html);
			$CON = str_replace("{COMMENTS}", $comments_html, $CON);
		}

		$CON = str_replace("{NO_COMMENTS}", "", $CON);

		$HEAD .= "\n<link rel=\"alternate\" type=\"application/rss+xml\" title=\"RSS ".h($this->strings["TP_COMMENTS"])."\" href=\"$this->rss_file\" />\n";
	}

	function actionBegin()
	{
		global $page, $LOCAL_HOUR, $plugins, $action, $error, $comment_captcha_failed, $self;

		if($action == "save-comment") {
			if(isset($plugins["Captcha"]) && $plugins["Captcha"]->checkCaptcha() == true) {
				$comment_captcha_failed = true;
				$action = "";
				$error = ""; // suppress error messages

				unset($_REQUEST["qid"]); // don't check captcha again

				return true;
			}

			if(!is_dir(rtrim($this->comments_dir, "/"))) {
				mkdir(rtrim($this->comments_dir, "/"));
				
				$f = fopen($this->comments_dir . ".htaccess", "w"); 
				fwrite($f, "deny from all"); 
				fclose($f);
			}

			$c_dir = $this->comments_dir . urldecode($page);

			if(!is_dir(rtrim($c_dir, "/")))
				mkdir(rtrim($c_dir, "/"));

			function prepare($txt) {
				return strtr($txt, array(
					"\t" => "",
					"\n" => ""
				));
			}

			$meta = prepare($_SERVER["REMOTE_ADDR"]) . "\t" . prepare($_POST["name"]) . "\t" . prepare($_POST["email"]) . "\n";

			$rightnow = date("Ymd-Hi-s", time() + $LOCAL_HOUR * 3600);

			$h = fopen($c_dir . "/" . $rightnow . ".txt", "w");

			if(!$h)
				return;

			$content = $_POST["content"];
			$content = str_replace("<", "&lt;", $content); // prevetion of php code inclusion
			
			fwrite($h, $meta . $content);
			fclose($h);

			$this->writeRSS($page, $rightnow, $meta . $_POST["content"]);

			header("Location: $self?page=$page#$rightnow");

			die();
		}
	}

	function writeRSS($page, $id, $content)
	{
		global $PROTECTED_READ, $WIKI_TITLE, $LANG;

		if(!$this->rss_use || $PROTECTED_READ)
			return;

		$pagelink = ($_SERVER["HTTPS"] ? "https://" : "http://") . $_SERVER["SERVER_NAME"] . ":" . $_SERVER["SERVER_PORT"] . $_SERVER["SCRIPT_NAME"];

		preg_match("/<\/language>(.*)<\/channel>/s", @file_get_contents($this->rss_file), $matches);

		$items = $matches[1];

		$pos = -1;

		// count items
		for($i = 0; $i < $this->rss_max_comments - 1; $i++)
			if(!($pos = strpos($items, "</item>", $pos + 1)))
				break;

		if($pos) // if count is higher than $max_changes - 1, cut out the rest
			$items = substr($items, 0, $pos + 7);

		$n_item = "
<item>
	<title>".h($page)."</title>
	<pubDate>". date("r")."</pubDate>
	<link>$pagelink?page=".u($page)."#$id</link>
	<description><pre>".h($content)."</pre></description>
</item>";

		$rss = str_replace('{WIKI_TITLE}', h($WIKI_TITLE) . ": " . $this->strings["TP_COMMENTS"], $this->rss_template);
		$rss = str_replace('{PAGE_LINK}', h($pagelink), $rss);
		$rss = str_replace('{LANG}', h($LANG), $rss);
		$rss = str_replace('{WIKI_DESCRIPTION}', "RSS comments feed from " . h($WIKI_TITLE), $rss);
		$rss = str_replace('{CONTENT_RSS}', $n_item . $items, $rss);

		if(!$file = @fopen($this->rss_file, "w")) {
			echo "Opening file for writing RSS comments file is not possible! Please create file rss.xml in your var directory and make it writable (chmod 666).";

			return true;
		}

		fwrite($file, $rss);
		fclose($file);
	}

	/*
	 * Need to move comments together with the page (during rename operation)
	 */

	function pageWritten()
	{
		global $moveto;

		// page is already set to $moveto, we need to take original page name from the request
		$orig_name = clear_path($_REQUEST["page"]);

		if(!$moveto || $moveto == $orig_name) // page was not moved, nothing to do
			return;

		if(file_exists($this->comments_dir . $orig_name))
			rename($this->comments_dir . $orig_name, $this->comments_dir . $moveto);
	}

	// Localization strings

	var $cs_strings = array(
		array("TP_FORM_NAME", "Jméno"),
		array("TP_FORM_EMAIL", "E-mail"),
		array("TP_FORM_CONTENT", "Obsah"),
		array("TP_FORM_SUBMIT", "Přidat"),
		array("TP_REPLY_TO", "Odpovědět na tento komentář"),
		array("TP_COMMENTS", "Komentáře"),
		array("TP_DELETE", "Smazat"),
		array("TP_DELETE_CONFIRM", "Chcete opravdu smazat tento komentář?"),
	);

	var $en_strings = array(
		array("TP_FORM_NAME", "Name"),
		array("TP_FORM_EMAIL", "E-mail"),
		array("TP_FORM_CONTENT", "Content"),
		array("TP_FORM_SUBMIT", "Save"),
		array("TP_REPLY_TO", "Reply to this comment"),
		array("TP_COMMENTS", "Comments"),
		array("TP_DELETE", "Delete"),
		array("TP_DELETE_CONFIRM", "Do you really want to delete this comment?")
	);

	var $fr_strings = array(
		array("TP_FORM_NAME", "Votre nom"),
		array("TP_FORM_EMAIL", "E-mail"),
		array("TP_FORM_CONTENT", "Votre commentaire"),
		array("TP_FORM_SUBMIT", "Envoyer"),
		array("TP_REPLY_TO", "Répondre à ce commentaire"),
		array("TP_COMMENTS", "Commentaires"),
		array("TP_DELETE", "Supprimer"),
		array("TP_DELETE_CONFIRM", "Voulez-vous supprimer ce commentaire ?")
	);


	function localize()
	{
		global $LANG;

		foreach($this->en_strings as $str)
			$this->strings[$str[0]] = $str[1];

		if($LANG != "en" && isset($this->{$LANG . "_strings"}))
			foreach($this->{$LANG . "_strings"} as $str)
				$this->strings[$str[0]] = $str[1];
	}
}