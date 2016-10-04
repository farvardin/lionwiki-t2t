/*********************************************************************************/
/* 5grid 0.1: A simple, flexible grid-based HTML5+CSS3 framework                 */
/* By nodethirtythree design | http://nodethirtythree.com/ | @nodethirtythree    */
/* Dual licensed under the MIT + GPLv2 license.                                  */
/*********************************************************************************/

(function() {
// Dynamically insert a suitable viewport meta tag
	var x, w = window.screen.availWidth;
	if (w <= 480)
		x = 'width=device-width; initial-scale=1.0; minimum-scale=1.0; maximum-scale=1.0;';
	else if (w > 480 && w <= 1024)
		x = 'width=1024';
	if (x) {
		var h = document.getElementsByTagName('head')[0], hfc = h.firstChild, mt = document.createElement('meta');
		mt.id = 'viewport'; mt.name = 'viewport'; mt.content = x; h.insertBefore(mt, hfc);
	}
})();