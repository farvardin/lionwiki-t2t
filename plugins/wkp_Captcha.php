<?php
/*
 * Captcha plugin is simple spam filtering plugin. It asks user simple questions
 * (If today is saturday, what day is tomorrow?). It is active only when no
 * password protection is used.
 *
 * (c) Adam Zivner 2008. GPL'd, of course.
 */

class Captcha
{
	var $desc = array(
		array("Captcha plugin", "is a spam filtering plugin asking simple questions.")
	);

	var $question_file;
	var $permanent = true; // remember first correct answer and don't ask again
	var $cookie_password;
	var $use_javascript_autofill = false;

	function Captcha()
	{
		global $LANG, $PLUGINS_DIR;

		$this->question_file = $PLUGINS_DIR . "Captcha/";

		if(file_exists($this->question_file . $LANG . "_questions.txt"))
			$this->question_file .= $LANG . "_questions.txt";
		else
			$this->question_file .= "en_questions.txt";

		$this->cookie_password = md5($_SERVER["SCRIPT_FILENAME"] . date("Ymd") . $_SERVER["REMOTE_ADDR"]); // pseudo random string
	}

	/*
	 * This is for the possibility of authentization during the preview
	 */

	function actionBegin()
	{
		global $preview;

		if($_REQUEST["qid"] && $preview)
			$this->checkCaptcha();
	}

	/*
	 * Functions return number of questions in question file. Method is very simple, it just counts
	 * number of occurence of "--" at the begining of the line.
	 */

	function questionCount()
	{
		$count = 0;
		$q = fopen($this->question_file, "r");

		if(!$q) {
			echo "Captcha plugin: Can't open captcha questions file $this->question_file.";

			return 0; // Oops
		}

		while($line = fgets($q))
			if(!strcmp(trim($line), "--"))
				$count++;

		fclose($q);

		return $count;
	}

	/*
	 * Function returns $line. line of $i. question. Convention is that 1. line is question and
	 * second line is answer(s). Numbering is Pascal-like, that means that getQuestion(1, 1) returns 1. line of 1. question.
	 */

	function getQuestion($i, $line)
	{
		$count = 0;

		$q = fopen($this->question_file, "r");

		if(!$q) {
			echo "Captcha plugin: Can't open captcha questions file $this->question_file.";

			return 0; // Oops
		}

		$str = "";

		while($l = fgets($q)) {
			if(!strcmp(trim($l), "--")) {
				$count++;

				if($count == $i) {
					for($k = 0, $str = ""; $k < $line && $str = fgets($q); $k++);

					break;
				}
			}
		}

		fclose($q);

		return $str;
	}

	function checkCaptcha()
	{
		global $PASSWORD, $error;

		if(!empty($PASSWORD) || ($this->permanent && $_COOKIE["LW_CAPTCHA"] == $this->cookie_password))
			return false;

		$question_id = $_REQUEST["qid"];
		$answer = trim($_REQUEST["ans"]);

		if(empty($question_id) || empty($answer) || !is_numeric($question_id))
			return true;

		$right_answers = explode(",", $this->getQuestion($question_id, 2));

		$equals = false;

		foreach($right_answers as $a)
			if(!strcasecmp(trim($a), $answer)) {
				$equals = true;

				$_COOKIE['LW_CAPTCHA'] = $this->cookie_password;

				if($this->permanent)
					setsafecookie('LW_CAPTCHA', $this->cookie_password, time() + 365 * 24 * 3600);

				break;
			}

		if(!$equals)
			$error = "Captcha plugin: Given answer is not correct. Try again.";

		return !$equals;
	}

	/*
	 * By convention, writingPage hook is expected to return false if
	 * everything is ok and true if page should not be saved.
	 */

	function writingPage() { return $this->checkCaptcha(); }

	/*
	 * If JavaScript is enabled, user does not have to fill the form ...
	 *
	 * We rely on that spam bots don't interpret javascript.
	 */

	function fillAnswerWithJavascript($question_id)
	{
		if ($this->use_javascript_autofill == false)
			return '';

		$answers = explode(",", $this->getQuestion($question_id, 2));

		return '
<script type="text/javascript">
function fillCaptchaAnswer()
{
	var input = document.getElementById("captcha-input");

	input.style.display = "none";
	input.value = "'.trim($answers[0]).'";

	document.getElementById("captcha-question").style.display = "none";
}

if(typeof wons == "undefined")
	wons = new Array();

wons.push("fillCaptchaAnswer()");

window.onload = function() {
	for(var i = 0; i < wons.length; i++)
		eval(wons[i]);
}
</script>';
	}

	function template()
	{
		global $html, $PASSWORD, $action, $preview, $HEAD;

		if(($action != "edit" && !$preview) || !empty($PASSWORD)
			|| ($this->permanent && $_COOKIE["LW_CAPTCHA"] == $this->cookie_password))
			return;

		$question_count = $this->questionCount();
		$question_id = rand(1, $question_count);
		$question_text = trim($this->getQuestion($question_id, 1));

		$html = template_replace("plugin:CAPTCHA_QUESTION", '<span id="captcha-question">' . $question_text . "</span>", $html);
		$html = template_replace("plugin:CAPTCHA_INPUT", "<input type=\"hidden\" id=\"captcha-id\" name=\"qid\" value=\"$question_id\" /><input type=\"text\" id=\"captcha-input\" name=\"ans\" class=\"input\" value=\"\" />", $html);

		$HEAD .= $this->fillAnswerWithJavascript($question_id);
	}

	function commentsTemplate()
	{
		global $comments_html, $PASSWORD, $HEAD;

		if(!empty($PASSWORD) || ($this->permanent && $_COOKIE["LW_CAPTCHA"] == $this->cookie_password)) {
			$comments_html = template_replace("plugin:CAPTCHA_QUESTION", "", $comments_html);
			$comments_html = template_replace("plugin:CAPTCHA_INPUT", "", $comments_html);

			return;
		}

		$question_count = $this->questionCount();
		$question_id = rand(1, $question_count);
		$question_text = trim($this->getQuestion($question_id, 1));

		$comments_html = template_replace("plugin:CAPTCHA_QUESTION", '<span id="captcha-question">' . $question_text . "</span>", $comments_html);
		$comments_html = template_replace("plugin:CAPTCHA_INPUT", "<input type=\"hidden\" id=\"captcha-id\" name=\"qid\" value=\"$question_id\" /><input type=\"text\" id=\"captcha-input\" name=\"ans\" class=\"input\" value=\"\" />", $comments_html);

		$HEAD .= $this->fillAnswerWithJavascript($question_id);
	}
}