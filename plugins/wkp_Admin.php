<?php
/*
 * Admin plugin for LionWiki provides some sensitive, administrative features:
 * - IP blocking (index.php?action=admin-blockip)
 * - black list of forbidden words (index.php?action=admin-blacklist)
 * - setting pages read only (index.php?action=admin-pages)
 * - turning off plugins (index.php?action=admin-plugins)
 * - deleting comments from Comments plugin (needs installed Comments plugin)
 *
 * (c) Adam Zivner 2008, 2009, adam.zivner@gmail.com, GPL'd
 */

class Admin
{
	/*
	 * If you want to set password, place following line to config.php (without leading asterisk)
	 *
	 * $Admin["PASSWORD"] = sha1("my_admin_password");
	 *
	 * You could set it here too, but you'd loose this setting after upgrade ...
	 */

	var $PASSWORD = "1";
	var $expire_login = 7200;
	var $dir;

	function Admin()
	{
		global $self;

		$this->dir = $GLOBALS["PLUGINS_DATA_DIR"];

		$this->desc = array(
			array("Admin plugin", "provides advanced administration functions protected by password"),
			array(
				array("<a href=\"$self?action=admin-blockip\" rel=\"nofollow\">IP blocking</a>", "Blocks specified IP addresses from editing"),
				array("<a href=\"$self?action=admin-blacklist\" rel=\"nofollow\">Black list</a>", "List of expressions forbidden in pages"),
				array("<a href=\"$self?action=admin-pages\" rel=\"nofollow\">Read-only pages</a>", "Can set certain pages as unwritable"),
				array("<a href=\"$self?action=admin-plugins\" rel=\"nofollow\">Disabled plugins</a>", "List of disabled plugins")
			)
		);
	}

	// just for printing "menu"
	function getUL($arr)
	{
		$ret = "";

		foreach($arr as $line)
			if(is_array($line[0]))
				$ret .= "<ul>\n" . $this->getUL($line) . "</ul>\n";
			else
				$ret .= "<li>" . $line[0] . " " . $line[1] . "</li>\n";

		return $ret;
	}

	// common function used by all "filters"
	function fileForm($action, $dataname, $comment)
	{
		global $self;
		
		$filename = $this->dir . $dataname . ".txt";

		$ret = "";

		// try to create file if it doesn't exist
		if(!file_exists($filename) && !touch($filename)) {
			$ret .= "<div class=\"error\">Required file doesn't exist and couldn't be created. Please set $this->dir to 777 or create $filename and set it to 777.</div>";

			return;
		}

		// check required password
		if(!empty($_POST["action"]) && $this->authentified() == false)
			$ret .= '<div class="error">Wrong password. List was not updated. You can try again.</div>';
		else if(!empty($_POST["action"]))
			if($f = fopen(clear_path($filename), "wb")) {
				fwrite($f, $_POST["$dataname"]);

				fclose($f);
			}

		$ret .= "<p>$comment</p>\n";

		$ret .= '
<form action="'.$self.'" method="post">
<input type="hidden" name="action" value="'.h($action).'" />
<table width="600px">
<tr><td><textarea name="'.h($dataname).'" rows="15" cols="60" style="width: 100%;">' . h(!empty($_POST["$dataname"]) ? $_POST["$dataname"] : @file_get_contents($filename)) . '</textarea></td></tr>
<tr><td style="text-align:right;">';

		if(!$this->authentified())
			$ret .= 'Password: <input type="password" name="sc" />';
			
		$ret .= '
<input type="submit" class="submit" value="Update" />
</td></tr>
</table>
</form>';

		return $ret;
	}

	function action($action)
	{
		global $CON, $TITLE;

		if(substr($action, 0, 6) == "admin-") {
			if(!is_dir(rtrim($this->dir, "/")) && !mkdir(rtrim($this->dir, "/"))) {
				$CON = "<div class=\"error\">Plugin data directory doesn't exist. Create please $this->dir and set access permissions to 777.</div>";
				return true;
			}

			$CON = "<ul>\n" . $this->getUL($this->desc) . "</ul>\n";
		}

		if($action == "admin-blockip") {
			$TITLE = "IP blocking";
			$comment = "List of blocked IPs. One IP per line, everything behing IP until the end of line is ignored (useful for comments, e.g. reason for block).";

			$CON .= $this->fileForm($action, "Admin_blockedips", $comment);

			return true;
		}
		elseif($action == "admin-blacklist") {
			$TITLE = "Blacklist";
			$comment = "List of forbidden words. One word per line, can also be (perl) regular expression (omit both //).";

			$CON .= $this->fileForm($action, "Admin_blacklist", $comment);

			return true;
		}
		elseif($action == "admin-pages") {
			$TITLE = "Page settings";
			$comment = "List of nonwritable pages, one page per line.";

			$CON .= $this->fileForm($action, "Admin_pages", $comment);

			return true;
		}
		elseif($action == "admin-plugins") {
			$TITLE = "Disabled plugins";
			$comment = "List of disabled plugins, one plugin per line. Insert just class name, that means if plugin file is called \"wkp_Captcha.php\", then insert \"Captcha\".";

			$CON .= $this->fileForm($action, "Admin_plugins", $comment);

			return true;
		}
		else if($action == "admin-deletecomment") {
			$CON = $this->deleteComment();
			
			return true;
		}

		return false;
	}

	// is user IP blocked?
	function checkIPs()
	{
		global $error;

		$blockedips = @file_get_contents($this->dir . "Admin_blockedips.txt");

		if(!empty($blockedips)) {
			$blockedips = str_replace("\r", "\n", $blockedips); // unifying newlines

			$arr = explode("\n", $blockedips);

			foreach($arr as $line)
				if(!strcmp($_SERVER["REMOTE_ADDR"], trim($line))) {
					$error .= "Your IP is blocked. Page was not saved.";

					return false;
			}
		}

		return true;
	}

	// are there any occurences of forbidden expressions in content?
	function checkBlacklist()
	{
		global $content, $error;

		$blacklist = @file_get_contents($this->dir . "Admin_blacklist.txt");

		if(!empty($blacklist)) {
			$blacklist = str_replace("\r", "\n", $blacklist); // unifying newlines

			$arr = explode("\n", $blacklist);

			foreach($arr as $line) {
				$line = trim($line);

				if(!empty($line) && preg_match("/$line/U", $content)) {
					$error .= "Remove all occurences of \"$line\" and try again";

					return false;
				}
			}
		}

		return true;
	}

	/*
	 * With admin-pages, we can make some pages read-only. But this applies to
	 * administrator too which is not what we usually want. This way, if we detect that
	 * user wants to edit read only page, we will include password input into the
	 * template even if the user is "logged". Then user can fill admin password
	 * and in that case, page will be saved.
	 */

	function actionBegin()
	{
		global $PASSWORD;

		if($this->checkPages(false) == false) {
			// with this, user will be thought as unlogged, so password input will appear
			$_COOKIE["LW_AUT"] = "1"; // just keep these two different
			$PASSWORD = "2";
		}
	}

	// check if page is not set as "read-only"
	function checkPages($echo = true)
	{
		global $page, $error, $sc;

		$pages = @file_get_contents($this->dir . "Admin_pages.txt");

		if(!empty($pages)) {
			$pages = str_replace("\r", "\n", $pages); // unifying newlines

			$arr = explode("\n", $pages);

			foreach($arr as $line)
				if(!strcmp($page, trim($line))) {
					if(!strcasecmp(sha1($sc), $this->PASSWORD))
						return true;
					else {
						if($echo)
							$error .= "This page is read-only. Page was not saved.";

						return false;
					}
			}
		}

		return true;
	}

	/*
	 * is it ok for all filters to save the page?
	 *
	 * By convention, writingPage hook is expected to return false if
	 * everything is ok and true if page should not be saved.
	 */

	function writingPage()
	{
		return !($this->checkIPs() && $this->checkBlacklist() && $this->checkPages());
	}

	// find out if page is editable by user
	function formatBegin()
	{
		global $editable, $error;

		$orig_error = $error;

		$editable = $this->checkPages() && $this->checkIPs();

		$error = $orig_error; // for this we don't need error messages

		return true;
	}

	// Deactivate plugins
	function pluginsLoaded()
	{
		global $plugins;

		$fc = @file_get_contents($this->dir . "Admin_plugins.txt");

		if(!empty($fc)) {
			$fc = str_replace("\r", "\n", $fc); // unifying newlines

			$list = explode("\n", $fc);

			foreach($list as $plug)
				if(isset($plugins[$plug]))
					unset($plugins[$plug]);
		}
	}

	/*
	 * Deleting comments from Comments plugin.
	 *
	 * If user is logged to Admin, it directly deletes the comment and redirects to the page. If not logged,
	 * outputs password form.
	 */

	function deleteComment()
	{
		global $self, $T_PASSWORD, $plugins, $action;

		$ret = "";

		if($this->authentified() == false) {
			$ret .= '
<form action="'.$self.'" method="post">
<input type="hidden" name="action" value="admin-deletecomment" />
<input type="hidden" name="page" value="'.h($_REQUEST["page"]).'" />
<input type="hidden" name="filename" value="'.h($_REQUEST["filename"]).'" />
'.$T_PASSWORD.': <input type="password" name="sc" value="" />
<input type="submit" value="Delete" />
</form>';
			$action = "view-html";

			return $ret;
		}
		else {
			$filename = clear_path($_REQUEST["filename"]);
			$page = clear_path($_REQUEST["page"]);

			if(preg_match("/([0-9]{8}-[0-9]{4}-[0-9]{2})\.txt/", $filename, $m)) // is it really a comment file?
				unlink($plugins["Comments"]->comments_dir . $page . "/" . $filename);

			Header("Location:$self?page=" . u($page) . "#commentWrap");
			die();
		}
	}

	function template()
	{
		global $html, $self;

		$tpl_subs = array(
			array("plugin:ADMIN_BLOCKED_IPS", "<a href=\"$self?action=admin-blockip\" rel=\"nofollow\">Blocked IPs</a>"),
			array("plugin:ADMIN_BLACKLIST", "<a href=\"$self?action=admin-blacklist\" rel=\"nofollow\">Blacklist</a>"),
			array("plugin:ADMIN_READONLY_PAGES", "<a href=\"$self?action=admin-pages\" rel=\"nofollow\">Read-only pages</a>"),
			array("plugin:ADMIN_DISABLED_PLUGINS", "<a href=\"$self?action=admin-plugins\" rel=\"nofollow\">Disabled plugins</a>")
		);

		foreach($tpl_subs as $subs) // substituting values
			$html = preg_replace("/\{([^}]* )?$subs[0]( [^}]*)?\}/U", "$1$subs[1]$2", $html);
	}

	function authentified()
	{
		if(strlen($this->PASSWORD) > 0 && $_COOKIE["LW_ADMIN"] == $this->PASSWORD || (isset($_POST["sc"]) && sha1($_POST["sc"]) == $this->PASSWORD)) {
			setsafecookie("LW_ADMIN", $this->PASSWORD, time() + $this->expire_login);

			return true;
		}
		else
			return false;
	}
}