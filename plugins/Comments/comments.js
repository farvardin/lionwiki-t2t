/**
 * Client side of Comments plugin for LionWiki
 *
 * (c) Adam Zivner 2009 <adam.zivner@gmail.com>. Licensed under GNU/GPL.
 */

function toggleComments()
{
	var wrap = document.getElementById("commentWrap");

	if(wrap.style.display == "none")
		wrap.style.display = "block";
	else
		wrap.style.display = "none";

	setCookie("display-comments", wrap.style.display);

	setPlusMinus();
}

function setPlusMinus()
{
	var wrap = document.getElementById("commentWrap");
	var sign;

	if(wrap.style.display == "none")
		sign = "+";
	else
		sign = "&ndash;";

	document.getElementById("plusminus").innerHTML = sign;
}

function initCommentsDisplay()
{
	var wrap = document.getElementById("commentWrap");

	var display = getCookie("display-comments");

	if(display.length > 0)
		wrap.style.display = display;

	setPlusMinus();
}

function setCookie(name, value, expiredays)
{
	var exdate = new Date();
	exdate.setDate(exdate.getDate() + expiredays);

	document.cookie = name + "=" + escape(value) + ((expiredays == null) ? "" : ";expires=" + exdate.toGMTString());
}

function getCookie(name)
{
	if(document.cookie.length > 0) {
		start = document.cookie.indexOf(name + "=");

		if(start != -1) {
			start = start + name.length + 1;
			end = document.cookie.indexOf(";", start);

			if(end == -1)
			    end = document.cookie.length;

			return unescape(document.cookie.substring(start, end));
		}
	}

	return "";
}

if(typeof wons == "undefined")
	wons = new Array();

wons.push("initCommentsDisplay()");

window.onload = function() {
	for(var i = 0; i < wons.length; i++)
		eval(wons[i]);
}