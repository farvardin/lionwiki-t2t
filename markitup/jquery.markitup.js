// ----------------------------------------------------------------------------
// markItUp! Universal MarkUp Engine, JQuery plugin
// v 1.1.x
// Dual licensed under the MIT and GPL licenses.
// ----------------------------------------------------------------------------
// Copyright (C) 2007-2011 Jay Salvat
// http://markitup.jaysalvat.com/
// ----------------------------------------------------------------------------
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
// ----------------------------------------------------------------------------
(function($) {
	$.fn.markItUp = function(settings, extraSettings) {
		var options, ctrlKey, shiftKey, altKey;
		ctrlKey = shiftKey = altKey = false;
	
		options = {	id:						'',
					nameSpace:				'',
					root:					'',
					previewInWindow:		'', // 'width=800, height=600, resizable=yes, scrollbars=yes'
					previewAutoRefresh:		true,
					previewPosition:		'after',
					previewTemplatePath:	'~/templates/preview.html',
					previewParser:			false,
					previewParserPath:		'',
					previewParserVar:		'data',
					resizeHandle:			true,
					beforeInsert:			'',
					afterInsert:			'',
					onEnter:				{},
					onShiftEnter:			{},
					onCtrlEnter:			{},
					onTab:					{},
					markupSet:			[	{ /* set */ } ]
				};
		$.extend(options, settings, extraSettings);

		// compute markItUp! path
		if (!options.root) {
			$('script').each(function(a, tag) {
				miuScript = $(tag).get(0).src.match(/(.*)jquery\.markitup(\.pack)?\.js$/);
				if (miuScript !== null) {
					options.root = miuScript[1];
				}
			});
		}

		return this.each(function() {
			var $$, textarea, levels, scrollPosition, caretPosition, caretOffset, clicked,
				hash, header, footer, previewWindow, template, iFrame, abort, tabSize;

			$$ = $(this);
			textarea = this;
			levels = [];
			abort = false;
			scrollPosition = caretPosition = 0;
			caretOffset = -1;
			if(typeof(tabMarkItUp) != "undefined") {
				tabSize = {"line": (tabMarkItUp["line"] > 0 ? tabMarkItUp["line"] : 10),
							"col": (tabMarkItUp["col"] > 0 ? tabMarkItUp["col"] : 10)};
			} else {
				tabSize = {"line": 10, "col": 10};
			}

			options.previewParserPath = localize(options.previewParserPath);
			options.previewTemplatePath = localize(options.previewTemplatePath);

			// apply the computed path to ~/
			function localize(data, inText) {
				if (inText) {
					return 	data.replace(/("|')~\//g, "$1"+options.root);
				}
				return 	data.replace(/^~\//, options.root);
			}

			// init and build editor
			function init() {
				blacklist = [".php", ".phtml", ".php3", ".php4", ".js", ".shtml", ".pl" ,".py", ".asp", ".jsp", ".sh", ".cgi", ".htaccess"];
				regexBlacklist = '';
				for(var i = 0; i < blacklist.length -2; i++) {
					regexBlacklist += blacklist[i] + '$|';
				}
				regexBlacklist += blacklist[blacklist.length -1] + '$';
				regexBlacklist = new RegExp(regexBlacklist);
				
				id = ''; nameSpace = '';
				if (options.id) {
					id = 'id="'+options.id+'"';
				} else if ($$.attr("id")) {
					id = 'id="markItUp'+($$.attr("id").substr(0, 1).toUpperCase())+($$.attr("id").substr(1))+'"';

				}
				if (options.nameSpace) {
					nameSpace = 'class="'+options.nameSpace+'"';
				}
				$$.wrap('<div '+nameSpace+'></div>');
				$$.wrap('<div '+id+' class="markItUp"></div>');
				$$.wrap('<div class="markItUpContainer"></div>');
				$$.addClass("markItUpEditor");

				// add the header before the textarea
				header = $('<div class="markItUpHeader"></div>').insertBefore($$);
				$(dropMenus(options.markupSet)).appendTo(header);

				// add the footer after the textarea
				footer = $('<div class="markItUpFooter"></div>').insertAfter($$);

				// add the resize handle after textarea
				if (options.resizeHandle === true && $.browser.safari !== true) {
					resizeHandle = $('<div class="markItUpResizeHandle"></div>')
						.insertAfter($$)
						.bind("mousedown", function(e) {
							var h = $$.height(), y = e.clientY, mouseMove, mouseUp;
							mouseMove = function(e) {
								$$.css("height", Math.max(20, e.clientY+h-y)+"px");
								return false;
							};
							mouseUp = function(e) {
								$("html").unbind("mousemove", mouseMove).unbind("mouseup", mouseUp);
								return false;
							};
							$("html").bind("mousemove", mouseMove).bind("mouseup", mouseUp);
					});
					footer.append(resizeHandle);
				}

				// add the div in the body to create table
				$("<div></div>").attr("id", "tabSize").appendTo("body");
				createPreTable(tabSize["line"],tabSize["col"]);

				$("body").append($("<div></div>").attr("id", "blackScreen"));
				$("#blackScreen").append($("<form></form>").attr("id", "pictureForm"));
				$("#pictureForm").append($("<input type='file' />").attr("id", "pictureName").change(function() {
					var path = $('#pictureName').val().split("\\");
					$("#nameImg").html(path[path.length -1]);
				}));
				$("#pictureForm").append($("<div></div>").attr("id", "iframeUpload"));
				$("#iframeUpload").append("<iframe></iframe>");
				$("#iframeUpload").append($("<div></div>").attr("id", "reload").click(function() {
					$("#iframeUpload iframe").attr("src", "index.php?page=main&template=templates/upload.html");
				}));
				$("#pictureForm").append($("<div></div>").attr("id", "nameImg").bind('DOMSubtreeModified',function() {
					if(regexBlacklist.test($("#nameImg").html())) {
						$("#nameImg").attr("class", "refuse");
					} else {
						$("#nameImg").attr("class", "valide");
					}
				}));
				$("#pictureForm").append($("<button type='button' id='yolo' class='button_txt2tags_true'>Valider</button>").click(function() {
					var path = $('#nameImg').html();
					if(regexBlacklist.test(path)) {
						alert("Le format de fichier n'est pas accepter par le site.");
					} else {
						path = path.split("\\");
						img = build(path[path.length -1]);
						var start = caretPosition + path[path.length -1].length + img.closeWith.length;
						insert(path[path.length -1]);
						set(start,0);
						get();
						$("#blackScreen").css("display", "none");
						if(!open) {
							$("#iframeUpload").css("display", "none");
							$("#pictureForm").css("width", "300px");
							open = !open;
						}
						convertText();
					}
				}));
				open = true;
				$("#pictureForm").append($("<button type='button' class='button_txt2tags_true'>Upload</button>").click(function() {
					if(open) {
						$("#iframeUpload").css("display", "block");
						$("#iframeUpload iframe").attr("src", "index.php?page=main&template=templates/upload.html");
						$("#pictureForm").css("width", "700px");
					} else {
						$("#iframeUpload").css("display", "none");
						$("#pictureForm").css("width", "300px");
					}
					open = !open;
				}));
				$("#pictureForm").append($("<button type='button' class='button_txt2tags_false'>Fermer</button>").click(function() {
					$("#blackScreen").css("display", "none");
					if(!open) {
						$("#iframeUpload").css("display", "none");
						$("#pictureForm").css("width", "300px");
						open = !open;
					}
				}));

				// listen key events
				$$.keydown(keyPressed).keyup(keyPressed);

				// bind an event to catch external calls
				$$.bind("insertion", function(e, settings) {
					if (settings.target !== false) {
						get();
					}
					if (textarea === $.markItUp.focused) {
						markup(settings);
					}
				});

				// remember the last focus
				$$.focus(function() {
					$.markItUp.focused = this;
				});
			}

			// recursively build header with dropMenus from markupset
			function dropMenus(markupSet) {
				var ul = $('<ul></ul>'), i = 0;
				$('li:hover > ul', ul).css('display', 'block');
				$.each(markupSet, function() {
					var button = this, t = '', title, li, j;
					title = (button.key) ? (button.name||'')+' [Ctrl+'+button.key+']' : (button.name||'');
					key   = (button.key) ? 'accesskey="'+button.key+'"' : '';
					if (button.separator) {
						li = $('<li class="markItUpSeparator">'+(button.separator||'')+'</li>').appendTo(ul);
					} else {
						i++;
						for (j = levels.length -1; j >= 0; j--) {
							t += levels[j]+"-";
						}
						li = $('<li class="markItUpButton markItUpButton'+t+(i)+' '+(button.className||'')+'"><a href="" '+key+' title="'+title+'">'+(button.name||'')+'</a></li>')
						.bind("contextmenu", function() { // prevent contextmenu on mac and allow ctrl+click
							return false;
						}).click(function(event) {
							if(button.name == "Table") {
								$('#tabSize').css({'left': event.pageX, 'top': event.pageY, 'display': 'block'});
							} else if(button.name == "Picture") {
								if(textarea.selectionStart == textarea.selectionEnd) {
									$('#blackScreen').css('display','block');
								}
							}
							return false;
						}).bind("focusin", function() {
                            $$.focus();
						}).mouseup(function() {
							if (button.call) {
								eval(button.call)();
							}
							setTimeout(function() { markup(button) },1);
							return false;
						}).hover(function() {
								$('> ul', this).show();
								$(document).one('click', function() { // close dropmenu if click outside
										$('ul ul', header).hide();
									}
								);
							}, function() {
								$('> ul', this).hide();
							}
						).appendTo(ul);
						if (button.dropMenu) {
							levels.push(i);
							$(li).addClass('markItUpDropMenu').append(dropMenus(button.dropMenu));
						}
					}
				}); 
				levels.pop();
				return ul;
			}

			// markItUp! markups
			function magicMarkups(string) {
				if (string) {
					string = string.toString();
					string = string.replace(/\(\!\(([\s\S]*?)\)\!\)/g,
						function(x, a) {
							var b = a.split('|!|');
							if (altKey === true) {
								return (b[1] !== undefined) ? b[1] : b[0];
							} else {
								return (b[1] === undefined) ? "" : b[0];
							}
						}
					);
					// [![prompt]!], [![prompt:!:value]!]
					string = string.replace(/\[\!\[([\s\S]*?)\]\!\]/g,
						function(x, a) {
							var b = a.split(':!:');
							if (abort === true) {
								return false;
							}
							value = prompt(b[0], (b[1]) ? b[1] : '');
							if (value === null) {
								abort = true;
							}
							return value;
						}
					);
					return string;
				}
				return "";
			}

			// prepare action
			function prepare(action) {
				if ($.isFunction(action)) {
					action = action(hash);
				}
				return magicMarkups(action);
			}

			// build block to insert
			function build(string) {
				var openWith 			= prepare(clicked.openWith);
				var placeHolder 		= prepare(clicked.placeHolder);
				var replaceWith 		= prepare(clicked.replaceWith);
				var closeWith 			= prepare(clicked.closeWith);
				var openBlockWith 		= prepare(clicked.openBlockWith);
				var closeBlockWith 		= prepare(clicked.closeBlockWith);
				var multiline 			= clicked.multiline;
				
				if (replaceWith !== "") {
					block = openWith + replaceWith + closeWith;
				} else if (selection == '' && placeHolder !== '') {
					block = openWith + placeHolder + closeWith;
				} else {
					string = string || selection;
					var lines = selection.split(/\r?\n/), blocks = [];
					for (var l=0; l < lines.length; l++) {
						line = lines[l];
						
						if(openWith != '') {
							var spacesBeg;
							var spacesEnd;
							if(spacesBeg = line.match(/^ */)) {
								openWith = spacesBeg + openWith;
								line = line.replace(/^ */g, '');
							}
							if(spacesEnd = line.match(/ *$/)) {
								closeWith += spacesEnd;
								line = line.replace(/ *$/g, '');
							}
							if((openWith == "+ " || openWith == "- ") && selection == "") openWith = "\n\n" + openWith;
							if(openWith == "\t") openWith = "\n" + openWith;
							if(/^ *=/.test(open)) {
								openWith = "\n" + openWith;
								closeWith += "\n";
							}
							line = addTag(line, openWith, closeWith);
						} else {
							line = deleteTag(line);
						}
						
						blocks.push(line);
					}
					block = blocks.join("\n");
				}
				
				block = openBlockWith + block + closeBlockWith;
				
				return {	block:block, 
							openWith:openWith, 
							replaceWith:replaceWith, 
							placeHolder:placeHolder,
							closeWith:closeWith
					};
			}

			// define markup to insert
			function markup(button) {
				var len, j, n, i;
				var b = false;
				hash = clicked = button;
				get();
				$.extend(hash, {	line:"", 
						 			root:options.root,
									textarea:textarea, 
									selection:(selection||''), 
									caretPosition:caretPosition,
									ctrlKey:ctrlKey, 
									shiftKey:shiftKey, 
									altKey:altKey
								}
							);
				// callbacks before insertion
				prepare(options.beforeInsert);
				prepare(clicked.beforeInsert);
				if ((ctrlKey === true && shiftKey === true) || button.multiline === true) {
					prepare(clicked.beforeMultiInsert);
				}			
				$.extend(hash, { line:1 });

				if ((ctrlKey === true && shiftKey === true)) {
					lines = selection.split(/\r?\n/);
					for (j = 0, n = lines.length, i = 0; i < n; i++) {
						if ($.trim(lines[i]) !== '') {
							$.extend(hash, { line:++j, selection:lines[i] } );
							lines[i] = build(lines[i]).block;
						} else {
							lines[i] = "";
						}
					}
					string = { block:lines.join('\n')};
					start = caretPosition;
					len = string.block.length + (($.browser.opera) ? n-1 : 0);
				} else if (ctrlKey === true) {
					string = build(selection);
					start = caretPosition + string.openWith.length;
					len = string.block.length - string.openWith.length - string.closeWith.length;
					len = len - (string.block.match(/ $/) ? 1 : 0);
					len -= fixIeBug(string.block);
				} else if (shiftKey === true) {
					string = build(selection);
					start = caretPosition;
					len = string.block.length;
					len -= fixIeBug(string.block);
				} else {
					string = build(selection);
					if(string.openWith == '') {
						start = caretPosition;
						len = string.block.length;
					} else {
						b = sameTag(string.openWith, textarea, selection);
						if(b) {
							start = caretPosition - string.openWith.length;
						} else {
							start = caretPosition + string.openWith.length;
						}
						len = selection.length - (selection.match(/^ /) ? 1 : 0) - (selection.match(/ $/) ? 1 : 0);
					}
					start -= fixIeBug(string.block);
				}
				
				if ((selection === '' && string.replaceWith === '')) {
					caretOffset += fixOperaBug(string.block);
					start = caretPosition + string.openWith.length;
					len = string.block.length - string.openWith.length - string.closeWith.length;
					
					caretOffset = $$.val().substring(caretPosition,  $$.val().length).length;
					caretOffset -= fixOperaBug($$.val().substring(0, caretPosition));
				}
				$.extend(hash, { caretPosition:caretPosition, scrollPosition:scrollPosition } );
				
				if (string.block !== selection && abort === false && !b) {
					insert(string.block);
					set(start,len);
				} else {
					set(start,len);			// à verif
					caretOffset = -1;
				}
				get();
				$.extend(hash, { line:'', selection:selection });

				// callbacks after insertion
				if ((ctrlKey === true && shiftKey === true) || button.multiline === true) {
					prepare(clicked.afterMultiInsert);
				}
				prepare(clicked.afterInsert);
				prepare(options.afterInsert);

				// refresh preview if opened
				if (previewWindow && options.previewAutoRefresh) {
					refreshPreview(); 
				}
				convertText();
				
				// reinit keyevent
				shiftKey = altKey = ctrlKey = abort = false;
			}

			// Substract linefeed in Opera
			function fixOperaBug(string) {
				if ($.browser.opera) {
					return string.length - string.replace(/\n*/g, '').length;
				}
				return 0;
			}
			// Substract linefeed in IE
			function fixIeBug(string) {
				if ($.browser.msie) {
					return string.length - string.replace(/\r*/g, '').length;
				}
				return 0;
			}
			
			function addTag(line, open, close) {
				if(/^ *=/.test(open)) {
					line = line.replace(/(={1,5}\s*)|(\s*={1,5})/g, '');
				} else if(/^ *\*\*/.test(open)) {
					line = line.replace(/(?!``)?(\*\*)(?!``)/g, '');
				} else if(/^ *\/\//.test(open)) {
					line = line.replace(/(?!``)?(\/\/)(?!``)/g, '');
				} else if(/^ *__/.test(open)) {
					line = line.replace(/(?!``)?(__)(?!``)/g, '');
				} else if(/^ *--/.test(open)) {
					line = line.replace(/(?!``)?(--)(?!``)/g, '');
				} else if(/^ *``/.test(open)) {
					line = line.replace(/(``)/g, '');
				} else if(/^ *""/.test(open)) {
					line = line.replace(/(?!``)?("")(?!``)/g, '');
				}
				line = open + line + close;
				return line;
			}
			
			function deleteTag(line) {
				return line.replace(/\*{2}|\/{2}|_{2}|-{2}|^(={1,5})\s|\s(={1,5})$/g, '');
			}
			
			function sameTag(open, textarea, sel) {
				if(/^ *=====/.test(open) && '===== ' == textarea.value.substring(caretPosition -6, caretPosition)
					&& ' =====' == textarea.value.substring(caretPosition + sel.length, caretPosition + sel.length +6)
				) {
					textarea.value = textarea.value.substring(0, caretPosition -6)
								   + textarea.value.substring(caretPosition, caretPosition + sel.length)
								   + textarea.value.substring(caretPosition + sel.length +6, textarea.length);
					return true;
				} else if(/^ *====/.test(open) && '==== ' == textarea.value.substring(caretPosition -5, caretPosition)
					&& ' ====' == textarea.value.substring(caretPosition + sel.length, caretPosition + sel.length +5)
				) {
					textarea.value = textarea.value.substring(0, caretPosition -5)
								   + textarea.value.substring(caretPosition, caretPosition + sel.length)
								   + textarea.value.substring(caretPosition + sel.length +5, textarea.length);
					return true;
				} else if(/^ *===/.test(open) && '=== ' == textarea.value.substring(caretPosition -4, caretPosition)
					&& ' ===' == textarea.value.substring(caretPosition + sel.length, caretPosition + sel.length +4)
				) {
					textarea.value = textarea.value.substring(0, caretPosition -4)
								   + textarea.value.substring(caretPosition, caretPosition + sel.length)
								   + textarea.value.substring(caretPosition + sel.length +4, textarea.length);
					return true;
				} else if(/^ *==/.test(open) && '== ' == textarea.value.substring(caretPosition -3, caretPosition)
					&& ' ==' == textarea.value.substring(caretPosition + sel.length, caretPosition + sel.length +3)
				) {
					textarea.value = textarea.value.substring(0, caretPosition -3)
								   + textarea.value.substring(caretPosition, caretPosition + sel.length)
								   + textarea.value.substring(caretPosition + sel.length +3, textarea.length);
					return true;
				} else if(/\*\*/.test(open) && '**' == textarea.value.substring(caretPosition -2, caretPosition)
					&& '**' == textarea.value.substring(caretPosition + sel.length, caretPosition + sel.length +2)
					|| /^ *\/\//.test(open) && '//' == textarea.value.substring(caretPosition -2, caretPosition)
					&& '//' == textarea.value.substring(caretPosition + sel.length, caretPosition + sel.length +2)
					|| /^ *__/.test(open) && '__' == textarea.value.substring(caretPosition -2, caretPosition)
					&& '__' == textarea.value.substring(caretPosition + sel.length, caretPosition + sel.length +2)
					|| /^ *--/.test(open) && '--' == textarea.value.substring(caretPosition -2, caretPosition)
					&& '--' == textarea.value.substring(caretPosition + sel.length, caretPosition + sel.length +2)
					|| /^ *``/.test(open) && '``' == textarea.value.substring(caretPosition -2, caretPosition)
					&& '``' == textarea.value.substring(caretPosition + sel.length, caretPosition + sel.length +2)
					|| /^ *""/.test(open) && '""' == textarea.value.substring(caretPosition -2, caretPosition)
					&& '""' == textarea.value.substring(caretPosition + sel.length, caretPosition + sel.length +2)
					|| /^ *""/.test(open) && '""' == textarea.value.substring(caretPosition -2, caretPosition)
					&& '""' == textarea.value.substring(caretPosition + sel.length, caretPosition + sel.length +2)
					|| /^ *=/.test(open) && '= ' == textarea.value.substring(caretPosition -2, caretPosition)
					&& ' =' == textarea.value.substring(caretPosition + sel.length, caretPosition + sel.length +2)
				) {
					textarea.value = textarea.value.substring(0, caretPosition -2)
								   + textarea.value.substring(caretPosition, caretPosition + sel.length)
								   + textarea.value.substring(caretPosition + sel.length +2, textarea.length);
					return true;
				} else if(/\[/.test(open) && '[' == textarea.value.substring(caretPosition -1, caretPosition)
					&& ']' == textarea.value.substring(caretPosition + sel.length, caretPosition + sel.length +1)) {
					
					textarea.value = textarea.value.substring(0, caretPosition -1)
								   + textarea.value.substring(caretPosition, caretPosition + sel.length)
								   + textarea.value.substring(caretPosition + sel.length +1, textarea.length);
					return true;
				} else return false;
			}
				
			// add markup
			function insert(block) {	
				if (document.selection) {
					var newSelection = document.selection.createRange();
					newSelection.text = block;
				} else {
					textarea.value =  textarea.value.substring(0, caretPosition)  + block + textarea.value.substring(caretPosition + selection.length, textarea.value.length);
				}
			}

			// set a selection
			function set(start, len) {
				if (textarea.createTextRange){
					// quick fix to make it work on Opera 9.5
					if ($.browser.opera && $.browser.version >= 9.5 && len == 0) {
						return false;
					}
					range = textarea.createTextRange();
					range.collapse(true);
					range.moveStart('character', start); 
					range.moveEnd('character', len); 
					range.select();
				} else if (textarea.setSelectionRange ){
					textarea.setSelectionRange(start, start + len);
				}
				textarea.scrollTop = scrollPosition;
				textarea.focus();
			}

			// get the selection
			function get() {
				textarea.focus();

				scrollPosition = textarea.scrollTop;
				if (document.selection) {
					selection = document.selection.createRange().text;
					if ($.browser.msie) { // ie
						var range = document.selection.createRange(), rangeCopy = range.duplicate();
						rangeCopy.moveToElementText(textarea);
						caretPosition = -1;
						while(rangeCopy.inRange(range)) {
							rangeCopy.moveStart('character');
							caretPosition ++;
						}
					} else { // opera
						caretPosition = textarea.selectionStart;
					}
				} else { // gecko & webkit
					caretPosition = textarea.selectionStart;

					selection = textarea.value.substring(caretPosition, textarea.selectionEnd);
				} 
				return selection;
			}

			// open preview window
			function preview() {
				if (!previewWindow || previewWindow.closed) {
					if (options.previewInWindow) {
						previewWindow = window.open('', 'preview', options.previewInWindow);
						$(window).unload(function() {
							previewWindow.close();
						});
					} else {
						iFrame = $('<iframe class="markItUpPreviewFrame"></iframe>');
						if (options.previewPosition == 'after') {
							iFrame.insertAfter(footer);
						} else {
							iFrame.insertBefore(header);
						}	
						previewWindow = iFrame[iFrame.length - 1].contentWindow || frame[iFrame.length - 1];
					}
				} else if (altKey === true) {
					if (iFrame) {
						iFrame.remove();
					} else {
						previewWindow.close();
					}
					previewWindow = iFrame = false;
				}
				if (!options.previewAutoRefresh) {
					refreshPreview(); 
				}
				if (options.previewInWindow) {
					previewWindow.focus();
				}
			}

			// refresh Preview window
			function refreshPreview() {
 				renderPreview();
			}

			function renderPreview() {		
				var phtml;
				if (options.previewParser && typeof options.previewParser === 'function') {
					var data = options.previewParser( $$.val() );
					writeInPreview( localize(data, 1) ); 
				} else if (options.previewParserPath !== '') {
					$.ajax({
						type: 'POST',
						dataType: 'text',
						global: false,
						url: options.previewParserPath,
						data: options.previewParserVar+'='+encodeURIComponent($$.val()),
						success: function(data) {
							writeInPreview( localize(data, 1) ); 
						}
					});
				} else {
					if (!template) {
						$.ajax({
							url: options.previewTemplatePath,
							dataType: 'text',
							global: false,
							success: function(data) {
								writeInPreview( localize(data, 1).replace(/<!-- content -->/g, $$.val()) );
							}
						});
					}
				}
				return false;
			}
			
			function writeInPreview(data) {
				if (previewWindow.document) {			
					try {
						sp = previewWindow.document.documentElement.scrollTop
					} catch(e) {
						sp = 0;
					}	
					previewWindow.document.open();
					previewWindow.document.write(data);
					previewWindow.document.close();
					previewWindow.document.documentElement.scrollTop = sp;
				}
			}
			
			// set keys pressed
			function keyPressed(e) { 
				shiftKey = e.shiftKey;
				altKey = e.altKey;
				ctrlKey = (!(e.altKey && e.ctrlKey)) ? (e.ctrlKey || e.metaKey) : false;

				if (e.type === 'keydown') {
					if (ctrlKey === true) {
						li = $('a[accesskey="'+String.fromCharCode(e.keyCode)+'"]', header).parent('li');
						if (li.length !== 0) {
							ctrlKey = false;
							setTimeout(function() {
								li.triggerHandler('mouseup');
							},1);
							return false;
						}
					}
					if (e.keyCode === 13 || e.keyCode === 10) { // Enter key
						if (ctrlKey === true) {  // Enter + Ctrl
							ctrlKey = false;
							markup(options.onCtrlEnter);
							return options.onCtrlEnter.keepDefault;
						} else if (shiftKey === true) { // Enter + Shift
							shiftKey = false;
							markup(options.onShiftEnter);
							return options.onShiftEnter.keepDefault;
						} else { // only Enter
							markup(options.onEnter);
							return options.onEnter.keepDefault;
						}
					}
					if (e.keyCode === 9) { // Tab key
						if (shiftKey == true || ctrlKey == true || altKey == true) {
							return false; 
						}
						if (caretOffset !== -1) {
							get();
							caretOffset = $$.val().length - caretOffset;
							set(caretOffset, 0);
							caretOffset = -1;
							return false;
						} else {
							markup(options.onTab);
							return options.onTab.keepDefault;
						}
					}
				}
			}
			
			function createPreTable(l,c) {
				$('#tabSize').html('<table><thead></thead><tbody></tbody></table>');
				
				// thead
				$('#tabSize thead').append('<td colspan=' +c+ '>Annuler')
				.click(function() {
					$('#tabSize').css('display', 'none');
				}).mouseover(function() {
					for(var i = 1; i <= tabSize["line"]; i++) {
						for(var j = 1; j <= tabSize["line"]; j++) {
							$('#l' + i + 'c' + j).css('background-color', 'rgba(230,230,230,0.8)');
						}
					}
				});

				// tbody first line
				$('#tabSize tbody').append('<tr>');
				for(var j = 1; j <= c; j++) {
					$('#tabSize tr').append('<td>' + j);
					$('#tabSize td:last').attr('id', 'l1c' + j)
					.click({line:1, col:j},createTab)
					.mouseover({line:1, col:j},tabSizeHover);
				}
				
				// tbody others line
				for(var i = 2; i <= l; i++) {
					$('#tabSize tbody').append('<tr>');
					for(var j = 1; j <= c; j++) {
						$('#tabSize tr:last').append('<td>' + (j == 1 ? i : ''));
						$('#tabSize td:last').attr('id', 'l' + i + 'c' + j)
						.click({line:i, col:j},createTab)
						.mouseover({line:i, col:j},tabSizeHover);
					}
				}
			}
			
			function tabSizeHover(event) {
				for(var i = 1; i <= tabSize["line"]; i++) {
					for(var j = 1; j <= tabSize["col"]; j++) {
						if(i <= event.data.line && j <= event.data.col) {
							$("#l" + i + "c" + j).css('background-color', 'rgba(200,200,200,0.8)');
						} else {
							$("#l" + i + "c" + j).css('background-color', 'rgba(230,230,230,0.8)');
						}
					}
				}
			}
			
			function createTab(event) {
				$('#tabSize').css('display', 'none');
				var scrollPos = inputPane.scrollTop;
				var pos = Math.max(inputPane.selectionStart, inputPane.selectionEnd);
				var selection = "\n|";
				for(var i = 0; i < event.data.line; i++) {
					for(var j = 0; j < event.data.col; j++) {
						(i == 0 && j == 0) ? selection += "| item" : selection += " | item";
					}
					selection += " |\n";
				}
				selection += "\n";
				
				var cursPos = pos + selection.length;
				inputPane.value = inputPane.value.substring(0, pos) + selection + inputPane.value.substring(pos, inputPane.value.length);
				inputPane.focus();
				inputPane.setSelectionRange(cursPos, cursPos);
				inputPane.scrollTop = scrollPos;
				previewPane.scrollTop = scrollPos;
				onConvertTextButtonClicked();
			}

			init();
		});
	};
	
	$.removeBlackScreen = function() {
		$('#blackScreen').replaceWith();
	}

	$.fn.markItUpRemove = function() {
		return this.each(function() {
				var $$ = $(this).unbind().removeClass('markItUpEditor');
				$$.parent('div').parent('div.markItUp').parent('div').replaceWith($$);
				$('#tabSize').replaceWith();
				$.removeBlackScreen();
			}
		);
	};

	$.markItUp = function(settings) {
		var options = { target:false };
		$.extend(options, settings);
		if (options.target) {
			return $(options.target).each(function() {
				$(this).focus();
				$(this).trigger('insertion', [options]);
			});
		} else {
			$('textarea').trigger('insertion', [options]);
		}
	};
})(jQuery);
