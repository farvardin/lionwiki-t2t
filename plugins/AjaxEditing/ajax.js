/**
 * Client side of AjaxEditing plugin for LionWiki
 *
 * (c) Adam Zivner 2009 <adam.zivner@gmail.com>. Licensed under GNU/GPL.
 */

var trigger_edit_click = 1; // click on the (edit) link in the heading triggers AJAX editing
var trigger_heading_doubleclick = 0; // doubleclick on heading triggers AJAX editing

/**
 * ret should be event or something like "this", it's given by browser
 */

function ajaxEdit(ret)
{
	if(!ret)
		ret = window.event;

	var elem = (window.event) ? ret.srcElement : ret.target; // f*cking browser incompatibilities!

	// now we need to extract page name from URL
	var query_params = window.location.search.substring(1).split("&");

	var page = null;

	for(var i = 0; i < query_params.length; i++) {
		var pair = query_params[i].split("=");

		if(pair[0] == "page") {
			page = pair[1];
			break;
		}
	}

	if(page == null)
		page = "Main+page";

	while(elem.className != "par-div") // crawl up the hierarchy till you get to <div class="par-div">
		elem = elem.parentNode;

	xmlHttpPost("index.php?page=" + page + "&action=edit&ajax=1&par=" + elem.id.substr(4), "", function(content) {
		var div = replaceContent(elem.id, "div", elem.id, content);
		div.className = "par-div";

		registerEditor();
	});

	return false;
}

/**
 * Three possible actions:
 *
 * action =
 * "save" - saves the paragraph and quits edit mode
 * "edit&preview=1" - preview
 * "" - (nothing) - go back/quit edit mode but don't save
 */

function ajaxAction(action, obj)
{
	var par_id = getNearestParId(obj);

	var contentDiv = document.getElementById("par-" + par_id);
	var content = getElementsByClassName("ajaxContentTextarea", contentDiv)[0].value;
	var esum = getOrNothing("ajaxEsum", contentDiv);
	var password = getOrNothing("ajaxPasswordInput", contentDiv);
	var showsource = getOrNothing("ajaxShowSource", contentDiv);
	var qid = document.getElementById("captcha-id");
	var ans = document.getElementById("captcha-input");
	var page = document.getElementById("ajaxPage").value;

	xmlHttpPost("index.php?page=Main+page&action=" + action + "&ajax=1&par=" + par_id,
		{
			"content": content,
			"last_changed": 2000000000,
			"esum": esum,
			"sc": password,
			"showsource": showsource,
			"qid": qid == null ? "" : qid.value,
			"ans": ans == null ? "" : ans.value,
			"page": page
		}, function(str) {
		var div = replaceContent("par-" + par_id, "div", "par-" + par_id, str);

		div.className = "par-div";

		renumberParagraphs();

		registerAjax(document.getElementById("par-" + getNearestParId(div)));
	});
}

function getNearestParId(obj)
{
	while(obj.className != "par-div")
		obj = obj.parentNode;

	return parseInt(obj.id.split("-")[1]);
}

/**
 * After saving paragraph into the file, heading numbers may change
 */

function renumberParagraphs()
{
	var headings = document.getElementsByClassName("par-div");

	var heading_id = 1;

	for(key in headings)
			headings[key].id = "par-" + heading_id++;
}

/**
 * Hook links or headings to edit function. Needs to be done after every DOM operation.
 *
 * Configuration is at the beginning of the file.
 */

function registerAjax(node)
{
	if(!node)
		node = document.getElementsByTagName("body")[0];

	if(trigger_heading_doubleclick) {
		var headings = node.getElementsByClassName("par-div");

		for(key in headings)
			headings[key].ondblclick = ajaxEdit;
	}

	if(trigger_edit_click) {
		var links = node.getElementsByClassName("par-edit");

		for(key in links)
			links[key].onclick = ajaxEdit;
	}
}

function registerEditor(node)
{
	if(typeof insertResizeDiv == 'function') { // is plugin BetterEditor installed?
		var txts = getElementsByClassName("contentTextarea", node);

		for(key in txts)
			insertResizeDiv(txts[key]);
	}
}

if(typeof wons == "undefined")
	wons = new Array();

wons.push("registerAjax()");

window.onload = function() {
	for(var i = 0; i < wons.length; i++)
		eval(wons[i]);
}

/**
 * Return value of the first element with given class. If no element exists, return ""
 */

function getOrNothing(what, where)
{
	var a = getElementsByClassName(what, where);

	return a.length == 0 ? "" : a[0].value;
}

function replaceContent(oldElementId, newElementName, newId, newContent)
{
	var oldElement = document.getElementById(oldElementId);
	var newElement = document.createElement(newElementName);

	newElement.innerHTML = newContent;

	oldElement.parentNode.replaceChild(newElement, oldElement);

	newElement.id = newId;

	return newElement;
}

function getElementsByClassName(classname, node)
{
	if(!node)
		node = document.getElementsByTagName("body")[0];

	var a = [];

	var re = new RegExp('\\b' + classname + '\\b');

	var els = node.getElementsByTagName("*");

	for(var i = 0, j = els.length; i < j; i++)
		if(re.test(els[i].className))
			a.push(els[i]);

	return a;
}

/**
 * Standard AJAX function.
 *
 * Copied as PD from some website. Consider this to be credit to Unknown Programmer
 */

function xmlHttpPost(strURL, params, func)
{
	var xmlHttpReq = false;

	if(window.XMLHttpRequest) // Mozilla/Safari
		xmlHttpReq = new XMLHttpRequest();
	else if (window.ActiveXObject) // IE
		xmlHttpReq = new ActiveXObject("Microsoft.XMLHTTP");

	var arr_params = [];

	if(params.length != 0) {
		for(key in params)
			arr_params.push(key + "=" + encodeURIComponent(params[key]));

		var str_params = arr_params.join("&");
	}
	else
		str_params = "";

	xmlHttpReq.open('POST', strURL, true);
	xmlHttpReq.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
	xmlHttpReq.setRequestHeader("Content-length", str_params.length);
	xmlHttpReq.setRequestHeader("Connection", "close");

	xmlHttpReq.onreadystatechange = function() {
		if(xmlHttpReq.readyState == 4)
			func(xmlHttpReq.responseText);
	}

	xmlHttpReq.send(str_params);
}
