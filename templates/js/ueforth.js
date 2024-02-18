// Copyright 2021 Bradley D. Nelson
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'; 

(function() {

const HEAP_SIZE = (4 * 1024 * 1024);
const STACK_CELLS = 4096;
const VOCABULARY_DEPTH = 16;

const IMMEDIATE = 1;
const SMUDGE = 2;
const BUILTIN_FORK = 4;
const BUILTIN_MARK = 8;

const DEBUGGING = false;

const boot = `
: (   41 parse drop drop ; immediate
: \\   10 parse drop drop ; immediate
: #!   10 parse drop drop ; immediate  ( shebang for scripts )
( Now can do comments! )
: aligned ( a -- a ) cell 1 - dup >r + r> invert and ;
: align   here aligned here - allot ;

( Dictionary Format )
: >flags& ( xt -- a ) cell - ;   : >flags ( xt -- flags ) >flags& c@ ;
: >name-length ( xt -- n ) >flags& 1+ c@ ;
: >params ( xt -- n ) >flags& 2 + sw@ $ffff and ;
: >size ( xt -- n ) dup >params cells swap >name-length aligned + 3 cells + ;
: >link& ( xt -- a ) 2 cells - ;   : >link ( xt -- a ) >link& @ ;
( Stack Baseline )
sp@ constant sp0
rp@ constant rp0
fp@ constant fp0
: depth ( -- n ) sp@ sp0 - cell/ ;
: fdepth ( -- n ) fp@ fp0 - 4 / ;

( Useful heap size words )
: remaining ( -- n ) 'heap-start @ 'heap-size @ + 'heap @ - ;
: used ( -- n ) 'heap @ sp@ 'stack-cells @ cells + - 28 + ;

( Quoting Words )
: ' bl parse 2dup find dup >r -rot r> 0= 'notfound @ execute 2drop ;
: ['] ' aliteral ; immediate
: char bl parse drop c@ ;
: [char] char aliteral ; immediate

( Core Control Flow )
create BEGIN ' nop @ ' begin !        : begin   ['] begin , here ; immediate
create AGAIN ' branch @ ' again !     : again   ['] again , , ; immediate
create UNTIL ' 0branch @ ' until !    : until   ['] until , , ; immediate
create AHEAD ' branch @ ' ahead !     : ahead   ['] ahead , here 0 , ; immediate
create THEN ' nop @ ' then !          : then   ['] then , here swap ! ; immediate
create IF ' 0branch @ ' if !          : if   ['] if , here 0 , ; immediate
create ELSE ' branch @ ' else !       : else   ['] else , here 0 , swap here swap ! ; immediate
create WHILE ' 0branch @ ' while !    : while   ['] while , here 0 , swap ; immediate
create REPEAT ' branch @ ' repeat !   : repeat   ['] repeat , , here swap ! ; immediate
create AFT ' branch @ ' aft !         : aft   drop ['] aft , here 0 , here swap ; immediate

( Recursion )
: recurse   current @ @ aliteral ['] execute , ; immediate

( Postpone - done here so we have ['] and IF )
: immediate? ( xt -- f ) >flags 1 and 0= 0= ;
: postpone ' dup immediate? if , else aliteral ['] , , then ; immediate

( Rstack nest depth )
variable nest-depth

( FOR..NEXT )
create FOR ' >r @ ' for !         : for   1 nest-depth +! ['] for , here ; immediate
create NEXT ' donext @ ' next !   : next   -1 nest-depth +! ['] next , , ; immediate

( DO..LOOP )
variable leaving
: leaving,   here leaving @ , leaving ! ;
: leaving(   leaving @ 0 leaving !   2 nest-depth +! ;
: )leaving   leaving @ swap leaving !  -2 nest-depth +!
             begin dup while dup @ swap here swap ! repeat drop ;
: DO ( n n -- .. ) swap r> -rot >r >r >r ;
: do ( lim s -- ) leaving( postpone DO here ; immediate
: ?DO ( n n -- n n f .. )
   2dup = if 2drop r> @ >r else swap r> cell+ -rot >r >r >r then ;
: ?do ( lim s -- ) leaving( postpone ?DO leaving, here ; immediate
: UNLOOP   r> rdrop rdrop >r ;
: LEAVE   r> rdrop rdrop @ >r ;
: leave   postpone LEAVE leaving, ; immediate
: +LOOP ( n -- ) dup 0< swap r> r> rot + dup r@ < -rot >r >r xor 0=
                 if r> cell+ rdrop rdrop >r else r> @ >r then ;
: +loop ( n -- ) postpone +LOOP , )leaving ; immediate
: LOOP   r> r> 1+ dup r@ < -rot >r >r 0=
         if r> cell+ rdrop rdrop >r else r> @ >r then ;
: loop   postpone LOOP , )leaving ; immediate
create I ' r@ @ ' i !  ( i is same as r@ )
: J ( -- n ) rp@ 3 cells - @ ;
: K ( -- n ) rp@ 5 cells - @ ;

( Exceptions )
variable handler
handler 'throw-handler !
: catch ( xt -- n )
  fp@ >r sp@ >r handler @ >r rp@ handler ! execute
  r> handler ! rdrop rdrop 0 ;
: throw ( n -- )
  dup if handler @ rp! r> handler !
         r> swap >r sp! drop r> r> fp! else drop then ;
' throw 'notfound !

( Values )
: value ( n -- ) constant ;
: value-bind ( xt-val xt )
   >r >body state @ if
     r@ ['] ! = if rdrop ['] doset , , else aliteral r> , then
   else r> execute then ;
: to ( n -- ) ' ['] ! value-bind ; immediate
: +to ( n -- ) ' ['] +! value-bind ; immediate

( Deferred Words )
: defer ( "name" -- ) create 0 , does> @ dup 0= throw execute ;
: is ( xt "name -- ) postpone to ; immediate
: >name ( xt -- a n )
  dup >flags 8 and if
    dup >link swap >name-length
  else
    dup >name-length swap >link& over aligned - swap
  then
;

: fill32 ( a n v ) swap >r swap r> 0 ?do 2dup ! cell+ loop 2drop ;
( Defer I/O to platform specific )
defer type
defer key
defer key?
defer terminate
: bye   0 terminate ;
: emit ( n -- ) >r rp@ 1 type rdrop ;
: space bl emit ;   : cr 13 emit nl emit ;

( Numeric Output )
variable hld
: pad ( -- a ) here 80 + ;
: digit ( u -- c ) 9 over < 7 and + 48 + ;
: extract ( n base -- n c ) u/mod swap digit ;
: <# ( -- ) pad hld ! ;
: hold ( c -- ) hld @ 1 - dup hld ! c! ;
: # ( u -- u ) base @ extract hold ;
: #s ( u -- 0 ) begin # dup while repeat ;
: sign ( n -- ) 0< if 45 hold then ;
: #> ( w -- b u ) drop hld @ pad over - ;
: str ( n -- b u ) dup >r abs <# #s r> sign #> ;
: hex ( -- ) 16 base ! ;   : octal ( -- ) 8 base ! ;
: decimal ( -- ) 10 base ! ;   : binary ( -- ) 2 base ! ;
: u. ( u -- ) <# #s #> type space ;
: . ( w -- ) base @ 10 xor if u. exit then str type space ;
: ? ( a -- ) @ . ;
: n. ( n -- ) base @ swap decimal <# #s #> type base ! ;

( Strings )
: parse-quote ( -- a n ) [char] " parse ;
: $place ( a n -- ) for aft dup c@ c, 1+ then next drop ;
: zplace ( a n -- ) $place 0 c, align ;
: $@   r@ dup cell+ swap @ r> dup @ 1+ aligned + cell+ >r ;
: s"   parse-quote state @ if postpone $@ dup , zplace
       else dup here swap >r >r zplace r> r> then ; immediate
: ."   postpone s" state @ if postpone type else type then ; immediate
: z"   postpone s" state @ if postpone drop else drop then ; immediate
: r"   parse-quote state @ if swap aliteral aliteral then ; immediate
: r|   [char] | parse state @ if swap aliteral aliteral then ; immediate
: r~   [char] ~ parse state @ if swap aliteral aliteral then ; immediate
: s>z ( a n -- z ) here >r zplace r> ;
: z>s ( z -- a n ) 0 over begin dup c@ while 1+ swap 1+ swap repeat drop ;

( Better Errors )
: notfound ( a n n -- )
   if cr ." ERROR: " type ."  NOT FOUND!" cr -1 throw then ;
' notfound 'notfound !

( Abort )
: abort   -1 throw ;
: abort"   postpone ." postpone cr -2 aliteral postpone throw ; immediate

( Input )
: raw.s   depth 0 max for aft sp@ r@ cells - @ . then next ;
variable echo -1 echo !   variable arrow -1 arrow !  0 value wascr
: *emit ( n -- ) dup 13 = if drop cr else emit then ;
: ?echo ( n -- ) echo @ if *emit else drop then ;
: ?arrow.   arrow @ if >r >r raw.s r> r> ." --> " then ;
: *key ( -- n )
  begin
    key
    dup nl = if
      drop wascr if 0 else 13 exit then
    then
    dup 13 = to wascr
    dup if exit else drop then
  again ;
: eat-till-cr   begin *key dup 13 = if ?echo exit else drop then again ;
: accept ( a n -- n ) ?arrow. 0 swap begin 2dup < while
     *key
     dup 13 = if ?echo drop nip exit then
     dup 8 = over 127 = or if
       drop over if rot 1- rot 1- rot 8 ?echo bl ?echo 8 ?echo then
     else
       dup ?echo
       >r rot r> over c! 1+ -rot swap 1+ swap
     then
   repeat drop nip
   eat-till-cr
;
200 constant input-limit
: tib ( -- a ) 'tib @ ;
create input-buffer   input-limit allot
: tib-setup   input-buffer 'tib ! ;
: refill   tib-setup tib input-limit accept #tib ! 0 >in ! -1 ;

( Stack Guards )
sp0 'stack-cells @ 2 3 */ cells + constant sp-limit
: ?stack   sp@ sp0 < if ." STACK UNDERFLOW " -4 throw then
           sp-limit sp@ < if ." STACK OVERFLOW " -3 throw then ;

( REPL )
: prompt   ."  ok" cr ;
: evaluate-buffer   begin >in @ #tib @ < while evaluate1 ?stack repeat ;
: evaluate ( a n -- ) 'tib @ >r #tib @ >r >in @ >r
                      #tib ! 'tib ! 0 >in ! evaluate-buffer
                      r> >in ! r> #tib ! r> 'tib ! ;
: evaluate&fill
   begin >in @ #tib @ >= if prompt refill drop then evaluate-buffer again ;
: quit
   #tib @ >in !
   begin ['] evaluate&fill catch
         if 0 state ! sp0 sp! fp0 fp! rp0 rp! ."  ERROR " cr then
   again ;
variable boot-prompt
: free. ( nf nu -- ) 2dup swap . ." free + " . ." used = " 2dup + . ." total ("
                     over + 100 -rot */ n. ." % free)" ;
: raw-ok   ."  v7.0.7.9 - rev fb3db70da6d111b1fdf0" cr
           boot-prompt @ if boot-prompt @ execute then
           ." Forth dictionary: " remaining used free. cr
           ." 3 x Forth stacks: " 'stack-cells @ cells . ." bytes each" cr
           quit ;
( Interpret time conditionals )

: DEFINED? ( "name" -- xt|0 )
   begin bl parse dup 0= while 2drop refill 0= throw repeat
   find state @ if aliteral then ; immediate
defer [SKIP]
: [THEN] ; immediate
: [ELSE] [SKIP] ; immediate
: [IF] 0= if [SKIP] then ; immediate
: [SKIP]' 0 begin postpone defined? dup if
    dup ['] [IF] = if swap 1+ swap then
    dup ['] [ELSE] = if swap dup 0 <= if 2drop exit then swap then
    dup ['] [THEN] = if swap 1- dup 0< if 2drop exit then swap then
  then drop again ;
' [SKIP]' is [SKIP]
( Implement Vocabularies )
( normal: link, flags&len, code )
( vocab:  link, flags&len, code | link , len=0, voclink )
variable last-vocabulary
: vocabulary ( "name" )
  create current @ 2 cells + , 0 , last-vocabulary @ ,
  current @ @ last-vocabulary !
  does> context ! ;
: definitions   context @ current ! ;
vocabulary FORTH
' forth >body @ >link ' forth >body !
forth definitions

( Make it easy to transfer words between vocabularies )
: xt-find& ( xt -- xt& ) context @ begin 2dup @ <> while @ >link& repeat nip ;
: xt-hide ( xt -- ) xt-find& dup @ >link swap ! ;
8 constant BUILTIN_MARK
: xt-transfer ( xt --  ) dup >flags BUILTIN_MARK and if drop exit then
  dup xt-hide   current @ @ over >link& !   current @ ! ;
: transfer ( "name" ) ' xt-transfer ;
: }transfer ;
: transfer{ begin ' dup ['] }transfer = if drop exit then xt-transfer again ;

( Watered down versions of these )
: only   forth 0 context cell+ ! ;
: voc-stack-end ( -- a ) context begin dup @ while cell+ repeat ;
: also   context context cell+ voc-stack-end over - 2 cells + cmove> ;
: previous
  voc-stack-end context cell+ = throw
  context cell+ context voc-stack-end over - cell+ cmove ;
: sealed   0 last-vocabulary @ >body ! ;

( Hide some words in an internals vocabulary )
vocabulary internals   internals definitions

( Vocabulary chain for current scope, place at the -1 position )
variable scope   scope context cell - !

transfer{
  xt-find& xt-hide xt-transfer
  voc-stack-end last-vocabulary notfound
  *key *emit wascr eat-till-cr
  immediate? input-buffer ?echo ?arrow. arrow
  evaluate-buffer evaluate&fill aliteral value-bind
  leaving( )leaving leaving leaving,
  parse-quote digit $@ raw.s
  tib-setup input-limit sp-limit ?stack
  [SKIP] [SKIP]' raw-ok boot-prompt free.
  $place zplace BUILTIN_MARK
}transfer

( Move branching opcodes to separate vocabulary )
vocabulary internalized  internalized definitions
: cleave   ' >link xt-transfer ;
cleave begin   cleave again   cleave until
cleave ahead   cleave then    cleave if
cleave else    cleave while   cleave repeat
cleave aft     cleave for     cleave next
cleave do      cleave ?do     cleave +loop
cleave loop    cleave leave

forth definitions

( Make DOES> switch to compile mode when interpreted )
(
forth definitions internals
' does>
: does>   state @ if postpone does> exit then
          ['] constant @ current @ @ dup >r !
          here r> cell+ ! postpone ] ; immediate
xt-hide
forth definitions
)
: sf, ( r -- ) here sf! sfloat allot ;

: afliteral ( r -- ) ['] DOFLIT , sf, align ;
: fliteral   afliteral ; immediate

: fconstant ( r "name" ) create sf, align does> sf@ ;
: fvariable ( "name" ) create sfloat allot align ;

6 value precision
: set-precision ( n -- ) to precision ;

internals definitions
: #f+s ( r -- ) fdup precision for aft 10e f* then next
                precision for aft fdup f>s 10 mod [char] 0 + hold 0.1e f* then next
                [char] . hold fdrop f>s #s ;
forth definitions internals

: #fs ( r -- ) fdup f0< if fnegate #f+s [char] - hold else #f+s then ;
: f. ( r -- ) <# #fs #> type space ;
: f.s   ." <" fdepth n. ." > "
        fdepth 0 max for aft fp@ r@ sfloats - sf@ f. then next ;

forth definitions
( Vocabulary for building C-style structures )

vocabulary structures   structures definitions

variable last-align
: typer ( align sz "name" ) create , ,
                            does> dup cell+ @ last-align ! @ ;
1 1 typer i8
2 2 typer i16
4 4 typer i32
cell 8 typer i64
cell cell typer ptr
long-size long-size typer long

variable last-struct

: struct ( "name" ) 1 0 typer latestxt >body last-struct ! ;
: align-by ( a n -- a ) 1- dup >r + r> invert and ;
: struct-align ( n -- )
  dup last-struct @ cell+ @ max last-struct @ cell+ !
  last-struct @ @ swap align-by last-struct @ ! ;
: field ( n "name" )
  last-align @ struct-align
  create last-struct @ @ , last-struct @ +!
  does> @ + ;

forth definitions
vocabulary web   web definitions

: jseval! ( a n index -- ) 0 call ;

r~
(function(sp) {
  var slot = i32[sp>>2]; sp -= 4;
  var n = i32[sp>>2]; sp -= 4;
  var a = i32[sp>>2]; sp -= 4;
  var text = GetString(a, n);
  var parts = text.split('\\n');
  var args = parts[0].split(' ');
  var code = '(function(sp) {\\n';
  code += 'var results = (function() {\\n';
  var params = [];
  var results = [];
  var at_results = false;
  for (var i = 0; i < args.length; ++i) {
    if (args[i].length === 0 ||
        args[i] === '{' ||
        args[i] === '}') {
      continue;
    }
    if (args[i] === '--') {
      at_results = true;
      continue;
    }
    if (at_results) {
      results.push(args[i]);
    } else {
      params.push(args[i]);
    }
  }
  for (var i = params.length - 1; i >= 0; --i) {
    code += 'var ' + params[i] + ' = i32[sp>>2]; sp -= 4;\\n';
  }
  code += parts.slice(1).join('\\n');
  code += '})();\\n';
  if (results.length === 1) {
    code += 'sp += 4; i32[sp>>2] = results;\\n';
  } else {
    for (var i = 0; i < results.length; ++i) {
      code += 'sp += 4; i32[sp>>2] = results[' + i + '];\\n';
    }
  }
  code += 'return sp;\\n';
  code += '})\\n';
  objects[slot] = eval(code);
  return sp;
})
~ 1 jseval!

2 value jsslot
: JSWORD: ( "args.." )
   create postpone r~ jsslot 1 call jsslot , 1 +to jsslot
   does> @ call ;

JSWORD: jseval { a n }
  var text = GetString(a, n);
  eval(text);
~

r~
globalObj.ueforth = context;
context.inbuffer = [];
context.Update = function() {};
if (!globalObj.write) {
  function AddMeta(name, content) {
    var meta = document.createElement('meta');
    meta.name = name;
    meta.content = content;
    document.head.appendChild(meta);
  }

  AddMeta('apple-mobile-web-app-capable', 'yes');
  AddMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  AddMeta('viewport', 'width=device-width, initial-scale=1.0, ' +
                      'maximum-scale=1.0, user-scalable=no, minimal-ui');

  context.screen = document.getElementById('ueforth');
  if (context.screen === null) {
    context.screen = document.createElement('div');
    context.screen.style.width = '100%';
    document.body.appendChild(context.screen);
  }
  context.filler = document.createElement('div');
  document.body.insertBefore(context.filler, document.body.firstChild);
  context.canvas = document.createElement('canvas');
//  context.canvas.width = 1000;
//  context.canvas.height = 1000;
//  context.canvas.style.width = '1px';
//  context.canvas.style.height = '1px';
//  context.canvas.style.top = 0;
//  context.canvas.style.left = 0;
//  context.canvas.style.position = 'fixed';
//  context.canvas.style.backgroundColor = '#fff';
  context.screen.appendChild(context.canvas);
  context.ctx = context.canvas.getContext('2d');

  context.mouse_x = 0;
  context.mouse_y = 0;
  context.mouse_b = 0;
  context.canvas.onpointermove = function(e) {
    context.mouse_x = e.clientX;
    context.mouse_y = e.clientY;
  };
  context.canvas.onpointerdown = function(e) {
    context.mouse_x = e.clientX;
    context.mouse_y = e.clientY;
    context.mouse_b = 1;
    e.target.setPointerCapture(e.pointerId);
  };
  context.canvas.onpointerup = function(e) {
    context.mouse_x = e.clientX;
    context.mouse_y = e.clientY;
    context.mouse_b = 0;
    e.target.releasePointerCapture(e.pointerId);
  };

  context.cursor = null;
  context.cursor_time = new Date().getTime();
  setInterval(function() {
    if (context.cursor) {
      var now = new Date().getTime();
      var state = Math.floor((now - context.cursor_time) / 250) % 2;
      if (state || context.min_text_portion === 0) {
        context.cursor.style.visibility = 'hidden';
      } else {
        context.cursor.style.visibility = 'visible';
      }
    }
  }, 50);

  context.GetRawString = function(data8, addr, len) {
    var data = '';
    for (var i = 0; i < len; ++i) {
      data += String.fromCharCode(data8[addr + i]);
    }
    return data;
  };

  context.handles = [];
  context.free_handles = [];
  context.next_handle = 1;
  context.AllotHandle = function() {
    if (context.free_handles.length) {
      return context.free_handles.pop();
    }
    return context.next_handle++;
  };
  context.ReleaseHandle = function(id) {
    if (context.handles[id] !== null) {
      context.handles[id] = null;
      context.free_handles.push(id);
    }
  };

  context.terminal = document.createElement('div');
  context.terminal.style.width = '100%';
  context.terminal.style.whiteSpace = 'pre-wrap';
  context.screen.appendChild(context.terminal);
  const DEFAULT_FG = 0x000000;
  const DEFAULT_BG = 0xFFFFFF;
  context.attrib = [DEFAULT_FG, DEFAULT_BG];
  context.lines = [];
  context.escaping = [];

  context.LineFeed = function() {
    var line = document.createElement('pre');
    line.style.width = '100%';
    line.style.whiteSpace = 'pre-wrap';
    line.style.margin = '0px';
    if (context.cy < 0) {
      context.terminal.appendChild(line);
    } else {
      context.terminal.insertBefore(line, context.lines[context.cy].nextSibling);
    }
    context.cx = 0;  // implicit cr
    if (context.cy >= 0) {
      context.dirty[context.cy] = 1;
    }
    ++context.cy;
    context.lines.splice(context.cy, 0, [line, []]);
    context.dirty[context.cy] = 1;
  };

  context.toRGB = function(col) {
    var r = (col >> 16) & 0xff;
    var g = (col >> 8) & 0xff;
    var b = col & 0xff;
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  };

  context.ResetTerminal = function() {
    // TODO: Make this nicer.
    document.body.style.color = context.toRGB(context.attrib[0]);
    document.body.style.backgroundColor = context.toRGB(context.attrib[1]);
    for (var i = 0; i < context.lines.length; ++i) {
      context.terminal.removeChild(context.lines[i][0]);
    }
    context.lines = [];
    context.cx = 0;
    context.cy = -1;
    context.dirty = {};
    context.LineFeed();
  };
  context.ResetTerminal();

  context.TermColor = function(n) {
    n = n & 0xff;
    if (n < 16) {
      var i = n & 8;
      var r = (n & 1) ? (i ? 255 : 192) : (i ? 128 : 0);
      var g = (n & 2) ? (i ? 255 : 192) : (i ? 128 : 0);
      var b = (n & 4) ? (i ? 255 : 192) : (i ? 128 : 0);
      return (r << 16) | (g << 8) | b;
    } else if (n < 232) {
      n -= 16;
      var r = Math.round((Math.floor(n / 36) % 6) * 255 / 5);
      var g = Math.round((Math.floor(n / 6) % 6) * 255 / 5);
      var b = Math.round((n % 6) * 255 / 5);
      return (r << 16) | (g << 8) | b;
    } else {
      n = Math.round((n - 232) * 255 / 23);
      return (n << 16) | (n << 8) | n;
    }
  };

  context.EscapeCode = function(code) {
    var m;
    if (code == '[2J') {
      context.ResetTerminal();
    } else if (code == '[H') {
      context.cx = 0;
      context.cy = 0;
    } else if (code == '[0m') {
      context.attrib = [DEFAULT_FG, DEFAULT_BG];
    } else if (m = code.match(/\\[38;5;([0-9]+)m/)) {
      context.attrib[0] = context.TermColor(parseInt(m[1]));
    } else if (m = code.match(/\\[48;5;([0-9]+)m/)) {
      context.attrib[1] = context.TermColor(parseInt(m[1]));
    } else {
      console.log('Unknown escape code: ' + code);
    }
  };

  context.Emit = function(ch) {
    if (ch === 27) {
      context.escaping = [27];
      return;
    }
    if (context.escaping.length) {
      context.escaping.push(ch);
      if ((ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122)) {  // [A-Za-z]
        context.EscapeCode(new TextDecoder('utf-8').decode(new Uint8Array(context.escaping)).slice(1));
        context.escaping = [];
      }
      return;
    }
    if (ch === 12) {
      context.ResetTerminal();
      context.dirty = {};
      return;
    } else if (ch == 10) {
      context.LineFeed();
      return;
    }
    context.dirty[context.cy] = 1;
    if (ch === 8) {
      context.cx = Math.max(0, context.cx - 1);
    } else if (ch === 13) {
      context.cx = 0;
    } else {
      context.lines[context.cy][1].splice(
          context.cx++, 1, [context.attrib[0], context.attrib[1], ch]);
    }
  };

  context.Update = function() {
    const CURSOR = String.fromCharCode(0x2592);
    var count = 0;
    for (var y in context.dirty) {
      ++count;
      var tag = context.lines[y][0];
      var line = context.lines[y][1];
      var parts = [];
      var p = null;
      for (var x = 0; x < line.length; ++x) {
        if (x == 0 ||
            (x == context.cx && y == context.cy) ||
            p[0] != line[x][0] || p[1] != line[x][1]) {
          parts.push([line[x][0], line[x][1], []]);
          p = parts[parts.length - 1];
          if (x == context.cx && y == context.cy) {
            p[0] |= 0x1000000;
          }
        }
        p[2].push(line[x][2]);
      }
      if (x == context.cx && y == context.cy) {
        if (parts.length > 0) {
          parts.push([parts[parts.length - 1][0] | 0x1000000,
                      parts[parts.length - 1][1], []]);
        } else {
          parts.push([context.attrib[0] | 0x1000000,
                      context.attrib[1], []]);
        }
      }
      var ntag = document.createElement('pre');
      ntag.style.width = '100%';
      ntag.style.whiteSpace = 'pre-wrap';
      ntag.style.margin = '0px';
      for (var i = 0; i < parts.length; ++i) {
        var span = document.createElement('span');
        span.innerText = new TextDecoder('utf-8').decode(new Uint8Array(parts[i][2]));
        span.style.color = context.toRGB(parts[i][0]);
        span.style.backgroundColor = context.toRGB(parts[i][1]);
        if (parts[i][0] & 0x1000000) {
          span.style.position = 'relative';
          var cursor = document.createElement('span');
          cursor.classList.add('cursor');
          cursor.innerText = CURSOR;
          cursor.style.position = 'absolute';
          cursor.style.left = '0px';
          cursor.style.backgroundColor = span.style.backgroundColor;
          span.appendChild(cursor);
          context.cursor = cursor;
          context.cursor.style.visibility = 'hidden';
        }
        ntag.appendChild(span);
        if (i === parts.length - 1) {
          ntag.style.color = span.style.color;
          ntag.style.backgroundColor = span.style.backgroundColor;
        }
      }
      context.terminal.replaceChild(ntag, tag);
      context.lines[y][0] = ntag;
    }
    var newline = count > 1 || context.dirty[context.lines.length - 1];
    context.dirty = {};
    if (newline) {
      window.scrollTo(0, document.body.scrollHeight);
    }
  };

  context.keyboard = document.createElement('div');
  context.KEY_HEIGHT = 45;
  context.KEYBOARD_HEIGHT = context.KEY_HEIGHT * 4;
  const TAB = ['&#11134;', 9, 45];
  const PIPE = [String.fromCharCode(124), 124, 45];
  const BACKSLASH = ['\\\\', 92, 45];
  const ENTER = ['&#9166;', 13, 45];
  const SHIFT = ['&#x21E7;', 1, 45, 0];
  const SHIFT2 = ['&#x2B06;', 0, 45, 0];
  const SHIFT3 = ['=\\\\<', 3, 45, 0];
  const NUMS = ['?123', 2, 45, 0];
  const ABC = ['ABC', 0, 45, 0];
  const BACKSPACE = ['&#x232B;', 8, 45];
  const BACKTICK = String.fromCharCode(96);
  const TILDE = String.fromCharCode(126);
  const PASTE = ['^V', 22, 30];
  const G1 = ['Gap', 0, 15];
  const KEY_COLOR = 'linear-gradient(to bottom right, #ccc, #999)';
  var keymaps = [
    AddKeymap([
      'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'Newline',
      G1, 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', G1, 'Newline',
      SHIFT, 'z', 'x', 'c', 'v', 'b', 'n', 'm', BACKSPACE, 'Newline',
      NUMS, '/', [' ', 32, 5 * 30], '.', ENTER,
    ]),
    AddKeymap([
      'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Newline',
      G1, 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', G1, 'Newline',
      SHIFT2, 'Z', 'X', 'C', 'V', 'B', 'N', 'M', BACKSPACE, 'Newline',
      NUMS, '/', [' ', 32, 5 * 30], '.', ENTER,
    ]),
    AddKeymap([
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Newline',
      PASTE, '@', '$', '_', '&', '-', '+', '(', ')', '/', 'Newline',
      SHIFT3, '*', '"', '\\'', ':', ';', '!', '?', BACKSPACE, 'Newline',
      ABC, ',', [' ', 32, 5 * 30], '.', ENTER,
    ]),
    AddKeymap([
      TILDE, BACKTICK, '3', '4', '5', '^', '7', '8', '9', '0', 'Newline',
      '#', '@', '$', '_', '&', '-', '=', '{', '}', '\\\\', 'Newline',
      NUMS, '%', '"', '\\'', ':', ';', '[', ']', BACKSPACE, 'Newline',
      ABC, '<', [' ', 32, 5 * 30], '>', ENTER,
    ]),
  ];
  function SwitchKeymap(n) {
    for (var i = 0; i < keymaps.length; ++i) {
      keymaps[i].style.display = i == n ? '' : 'none';
    }
  }
  context.Inject = function(text) {
    var data = new TextEncoder().encode(text);
    for (var i = 0; i < data.length; ++i) {
      context.inbuffer.push(data[i]);
    }
  };
  context.Paste = function() {
    navigator.clipboard.readText().then(function(clipText) {
      context.Inject(clipText);
    });
  };
  function AddKey(keymap, item) {
    if (item === 'Newline') {
      var k = document.createElement('br');
      keymap.appendChild(k);
      return;
    }
    var k = document.createElement('button');
    k.style.fontFamily = 'monospace';
    k.style.verticalAlign = 'middle';
    k.style.border = 'none';
    k.style.margin = '0';
    k.style.padding = '0';
    k.style.backgroundImage = KEY_COLOR;
    k.style.width = (100 / 10) + '%';
    k.style.height = context.KEY_HEIGHT + 'px';
    if (item.length > 2) {
      k.style.width = (100 / 10 * item[2] / 30) + '%';
    }
    if (item[0] === 'Gap') {
      k.style.backgroundColor = '#444';
      k.style.backgroundImage = '';
      keymap.appendChild(k);
      return;
    }
    if (item.length > 1) {
      var keycode = item[1];
    } else {
      var keycode = item[0].charCodeAt(0);
    }
    k.innerHTML = item instanceof Array ? item[0] : item;
    k.onclick = function() {
      if (item.length > 3) {  // SHIFT
        SwitchKeymap(item[1]);
      } else if (keycode === 22) {  // PASTE
        context.Paste();
      } else {
        context.inbuffer.push(keycode);
      }
    };
    keymap.appendChild(k);
  }
  function AddKeymap(keymap) {
    var div = document.createElement('div');
    for (var i = 0; i < keymap.length; ++i) {
      var item = keymap[i];
      AddKey(div, item);
    }
    context.keyboard.appendChild(div);
    return div;
  }
  SwitchKeymap(0);
  context.keyboard.style.position = 'fixed';
  context.keyboard.style.width = '100%';
  context.keyboard.style.bottom = '0px';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    context.mobile = -1;
    context.tailer = document.createElement('div');
    context.tailer.style.width = '1px';
    context.tailer.style.height = context.KEYBOARD_HEIGHT + 'px';
    context.screen.appendChild(context.tailer);
    document.body.appendChild(context.keyboard);
  } else {
    context.mobile = 0;
  }

  context.text_fraction = context.mobile ? 3000 : 1667;
  context.min_text_portion = 120 + (context.mobile ? context.KEYBOARD_HEIGHT : 0);
  context.mode = 1;
  function setMode(mode) {
    if (context.mode === mode) {
      return ;
    }
    if (mode) {
      context.filler.style.display = '';
      context.canvas.style.display = '';
    } else {
      context.filler.style.display = 'none';
      context.canvas.style.display = 'none';
    }
    context.mode = mode;
  }
  context.setMode = setMode;
  function Resize() {
    var width = window.innerWidth;
    var theight = Math.max(context.min_text_portion,
                           Math.floor(window.innerHeight *
                                      context.min_text_portion / 10000));
    //var height = window.innerHeight - theight;
    var height = 0
    if (width === context.width && height === context.height) {
      return;
    }
//    context.canvas.style.width = width + 'px';
//    context.canvas.style.height = height + 'px';
    if (context.text_fraction == 0 &&
        context.min_text_portion == 0) {
      context.filler.style.width = '1px';
      context.filler.style.height = '0px';
    } else {
      context.filler.style.width = '1px';
      context.filler.style.height = height + 'px';
    }
    context.width = width;
    context.height = height;
  }
  context.Resize = Resize;
  function Clear() {
    Resize();
    context.ctx.fillStyle = '#000';
    context.ctx.fillRect(0, 0, context.canvas.width, context.canvas.height);
  }
  context.Clear = Clear;
  window.onresize = function(e) {
    Resize();
  };
  function KeyPress(e) {
    context.cursor_time = new Date().getTime();
    context.inbuffer.push(e.keyCode);
    e.preventDefault();
    return false;
  }
  window.onkeypress = KeyPress;

  
  function KeyDown(e) {
    if (e.keyCode == 8) {
      context.cursor_time = new Date().getTime();
      context.inbuffer.push(e.keyCode);
      e.preventDefault();
      return false;
    }
  }
  window.onkeydown = KeyDown;
  window.addEventListener('paste', function(e) {
    context.Inject(e.clipboardData.getData('text'));
  });
  setMode(0);
  context.Clear();
}
~ jseval

JSWORD: web-type-raw { a n -- yld }
  if (globalObj.write) {
    var text = GetString(a, n);
    write(text);
    return 0;
  } else {
    var newline = false;
    for (var i = 0; i < n; ++i) {
      var ch = u8[a + i];
      if (ch == 10) { newline = true; }
      context.Emit(ch);
    }
    if (newline) {
      context.Update();
    }
    return newline ? -1 : 0;
  }
~

JSWORD: web-key-raw { -- n }
  context.Update();
  if (globalObj.readline && !context.inbuffer.length) {
    var line = unescape(encodeURIComponent(readline()));
    for (var i = 0; i < line.length; ++i) {
      context.inbuffer.push(line.charCodeAt(i));
    }
    context.inbuffer.push(13);
  }
  if (context.inbuffer.length) {
    return context.inbuffer.shift();
  } else {
    return 0;
  }
~

JSWORD: web-key?-raw { -- f }
  context.Update();
  if (globalObj.readline) {
    return -1;
  }
  return context.inbuffer.length ? -1 : 0;
~

JSWORD: web-terminate { retval }
  if (globalObj.quit) {
    quit(retval);
  } else {
    Init();
  }
~

JSWORD: shouldEcho? { -- f }
  if (globalObj.write) {
    return 0;  // Disable echo.
  } else {
    return -1;  // Enable echo.
  }
~
shouldEcho? echo !

JSWORD: grmode { mode }
  context.setMode(mode);
~
: gr   1 grmode ;
: text   0 grmode ;

JSWORD: color! { c }
  function HexDig(n) {
    return ('0' + n.toString(16)).slice(-2);
  }
  context.ctx.fillStyle = '#' + HexDig((c >> 16) & 0xff) +
                                HexDig((c >> 8) & 0xff) +
                                HexDig(c & 0xff);
  context.ctx.strokeStyle = '#' + HexDig((c >> 16) & 0xff) +
                                  HexDig((c >> 8) & 0xff) +
                                  HexDig(c & 0xff);
~

JSWORD: lineWidth { w -- }
  context.ctx.lineWidth = w;
~

JSWORD: box { x y w h }
  context.ctx.fillRect(x, y, w, h);
~

JSWORD: beginPath { }
  context.ctx.beginPath();
~

JSWORD: moveTo { x y }
  context.ctx.moveTo(x, y);
~

JSWORD: lineTo { x y }
  context.ctx.lineTo(x, y);
~

JSWORD: stroke { }
  context.ctx.stroke();
~

JSWORD: fill { }
  context.ctx.fill();
~

: line ( x1 y1 x2 y2 -- )
  beginPath
  >r >r moveTo
  r> r> lineTo
  stroke
;

JSWORD: window { w h }
  context.canvas.width = w;
  context.canvas.height = h;
~

JSWORD: viewport@ { -- w h }
  return [context.width, context.height];
~

JSWORD: textRatios { tf mp }
  context.text_fraction = tf;
  context.min_text_portion = mp;
  context.Resize();
~

JSWORD: mobile { -- f }
  return context.mobile;
~

JSWORD: keys-height { -- n }
  return context.KEYBOARD_HEIGHT;
~

: show-text ( f -- )
  if
    mobile if 3000 120 keys-height + else 1667 120 then
  else
    mobile if 0 keys-height else 0 0 then
  then textRatios ;

JSWORD: translate { x y }
  context.ctx.translate(x, y);
~

JSWORD: scale { x y div }
  context.ctx.scale(x / div, y / div);
~

JSWORD: rotate { angle div }
  context.ctx.rotate(Math.PI * 2 * angle / div);
~

JSWORD: gpush { }
  context.ctx.save();
~

JSWORD: gpop { }
  context.ctx.restore();
~

JSWORD: smooth { f }
  context.canvas.style.imageRendering = f ? '' : 'pixelated';
~

JSWORD: setItem { value value_len key key_len session }
  if (session) {
    sessionStorage.setItem(context.GetRawString(u8, key, key_len),
                           context.GetRawString(u8, value, value_len));
  } else {
    localStorage.setItem(context.GetRawString(u8, key, key_len),
                         context.GetRawString(u8, value, value_len));
  }
~

JSWORD: getItem { dst dst_limit key key_len session -- n }
  if (session) {
    var data = sessionStorage.getItem(context.GetRawString(u8, key, key_len));
  } else {
    var data = localStorage.getItem(context.GetRawString(u8, key, key_len));
  }
  if (data === null) {
    return -1;
  }
  for (var i = 0; i < dst_limit && i < data.length; ++i) {
    u8[dst + i] = data.charCodeAt(i);
  }
  return data.length;
~

JSWORD: removeItem { key key_len session }
  if (session) {
    sessionStorage.removeItem(context.GetRawString(u8, key, key_len));
  } else {
    localStorage.removeItem(context.GetRawString(u8, key, key_len));
  }
~

JSWORD: clearItems { session }
  if (session) {
    sessionStorage.clear();
  } else {
    localStorage.clear();
  }
~

JSWORD: getKey { key key_limit index session -- n }
  if (session) {
    var data = sessionStorage.key(index);
  } else {
    var data = localStorage.key(index);
  }
  if (data === null) {
    return -1;
  }
  for (var i = 0; i < key_limit && i < data.length; ++i) {
    u8[key + i] = data.charCodeAt(i);
  }
  return i;
~

JSWORD: keyCount { session -- n }
  if (session) {
    var len = sessionStorage.length;
  } else {
    var len = localStorage.length;
  }
  return len;
~

JSWORD: release { handle }
  context.ReleaseHandle(handle);
~

JSWORD: importScripts { dst dst_limit -- n }
  if (context.scripts === undefined) {
    return 0;
  }
  var data = context.scripts;
  for (var i = 0; i < dst_limit && i < data.length; ++i) {
    u8[dst + i] = data[i];
  }
  return data.length;
~

r~
context.audio_context = null;
context.audio_channels = [];
context.initAudio = function() {
  if (context.audio_context !== null) {
    return;
  }
  context.audio_context = new AudioContext();
  var master = context.audio_context.createGain();
  master.connect(context.audio_context.destination);
  master.gain.value = 1/8;
  for (var i = 0; i < 8; ++i) {
    var oscillator = context.audio_context.createOscillator();
    oscillator.type = 'sine';
    var gain = context.audio_context.createGain();
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    context.audio_channels.push([gain, oscillator]);
  }
};
~ jseval

JSWORD: tone { pitch volume channel -- }
  context.initAudio();
  context.audio_channels[channel][0].gain.value = volume / 100;
  context.audio_channels[channel][1].frequency.value = 27.5 * Math.pow(2, (pitch - 21) / 12);
~
: silence   8 0 do 0 0 i tone loop ;

JSWORD: ms-ticks { -- ms }
  return Date.now();
~

r~
if (!globalObj.write) {
  var filepick = document.createElement('input');
  filepick.type = 'file';
  filepick.name = 'files[]';
  filepick.style.display = 'none';
  document.body.appendChild(filepick);
  context.handleImport = function() {
    document.body.onblur = function() {
      document.body.onfocus = function() {
        document.body.onfocus = null;
        setTimeout(function() {
          if (filepick.files.length === 0) {
            context.filepick_result = 0;
            context.filepick_filename = null;
          }
        }, 500);
      };
    };
  };
  filepick.onchange = function(event) {
    if (event.target.files.length > 0) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var data = context.GetRawString(
           new Uint8Array(e.target.result), 0, e.target.result.byteLength);
        try {
          if (context.filepick_filename === null) { throw 'fail'; }
          localStorage.setItem(context.filepick_filename, data);
          context.filepick_result = -1;
          context.filepick_filename = null;
        } catch (e) {
          context.filepick_result = 0;
          context.filepick_filename = null;
        }
      };
      reader.readAsArrayBuffer(event.target.files[0]);
    } else {
      context.filepick_filename = null;
      context.filepick_result = 0;
    }
  };
  context.filepick = filepick;
  context.filepick_filename = null;
  context.filepick_result = 0;
}
~ jseval

JSWORD: upload-start { filename n }
  context.filepick_filename = context.GetRawString(u8, filename, n);
  context.handleImport();
  context.filepick.click();
~

JSWORD: upload-done? { -- f }
  return context.filepick_filename === null ? -1 : 0;
~

JSWORD: upload-success? { -- f }
  return context.filepick_result;
~

JSWORD: log { a n -- }
  console.log(GetString(a, n));
~

JSWORD: text-size! { n -- }
  context.terminal.style.fontSize = n + 'px';
~

JSWORD: font { a n -- }
  context.ctx.font = GetString(a, n);
~

JSWORD: fillText { a n x y -- }
  context.ctx.fillText(GetString(a, n), x, y);
~

JSWORD: textWidth { a n -- w }
  return context.ctx.measureText(GetString(a, n)).width;
~

JSWORD: mouse { -- x y }
  return [context.mouse_x, context.mouse_y];
~

JSWORD: button { -- b }
  return context.mouse_b;
~

JSWORD: random { n -- n }
  return Math.floor(Math.random() * n);
~

0 0 importScripts constant scripts#
create scripts   scripts# allot
scripts scripts# importScripts drop

forth definitions web

: ms-ticks   ms-ticks ;

forth definitions
( ANSI Codes )
vocabulary ansi   ansi definitions
: esc   27 emit ;   : bel   7 emit ;
: clear-to-eol   esc ." [0K" ;
: scroll-down   esc ." D" ;
: scroll-up   esc ." M" ;
: hide   esc ." [?25l" ;
: show   esc ." [?25h" ;
: terminal-save   esc ." [?1049h" ;
: terminal-restore   esc ." [?1049l" ;

forth definitions ansi
: fg ( n -- ) esc ." [38;5;" n. ." m" ;
: bg ( n -- ) esc ." [48;5;" n. ." m" ;
: normal   esc ." [0m" ;
: at-xy ( x y -- ) esc ." [" 1+ n. ." ;" 1+ n. ." H" ;
: page   esc ." [2J" esc ." [H" ;
: set-title ( a n -- ) esc ." ]0;" type bel ;
forth
( Words built after boot )

( For tests and asserts )
: assert ( f -- ) 0= throw ;

( Print spaces )
: spaces ( n -- ) for aft space then next ;

internals definitions

( Temporary for platforms without CALLCODE )
DEFINED? CALLCODE 0= [IF]
  create CALLCODE
[THEN]

( Safe memory access, i.e. aligned )
cell 1- constant cell-mask
: cell-base ( a -- a ) cell-mask invert and ;
: cell-shift ( a -- a ) cell-mask and 8 * ;
: ca@ ( a -- n ) dup cell-base @ swap cell-shift rshift 255 and ;

( Print address line leaving room )
: dump-line ( a -- a ) cr <# #s #> 20 over - >r type r> spaces ;

( Semi-dangerous word to trim down the system heap )
DEFINED? realloc [IF]
: relinquish ( n -- ) negate 'heap-size +! 'heap-start @ 'heap-size @ realloc drop ;
[THEN]

forth definitions internals

( Examine Memory )
: dump ( a n -- )
   over 15 and if over dump-line over 15 and 3 * spaces then
   for aft
     dup 15 and 0= if dup dump-line then
     dup ca@ <# # #s #> type space 1+
   then next drop cr ;

( Remove from Dictionary )
: forget ( "name" ) ' dup >link current @ !  >name drop here - allot ;

internals definitions
1 constant IMMEDIATE_MARK
2 constant SMUDGE
4 constant BUILTIN_FORK
16 constant NONAMED
32 constant +TAB
64 constant -TAB
128 constant ARGS_MARK
: mem= ( a a n -- f)
   for aft 2dup c@ swap c@ <> if 2drop rdrop 0 exit then 1+ swap 1+ then next 2drop -1 ;
forth definitions also internals
: :noname ( -- xt ) 0 , current @ @ , NONAMED SMUDGE or ,
                    here dup current @ ! ['] mem= @ , postpone ] ;
: str= ( a n a n -- f) >r swap r@ <> if rdrop 2drop 0 exit then r> mem= ;
: startswith? ( a n a n -- f ) >r swap r@ < if rdrop 2drop 0 exit then r> mem= ;
: .s   ." <" depth n. ." > " raw.s cr ;
only forth definitions

( Tweak indent on branches )
internals internalized definitions

: flags'or! ( n -- ) ' >flags& dup >r c@ or r> c! ;
+TAB flags'or! BEGIN
-TAB flags'or! AGAIN
-TAB flags'or! UNTIL
+TAB flags'or! AHEAD
-TAB flags'or! THEN
+TAB flags'or! IF
+TAB -TAB or flags'or! ELSE
+TAB -TAB or flags'or! WHILE
-TAB flags'or! REPEAT
+TAB flags'or! AFT
+TAB flags'or! FOR
-TAB flags'or! NEXT
+TAB flags'or! DO
ARGS_MARK +TAB or flags'or! ?DO
ARGS_MARK -TAB or flags'or! +LOOP
ARGS_MARK -TAB or flags'or! LOOP
ARGS_MARK flags'or! LEAVE

forth definitions 

( Definitions building to SEE and ORDER )
internals definitions
variable indent
: see. ( xt -- ) >name type space ;
: icr   cr indent @ 0 max 4* spaces ;
: indent+! ( n -- ) indent +! icr ;
: see-one ( xt -- xt+1 )
   dup cell+ swap @
   dup ['] DOLIT = if drop dup @ . cell+ exit then
   dup ['] DOSET = if drop ." TO " dup @ cell - see. cell+ icr exit then
   dup ['] DOFLIT = if drop dup sf@ <# [char] e hold #fs #> type space cell+ exit then
   dup ['] $@ = if drop ['] s" see.
                   dup @ dup >r >r dup cell+ r> type cell+ r> 1+ aligned +
                   [char] " emit space exit then
   dup ['] DOES> = if icr then
   dup >flags -TAB AND if -1 indent+! then
   dup see.
   dup >flags +TAB AND if
     1 indent+!
   else
     dup >flags -TAB AND if icr then
   then
   dup ['] ! = if icr then
   dup ['] +! = if icr then
   dup  @ ['] BRANCH @ =
   over @ ['] 0BRANCH @ = or
   over @ ['] DONEXT @ = or
   over >flags ARGS_MARK and or
       if swap cell+ swap then
   drop
;
: see-loop   dup >body swap >params 1- cells over +
             begin 2dup < while swap see-one swap repeat 2drop ;
: ?see-flags   >flags IMMEDIATE_MARK and if ." IMMEDIATE " then ;
: see-xt ( xt -- )
  dup @ ['] see-loop @ = if
    ['] : see.  dup see.
    1 indent ! icr
    dup see-loop
    -1 indent+! ['] ; see.
    ?see-flags cr
    exit
  then
  dup >flags BUILTIN_FORK and if ." Built-in-fork: " see. exit then
  dup @ ['] input-buffer @ = if ." CREATE/VARIABLE: " see. cr exit then
  dup @ ['] SMUDGE @ = if ." DOES>/CONSTANT: " see. cr exit then
  dup @ ['] callcode @ = if ." Code: " see. cr exit then
  dup >params 0= if ." Built-in: " see. cr exit then
  ." Unsupported: " see. cr ;

: nonvoc? ( xt -- f )
  dup 0= if exit then dup >name nip swap >flags NONAMED BUILTIN_FORK or and or ;
: see-vocabulary ( voc )
  @ begin dup nonvoc? while dup see-xt >link repeat drop cr ;
: >vocnext ( xt -- xt ) >body 2 cells + @ ;
: see-all
  last-vocabulary @ begin dup while
    ." VOCABULARY " dup see. cr ." ------------------------" cr
    dup >body see-vocabulary
    >vocnext
  repeat drop cr ;
: voclist-from ( voc -- ) begin dup while dup see. cr >vocnext repeat drop ;
: voclist   last-vocabulary @ voclist-from ;
: voc. ( voc -- ) 2 cells - see. ;
: vocs. ( voc -- ) dup voc. @ begin dup while
    dup nonvoc? 0= if ." >> " dup 2 cells - voc. then
    >link
  repeat drop cr ;

( Words to measure size of things )
: size-vocabulary ( voc )
  @ begin dup nonvoc? while
    dup >params . dup >size . dup . dup see. cr >link
  repeat drop ;
: size-all
  last-vocabulary @ begin dup while
    0 . 0 . 0 . dup see. cr
    dup >body size-vocabulary
    >vocnext
  repeat drop cr ;

forth definitions also internals
: see   ' see-xt ;
: order   context begin dup @ while dup @ vocs. cell+ repeat drop ;
only forth definitions

( List words in Dictionary / Vocabulary )
internals definitions
70 value line-width
0 value line-pos
: onlines ( xt -- xt )
   line-pos line-width > if cr 0 to line-pos then
   dup >name nip 1+ line-pos + to line-pos ;
: vins. ( voc -- )
  >r 'builtins begin dup >link while
    dup >params r@ = if dup onlines see. then
    3 cells +
  repeat drop rdrop ;
: ins. ( n xt -- n ) cell+ @ vins. ;
: ?ins. ( xt -- xt ) dup >flags BUILTIN_FORK and if dup ins. then ;
forth definitions also internals
: vlist   0 to line-pos context @ @
          begin dup nonvoc? while ?ins. dup onlines see. >link repeat drop cr ;
: words   0 to line-pos context @ @
          begin dup while ?ins. dup onlines see. >link repeat drop cr ;
only forth definitions
( Lazy loaded code words )
: asm r|

also forth definitions
vocabulary asm
internals definitions

: ca! ( n a -- ) dup cell-base >r cell-shift swap over lshift
                 swap 255 swap lshift invert r@ @ and or r> ! ;

also asm definitions

variable code-start
variable code-at

DEFINED? posix [IF]
also posix
: reserve ( n -- )
  0 swap PROT_READ PROT_WRITE PROT_EXEC or or
  MAP_ANONYMOUS MAP_PRIVATE or -1 0 mmap code-start ! ;
previous
4096 reserve
[THEN]

DEFINED? esp [IF]
also esp
: reserve ( n -- ) MALLOC_CAP_EXEC heap_caps_malloc code-start ! ;
previous
1024 reserve
[THEN]

code-start @ code-at !

: chere ( -- a ) code-at @ ;
: callot ( n -- ) code-at +! ;
: code1, ( n -- ) chere ca! 1 callot ;
: code2, ( n -- ) dup code1, 8 rshift code1, ;
: code3, ( n -- ) dup code2, 16 rshift code1, ;
: code4, ( n -- ) dup code2, 16 rshift code2, ;
cell 8 = [IF]
: code,  dup code4, 32 rshift code4, ;
[ELSE]
: code,  code4, ;
[THEN]
: end-code   previous ;

also forth definitions

: code ( "name" ) create ['] callcode @ latestxt !
                  code-at @ latestxt cell+ ! also asm ;

previous previous previous
asm

| evaluate ;
( Local Variables )

( NOTE: These are not yet gforth compatible )

internals definitions

( Leave a region for locals definitions )
1024 constant locals-capacity  128 constant locals-gap
create locals-area locals-capacity allot
variable locals-here  locals-area locals-here !
: <>locals   locals-here @ here locals-here ! here - allot ;

: local@ ( n -- ) rp@ + @ ;
: local! ( n -- ) rp@ + ! ;
: local+! ( n -- ) rp@ + +! ;

variable scope-depth
variable local-op   ' local@ local-op !
: scope-exit   scope-depth @ for aft postpone rdrop then next ;
: scope-clear
   scope-exit
   scope-depth @ negate nest-depth +!
   0 scope-depth !   0 scope !   locals-area locals-here ! ;
: do-local ( n -- ) nest-depth @ + cells negate aliteral
                    local-op @ ,  ['] local@ local-op ! ;
: scope-create ( a n -- )
   dup >r $place align ( name )
   scope @ , r> 8 lshift 1 or , ( IMMEDIATE ) here scope ! ( link, flags&length )
   ['] scope-clear @ ( docol) ,
   nest-depth @ negate aliteral postpone do-local ['] exit ,
   1 scope-depth +!  1 nest-depth +!
;

: ?room   locals-here @ locals-area - locals-capacity locals-gap - >
          if scope-clear -1 throw then ;

: }? ( a n -- ) 1 <> if drop 0 exit then c@ [char] } = ;
: --? ( a n -- ) s" --" str= ;
: (to) ( xt -- ) ['] local! local-op ! execute ;
: (+to) ( xt -- ) ['] local+! local-op ! execute ;

also forth definitions

: (local) ( a n -- )
   dup 0= if 2drop exit then 
   ?room <>locals scope-create <>locals postpone >r ;
: {   bl parse
      dup 0= if scope-clear -1 throw then
      2dup --? if 2drop [char] } parse 2drop exit then
      2dup }? if 2drop exit then
      recurse (local) ; immediate
( TODO: Hide the words overriden here. )
: ;   scope-clear postpone ; ; immediate
: exit   scope-exit postpone exit ; immediate
: to ( n -- ) ' dup >flags if (to) else ['] ! value-bind then ; immediate
: +to ( n -- ) ' dup >flags if (+to) else ['] +! value-bind then ; immediate

only forth definitions
internals definitions
variable cases
forth definitions internals

: CASE ( n -- ) cases @  0 cases ! ; immediate
: ENDCASE   postpone drop cases @ for aft postpone then then next
            cases ! ; immediate
: OF ( n -- ) postpone over postpone = postpone if postpone drop ; immediate
: ENDOF   1 cases +! postpone else ; immediate

forth definitions
( Cooperative Tasks )

vocabulary tasks   tasks definitions also internals

variable task-list

: .tasks   task-list @ begin dup 2 cells - see. @ dup task-list @ = until drop ;

forth definitions tasks also internals

: pause
  rp@ sp@ task-list @ cell+ !
  task-list @ @ task-list !
  task-list @ cell+ @ sp! rp!
;

: task ( xt dsz rsz "name" )
   create here >r 0 , 0 , ( link, sp )
   swap here cell+ r@ cell+ ! cells allot
   here r@ cell+ @ ! cells allot
   dup 0= if drop else
     here r@ cell+ @ @ ! ( set rp to point here )
     , postpone pause ['] branch , here 3 cells - ,
   then rdrop ;

: start-task ( t -- )
   task-list @ if
     task-list @ @ over !
     task-list @ !
   else
     dup task-list !
     dup !
   then
;

DEFINED? ms-ticks [IF]
  : ms ( n -- ) ms-ticks >r begin pause ms-ticks r@ - over >= until rdrop drop ;
[THEN]

tasks definitions
0 0 0 task main-task   main-task start-task
only forth definitions
web definitions

: web-type ( a n -- ) web-type-raw if pause then ;
' web-type is type
: web-key ( -- n ) begin pause web-key-raw dup if exit then drop again ;
' web-key is key
: web-key? ( -- f ) pause web-key?-raw ;
' web-key? is key?
' web-terminate is terminate

: upload-file ( a n -- )
   upload-start
   begin yield upload-done? until
   upload-success? assert
;

: upload ( "filename" ) bl parse dup assert upload-file ;

: include-file { a n -- }
  0 0 a n 0 getItem { len }
  here { buf } len allot
  buf len a n 0 getItem len = assert
  a n 0 removeItem
  buf len evaluate
; 

: ls   0 keyCount 0 do pad 80 i 0 getKey pad swap type cr loop ;
: rm   bl parse 0 removeItem ;

: import  s" _temp.fs" 2dup upload-file include-file ;

: yielding  begin 50 ms yield again ;
' yielding 10 10 task yielding-task
yielding-task start-task

forth definitions
internals definitions
( TODO: Figure out why this has to happen so late. )
transfer internals-builtins
forth definitions internals

( For now include color list here. )
: colors    256 0 do i fg i . loop normal cr ;

( Bring a forth to the top of the vocabulary. )
: ok   ." uEforth" raw-ok ;
transfer forth
forth

( Try to run script tags if any. )
web scripts scripts# forth evaluate

ok
`;


var heap = new ArrayBuffer(HEAP_SIZE);
var f32 = new Float32Array(heap);
var i32 = new Int32Array(heap);
var u16 = new Uint16Array(heap);
var u8 = new Uint8Array(heap);
var builtins = [];
var opcodes = {};
var objects = [SetEval];
var context = {};  // For later use by platform.

  const g_sys = 256;
  const g_sys_heap = 256;
  const g_sys_current = 260;
  const g_sys_context = 264;
  const g_sys_latestxt = 268;
  const g_sys_notfound = 272;
  const g_sys_heap_start = 276;
  const g_sys_heap_size = 280;
  const g_sys_stack_cells = 284;
  const g_sys_boot = 288;
  const g_sys_boot_size = 292;
  const g_sys_tib = 296;
  const g_sys_ntib = 300;
  const g_sys_tin = 304;
  const g_sys_state = 308;
  const g_sys_base = 312;
  const g_sys_argc = 316;
  const g_sys_argv = 320;
  const g_sys_runner = 324;
  const g_sys_throw_handler = 328;
  const g_sys_rp = 332;
  const g_sys_DOLIT_XT = 336;
  const g_sys_DOFLIT_XT = 340;
  const g_sys_DOEXIT_XT = 344;
  const g_sys_YIELD_XT = 348;
  const g_sys_DOCREATE_OP = 352;
  const g_sys_builtins = 356;
  const OP_DOCREATE = 159;
  const OP_DODOES = 160;
  const OP_DOCOL = 156;
  const OP_DOVAR = 158;
  const OP_DOCON = 157;


function SetEval(sp) {
  var index = i32[sp>>2]; sp -= 4;
  var n = i32[sp>>2]; sp -= 4;
  var a = i32[sp>>2]; sp -= 4;
  objects[index] = eval(GetString(a, n));
  return sp;
}

function Call(sp) {
  var op = i32[sp>>2]; sp -= 4;
  return objects[op](sp);
}

function Load(addr, content) {
  var data = unescape(encodeURIComponent(content));
  for (var i = 0; i < data.length; ++i) {
    u8[addr++] = data.charCodeAt(i);
  }
  return data.length;
}

function GetString(a, n) {
  var data = '';
  for (var i = 0; i < n; ++i) {
    data += String.fromCharCode(u8[a + i]);
  }
  try {
    return decodeURIComponent(escape(data));
  } catch (e) {
    return data;
  }
}

function CELL_ALIGNED(n) { return (n + 3) & ~3; }
function UPPER(ch) {
  return ch >= 'a'.charCodeAt(0) && ch <= 'z'.charCodeAt(0) ? (ch & 0x5F) : ch;
}

function TOFLAGS(xt) { return xt - 1 * 4; }
function TONAMELEN(xt) { return TOFLAGS(xt) + 1; }
function TOPARAMS(xt) { return TOFLAGS(xt) + 2; }
function TOSIZE(xt) { return CELL_ALIGNED(u8[TONAMELEN(xt)>>2]) + 4 * u16[TOPARAMS(xt)>>1]; }
function TOLINK(xt) { return xt - 2 * 4; }
function TONAME(xt) {
  return (u8[TOFLAGS(xt)] & BUILTIN_MARK)
    ? i32[TOLINK(xt)] : TOLINK(xt) - CELL_ALIGNED(u8[TONAMELEN(xt)]);
}
function TOBODY(xt) {
  return xt + (i32[xt>>2] === OP_DOCREATE || i32[xt>>2] === OP_DODOES ? 2 : 1) * 4;
}

function DOES(ip) {
  i32[i32[i32[g_sys_current>>2]>>2]>>2] = OP_DODOES;
  i32[(i32[i32[g_sys_current>>2]>>2] + 4)>>2] = ip;
}

function BUILTIN_ITEM(i) {
  return i32[g_sys_builtins>>2] + 4 * 3 * i;
}
function BUILTIN_NAME(i) {
  return i32[(BUILTIN_ITEM(i) + 0 * 4)>>2];
}
function BUILTIN_FLAGS(i) {
  return u8[BUILTIN_ITEM(i) + 1 * 4 + 0];
}
function BUILTIN_NAMELEN(i) {
  return u8[BUILTIN_ITEM(i) + 1 * 4 + 1];
}
function BUILTIN_VOCAB(i) {
  return u16[(BUILTIN_ITEM(i) + 1 * 4 + 2)>>1];
}
function BUILTIN_CODE(i) {
  return BUILTIN_ITEM(i) + 2 * 4;
}

function Find(name) {
  if (name.length === 0) {
    return 0;
  }
  name = name.toUpperCase();
  var raw = unescape(encodeURIComponent(name));
  for (var voc = i32[g_sys_context>>2]; i32[voc>>2]; voc += 4) {
    var xt = i32[i32[voc>>2]>>2];
    while (xt) {
      if (u8[TOFLAGS(xt)] & BUILTIN_FORK) {
        var vocab = i32[(TOLINK(xt) + 4 * 3)>>2];
        for (var i = 0; BUILTIN_NAME(i); ++i) {
          if (BUILTIN_VOCAB(i) === vocab &&
              raw.length === BUILTIN_NAMELEN(i) &&
              name === GetString(BUILTIN_NAME(i), BUILTIN_NAMELEN(i)).toUpperCase()) {
            if (DEBUGGING) { console.log('FOUND: ' + name); }
            return BUILTIN_CODE(i);
          }
        }
      }
      if (!(u8[TOFLAGS(xt)] & SMUDGE) &&
          raw.length === u8[TONAMELEN(xt)] &&
          name.toUpperCase() === GetString(TONAME(xt), u8[TONAMELEN(xt)]).toUpperCase()) {
          if (DEBUGGING) { console.log('FOUND REGULAR: ' + name); }
        return xt;
      }
      xt = i32[TOLINK(xt)>>2];
    }
  }
  if (DEBUGGING) { console.log('NOT FOUND: ' + name); }
  return 0;
}

function trace(ip, sp, tos) {
  var line = '[';
  for (var i = 0; i < 3; i++) {
    line += i32[(sp + (i - 2) * 4)>>2] + ' ';
  }
  line += tos + '] ';
  while (line.length < 25) {
    line += ' ';
  }
  line += ip + ': ';
  for (var i = 0; i < 10; ++i) {
    var val = i32[(ip + i * 4)>>2];
    if (i32[val>>2] && opcodes[i32[val>>2]] !== undefined) {
      var op = opcodes[i32[val>>2]];
      if (op === 'DOCOL') {
        line += op + '(' + val + ') ';
      } else {
        line += op + ' ';
      }
    } else {
      line += val + ' ';
    }
  }
  console.log(line);
}

function COMMA(value) {
  i32[i32[g_sys_heap>>2]>>2] = value;
  i32[g_sys_heap>>2] += 4;
}

function CCOMMA(value) {
  u8[i32[g_sys_heap>>2]] = value;
  i32[g_sys_heap>>2]++;
}

function SSMOD(sp) {
  var a = i32[(sp - 8)>>2];
  var b = i32[(sp - 4)>>2];
  var c = i32[sp>>2];
  a *= b;
  var x = Math.floor(a / c);
  var m = a - x * c;
  i32[(sp - 8)>>2] = m;
  i32[sp>>2] = x;
}

function Finish() {
  if (i32[g_sys_latestxt>>2] && !u16[TOPARAMS(i32[g_sys_latestxt>>2])>>1]) {
    var sz = i32[g_sys_heap>>2] - (i32[g_sys_latestxt>>2] + 4);
    sz /= 4;
    if (sz < 0 || sz > 0xffff) { sz = 0xffff; }
    u16[TOPARAMS(i32[g_sys_latestxt>>2])>>1] = sz;
  }
}

function UNSMUDGE() {
  u8[TOFLAGS(i32[i32[g_sys_current>>2]>>2])] &= ~SMUDGE;
  Finish();
}

function DOIMMEDIATE() {
  u8[TOFLAGS(i32[i32[g_sys_current>>2]>>2])] |= IMMEDIATE;
}

function Create(name, flags, op) {
  if (DEBUGGING) { console.log('CREATE: ' + name); }
  Finish();
  i32[g_sys_heap>>2] = CELL_ALIGNED(i32[g_sys_heap>>2]);
  var name_len = Load(i32[g_sys_heap>>2], name);  // name
  i32[g_sys_heap>>2] += name_len;
  i32[g_sys_heap>>2] = CELL_ALIGNED(i32[g_sys_heap>>2]);
  COMMA(i32[i32[g_sys_current>>2]>>2]);  // link
  COMMA((name_len << 8) | flags);  // flags & length
  i32[i32[g_sys_current>>2]>>2] = i32[g_sys_heap>>2];
  i32[g_sys_latestxt>>2] = i32[g_sys_heap>>2];
  COMMA(op);
}

function Builtin(name, flags, vocab, opcode) {
  opcodes[opcode] = name;
  builtins.push([name, flags | BUILTIN_MARK, vocab, opcode]);
}

function HttpGet(url) {
  return new Promise(function(resolve, reject) {
    var request = new XMLHttpRequest();
    request.open('GET', url);
    request.send();
    request.onload = function() {
      if (request.status != 200) {
        reject(request);
      } else {
        resolve(request.responseText);
      }
    };
    request.onerror = function() {
      reject(request);
    };
  });
}

function LoadScripts(callback) {
  if (globalObj.write) {
    callback();
    return;
  }
  var textParts = [];
  var tags = document.getElementsByTagName('script');
  for (var i = 0; i < tags.length; ++i) {
    if (tags[i].type == 'text/forth') {
      textParts.push(tags[i].text);
      if (tags[i].src) {
        textParts.push(HttpGet(tags[i].src));
      }
    }
  }
  Promise.all(textParts).then(function(values) {
    var text = '';
    for (var i = 0; i < values.length; ++i) {
      text += values[i] + '\n';
    }
    var encoder = new TextEncoder();
    context.scripts = encoder.encode(text);
    callback();
  });
}

function SetupBuiltins() {
  for (var i = 0; i < builtins.length; ++i) {
    var name = builtins[i][0];
    builtins[i][0] = i32[g_sys_heap>>2];
    var name_len = Load(i32[g_sys_heap>>2], name);  // name
    i32[g_sys_heap>>2] += name_len;
    i32[g_sys_heap>>2] = CELL_ALIGNED(i32[g_sys_heap>>2]);
    builtins[i][1] |= (name_len << 8);
  }
  i32[g_sys_builtins>>2] = i32[g_sys_heap>>2];
  for (var i = 0; i < builtins.length; ++i) {
    COMMA(builtins[i][0]);
    COMMA(builtins[i][1] | (builtins[i][2] << 16));
    COMMA(builtins[i][3]);
  }
  COMMA(0);
  COMMA(0);
  COMMA(0);
}

function Match(sep, ch) {
  return sep == ch || (sep == 32 && (ch == 9 || ch == 10 || ch == 13));
}

function Parse(sep, ret) {
  if (sep == 32) {
    while (i32[g_sys_tin>>2] < i32[g_sys_ntib>>2] &&
           Match(sep, u8[i32[g_sys_tib>>2] + i32[g_sys_tin>>2]])) { ++i32[g_sys_tin>>2]; }
  }
  var start = i32[g_sys_tin>>2];
  while (i32[g_sys_tin>>2] < i32[g_sys_ntib>>2] &&
         !Match(sep, u8[i32[g_sys_tib>>2] + i32[g_sys_tin>>2]])) { ++i32[g_sys_tin>>2]; }
  var len = i32[g_sys_tin>>2] - start;
  if (i32[g_sys_tin>>2] < i32[g_sys_ntib>>2]) { ++i32[g_sys_tin>>2]; }
  i32[ret>>2] = i32[g_sys_tib>>2] + start;
  if (DEBUGGING) { console.log('PARSE: [' + GetString(i32[ret>>2], len) + ']'); }
  return len;
}

function Convert(pos, n, base, ret) {
  i32[ret>>2] = 0;
  var negate = 0;
  if (!n) { return 0; }
  if (u8[pos] == '-'.charCodeAt(0)) { negate = -1; ++pos; --n; }
  if (u8[pos] == '$'.charCodeAt(0)) { base = 16; ++pos; --n; }
  for (; n; --n) {
    var d = UPPER(u8[pos]) - 48;
    if (d > 9) {
      d -= 7;
      if (d < 10) { return 0; }
    }
    if (d >= base) { return 0; }
    i32[ret>>2] = i32[ret>>2] * base + d;
    ++pos;
  }
  if (negate) { i32[ret>>2] = -i32[ret>>2]; }
  return -1;
}

function FConvert(pos, n, ret) {
  f32[ret>>2] = 0;
  var negate = 0;
  var has_dot = 0;
  var exp = 0;
  var shift = 1;
  if (!n) { return 0; }
  if (u8[pos] == '-'.charCodeAt(0)) { negate = -1; ++pos; --n; }
  for (; n; --n) {
    if (u8[pos] >= 48 && u8[pos] <= 48 + 9) {
      if (has_dot) {
        shift = shift * 0.1;
        f32[ret>>2] = f32[ret>>2] + (u8[pos] - 48) * shift;
      } else {
        f32[ret>>2] = f32[ret>>2] * 10 + (u8[pos] - 48);
      }
    } else if (u8[pos] == 'e'.charCodeAt(0) || u8[pos] == 'E'.charCodeAt(0)) {
      break;
    } else if (u8[pos] == '.'.charCodeAt(0)) {
      if (has_dot) { return 0; }
      has_dot = -1;
    } else {
      return 0;
    }
    ++pos;
  }
  if (!n) { return 0; }  // must have E
  ++pos; --n;
  if (n) {
    var tmp = f32[ret>>2];
    if (!Convert(pos, n, 10, ret)) { return 0; }
    exp = i32[ret>>2];
    f32[ret>>2] = tmp;
  }
  if (exp < -128 || exp > 128) { return 0; }
  for (; exp < 0; ++exp) { f32[ret>>2] *= 0.1; }
  for (; exp > 0; --exp) { f32[ret>>2] *= 10.0; }
  if (negate) { f32[ret>>2] = -f32[ret>>2]; }
  return -1;
}

function Evaluate1(rp) {
  var call = 0;
  var tos, sp, ip, fp;

  // UNPARK
  sp = i32[rp>>2]; rp -= 4;
  tos = i32[sp>>2]; sp -= 4;
  fp = i32[rp>>2]; rp -= 4;
  ip = i32[rp>>2]; rp -= 4;

  var name = sp + 8;
  var len = Parse(32, name);
  if (len == 0) {  // ignore empty
    sp += 4; i32[sp>>2] = tos; tos = 0;
    // PARK
    rp += 4; i32[rp>>2] = ip;
    rp += 4; i32[rp>>2] = fp;
    sp += 4; i32[sp>>2] = tos;
    rp += 4; i32[rp>>2] = sp;
    return rp;
  }
  name = i32[name>>2];
  var xt = Find(GetString(name, len));
  if (xt) {
    if (i32[g_sys_state>>2] && !(u8[TOFLAGS(xt)] & IMMEDIATE)) {
      COMMA(xt);
    } else {
      call = xt;
    }
  } else {
    if (DEBUGGING) { console.log('CONVERTING: ' + GetString(name, len)); }
    var n = sp + 16;
    if (Convert(name, len, i32[g_sys_base>>2], n)) {
      if (i32[g_sys_state>>2]) {
        COMMA(i32[g_sys_DOLIT_XT>>2]);
        COMMA(i32[n>>2]);
      } else {
        sp += 4; i32[sp>>2] = tos; tos = i32[n>>2];
      }
    } else {
      if (FConvert(name, len, n)) {
        if (i32[g_sys_state>>2]) {
          COMMA(i32[g_sys_DOFLIT_XT>>2]);
          f32[i32[g_sys_heap>>2]>>2] = f32[n>>2]; i32[g_sys_heap>>2] += 4;
        } else {
          fp += 4; f32[fp>>2] = f32[n>>2];
        }
      } else {
        if (DEBUGGING) { console.log('CANT FIND: ' + GetString(name, len)); }
        sp += 4; i32[sp>>2] = tos; tos = name;
        sp += 4; i32[sp>>2] = tos; tos = len;
        sp += 4; i32[sp>>2] = tos; tos = -1;
        call = i32[g_sys_notfound>>2];
      }
    }
  }
  sp += 4; i32[sp>>2] = tos; tos = call;
  // PARK
  rp += 4; i32[rp>>2] = ip;
  rp += 4; i32[rp>>2] = fp;
  sp += 4; i32[sp>>2] = tos;
  rp += 4; i32[rp>>2] = sp;

  return rp;
}

function InitDictionary() {
  Create("forth-builtins", 4);
  COMMA(0);
  Create("internals-builtins", 4);
  COMMA(1);
  Builtin("CALL", 8, 0, 0);
  Builtin("DOFLIT", 8, 1, 1);
  Builtin("FP@", 8, 0, 2);
  Builtin("FP!", 8, 0, 3);
  Builtin("SF@", 8, 0, 4);
  Builtin("SF!", 8, 0, 5);
  Builtin("FDUP", 8, 0, 6);
  Builtin("FNIP", 8, 0, 7);
  Builtin("FDROP", 8, 0, 8);
  Builtin("FOVER", 8, 0, 9);
  Builtin("FSWAP", 8, 0, 10);
  Builtin("FROT", 8, 0, 11);
  Builtin("FNEGATE", 8, 0, 12);
  Builtin("F0<", 8, 0, 13);
  Builtin("F0=", 8, 0, 14);
  Builtin("F=", 8, 0, 15);
  Builtin("F<", 8, 0, 16);
  Builtin("F>", 8, 0, 17);
  Builtin("F<>", 8, 0, 18);
  Builtin("F<=", 8, 0, 19);
  Builtin("F>=", 8, 0, 20);
  Builtin("F+", 8, 0, 21);
  Builtin("F-", 8, 0, 22);
  Builtin("F*", 8, 0, 23);
  Builtin("F/", 8, 0, 24);
  Builtin("1/F", 8, 0, 25);
  Builtin("S>F", 8, 0, 26);
  Builtin("F>S", 8, 0, 27);
  Builtin("S>FLOAT?", 8, 1, 28);
  Builtin("SFLOAT", 8, 0, 29);
  Builtin("SFLOATS", 8, 0, 30);
  Builtin("SFLOAT+", 8, 0, 31);
  Builtin("PI", 8, 0, 32);
  Builtin("FSIN", 8, 0, 33);
  Builtin("FCOS", 8, 0, 34);
  Builtin("FSINCOS", 8, 0, 35);
  Builtin("FATAN2", 8, 0, 36);
  Builtin("F**", 8, 0, 37);
  Builtin("FLOOR", 8, 0, 38);
  Builtin("FEXP", 8, 0, 39);
  Builtin("FLN", 8, 0, 40);
  Builtin("FABS", 8, 0, 41);
  Builtin("FMIN", 8, 0, 42);
  Builtin("FMAX", 8, 0, 43);
  Builtin("FSQRT", 8, 0, 44);
  Builtin("nip", 8, 0, 45);
  Builtin("rdrop", 8, 0, 46);
  Builtin("*/", 8, 0, 47);
  Builtin("*", 8, 0, 48);
  Builtin("/mod", 8, 0, 49);
  Builtin("/", 8, 0, 50);
  Builtin("mod", 8, 0, 51);
  Builtin("invert", 8, 0, 52);
  Builtin("negate", 8, 0, 53);
  Builtin("-", 8, 0, 54);
  Builtin("rot", 8, 0, 55);
  Builtin("-rot", 8, 0, 56);
  Builtin("?dup", 8, 0, 57);
  Builtin("<", 8, 0, 58);
  Builtin(">", 8, 0, 59);
  Builtin("<=", 8, 0, 60);
  Builtin(">=", 8, 0, 61);
  Builtin("=", 8, 0, 62);
  Builtin("<>", 8, 0, 63);
  Builtin("0<>", 8, 0, 64);
  Builtin("bl", 8, 0, 65);
  Builtin("nl", 8, 0, 66);
  Builtin("1+", 8, 0, 67);
  Builtin("1-", 8, 0, 68);
  Builtin("2*", 8, 0, 69);
  Builtin("2/", 8, 0, 70);
  Builtin("4*", 8, 0, 71);
  Builtin("4/", 8, 0, 72);
  Builtin("+!", 8, 0, 73);
  Builtin("cell+", 8, 0, 74);
  Builtin("cells", 8, 0, 75);
  Builtin("cell/", 8, 0, 76);
  Builtin("2drop", 8, 0, 77);
  Builtin("2dup", 8, 0, 78);
  Builtin("2@", 8, 0, 79);
  Builtin("2!", 8, 0, 80);
  Builtin("cmove", 8, 0, 81);
  Builtin("cmove>", 8, 0, 82);
  Builtin("fill", 8, 0, 83);
  Builtin("erase", 8, 0, 84);
  Builtin("blank", 8, 0, 85);
  Builtin("min", 8, 0, 86);
  Builtin("max", 8, 0, 87);
  Builtin("abs", 8, 0, 88);
  Builtin("here", 8, 0, 89);
  Builtin("allot", 8, 0, 90);
  Builtin(",", 8, 0, 91);
  Builtin("c,", 8, 0, 92);
  Builtin("'heap", 8, 1, 93);
  Builtin("current", 8, 0, 94);
  Builtin("'context", 8, 1, 95);
  Builtin("'latestxt", 8, 1, 96);
  Builtin("'notfound", 8, 1, 97);
  Builtin("'heap-start", 8, 1, 98);
  Builtin("'heap-size", 8, 1, 99);
  Builtin("'stack-cells", 8, 1, 100);
  Builtin("'boot", 8, 1, 101);
  Builtin("'boot-size", 8, 1, 102);
  Builtin("'tib", 8, 1, 103);
  Builtin("#tib", 8, 0, 104);
  Builtin(">in", 8, 0, 105);
  Builtin("state", 8, 0, 106);
  Builtin("base", 8, 0, 107);
  Builtin("'argc", 8, 1, 108);
  Builtin("'argv", 8, 1, 109);
  Builtin("'runner", 8, 1, 110);
  Builtin("'throw-handler", 8, 1, 111);
  Builtin("context", 8, 0, 112);
  Builtin("latestxt", 8, 0, 113);
  Builtin("[", 9, 0, 114);
  Builtin("]", 9, 0, 115);
  Builtin("literal", 9, 0, 116);
  Builtin("NOP", 8, 1, 117);
  Builtin("0=", 8, 0, 118);
  Builtin("0<", 8, 0, 119);
  Builtin("+", 8, 0, 120);
  Builtin("U/MOD", 8, 0, 121);
  Builtin("*/MOD", 8, 0, 122);
  Builtin("LSHIFT", 8, 0, 123);
  Builtin("RSHIFT", 8, 0, 124);
  Builtin("ARSHIFT", 8, 0, 125);
  Builtin("AND", 8, 0, 126);
  Builtin("OR", 8, 0, 127);
  Builtin("XOR", 8, 0, 128);
  Builtin("DUP", 8, 0, 129);
  Builtin("SWAP", 8, 0, 130);
  Builtin("OVER", 8, 0, 131);
  Builtin("DROP", 8, 0, 132);
  Builtin("@", 8, 0, 133);
  Builtin("SL@", 8, 0, 134);
  Builtin("UL@", 8, 0, 135);
  Builtin("SW@", 8, 0, 136);
  Builtin("UW@", 8, 0, 137);
  Builtin("C@", 8, 0, 138);
  Builtin("!", 8, 0, 139);
  Builtin("L!", 8, 0, 140);
  Builtin("W!", 8, 0, 141);
  Builtin("C!", 8, 0, 142);
  Builtin("SP@", 8, 0, 143);
  Builtin("SP!", 8, 0, 144);
  Builtin("RP@", 8, 0, 145);
  Builtin("RP!", 8, 0, 146);
  Builtin(">R", 8, 0, 147);
  Builtin("R>", 8, 0, 148);
  Builtin("R@", 8, 0, 149);
  Builtin("EXECUTE", 8, 0, 150);
  Builtin("BRANCH", 8, 1, 151);
  Builtin("0BRANCH", 8, 1, 152);
  Builtin("DONEXT", 8, 1, 153);
  Builtin("DOLIT", 8, 1, 154);
  Builtin("DOSET", 8, 1, 155);
  Builtin("DOCOL", 8, 1, 156);
  Builtin("DOCON", 8, 1, 157);
  Builtin("DOVAR", 8, 1, 158);
  Builtin("DOCREATE", 8, 1, 159);
  Builtin("DODOES", 8, 1, 160);
  Builtin("ALITERAL", 8, 1, 161);
  Builtin("CELL", 8, 0, 162);
  Builtin("LONG-SIZE", 8, 1, 163);
  Builtin("FIND", 8, 0, 164);
  Builtin("PARSE", 8, 0, 165);
  Builtin("S>NUMBER?", 8, 1, 166);
  Builtin("CREATE", 8, 0, 167);
  Builtin("VARIABLE", 8, 0, 168);
  Builtin("CONSTANT", 8, 0, 169);
  Builtin("DOES>", 8, 0, 170);
  Builtin("IMMEDIATE", 8, 0, 171);
  Builtin(">BODY", 8, 0, 172);
  Builtin("'SYS", 8, 1, 173);
  Builtin("YIELD", 8, 1, 174);
  Builtin(":", 8, 0, 175);
  Builtin("EVALUATE1", 8, 1, 176);
  Builtin("EXIT", 8, 0, 177);
  Builtin("'builtins", 8, 1, 178);
  Builtin(";", 9, 0, 179);

  SetupBuiltins();
}

function Init() {
  i32[g_sys_heap_start>>2] = 0;
  i32[g_sys_heap_size>>2] = HEAP_SIZE;
  i32[g_sys_stack_cells>>2] = STACK_CELLS;

  // Start heap after G_SYS area.
  i32[g_sys_heap>>2] = i32[g_sys_heap_start>>2] + 256;
  i32[g_sys_heap>>2] += 4;

  // Allocate stacks.
  var fp = i32[g_sys_heap>>2] + 4; i32[g_sys_heap>>2] += STACK_CELLS * 4;
  var rp = i32[g_sys_heap>>2] + 4; i32[g_sys_heap>>2] += STACK_CELLS * 4;
  var sp = i32[g_sys_heap>>2] + 4; i32[g_sys_heap>>2] += STACK_CELLS * 4;

  // FORTH worldlist (relocated when vocabularies added).
  var forth_wordlist = i32[g_sys_heap>>2];
  COMMA(0);
  // Vocabulary stack.
  i32[g_sys_current>>2] = forth_wordlist;
  i32[g_sys_context>>2] = i32[g_sys_heap>>2];
  i32[g_sys_latestxt>>2] = 0;
  COMMA(forth_wordlist);
  for (var i = 0; i < VOCABULARY_DEPTH; ++i) { COMMA(0); }

  // setup boot text.
  var source = i32[g_sys_heap>>2];
  var len = Load(i32[g_sys_heap>>2], boot);
  i32[g_sys_heap>>2] += len;
  var source_len = i32[g_sys_heap>>2] - source;
  i32[g_sys_boot>>2] = source;
  i32[g_sys_boot_size>>2] = source_len;

  InitDictionary();

  i32[g_sys_latestxt>>2] = 0;  // So last builtin doesn't get wrong size.
  i32[g_sys_DOLIT_XT>>2] = Find("DOLIT");
  i32[g_sys_DOFLIT_XT>>2] = Find("DOFLIT");
  i32[g_sys_DOEXIT_XT>>2] = Find("EXIT");
  i32[g_sys_YIELD_XT>>2] = Find("YIELD");
  i32[g_sys_notfound>>2] = Find("DROP");

  // Init code.
  var start = i32[g_sys_heap>>2];
  COMMA(Find("EVALUATE1"));
  COMMA(Find("BRANCH"));
  COMMA(start);

  i32[g_sys_argc>>2] = 0;
  i32[g_sys_argv>>2] = 0;
  i32[g_sys_base>>2] = 10;
  i32[g_sys_tib>>2] = source;
  i32[g_sys_ntib>>2] = source_len;
  i32[g_sys_ntib>>2] = source_len;

  rp += 4; i32[rp>>2] = start;
  rp += 4; i32[rp>>2] = fp;
  rp += 4; i32[rp>>2] = sp;
  i32[g_sys_rp>>2] = rp;
  
  
  
}

function VM(stdlib, foreign, heap) {
  "use asm";

  var imul = stdlib.Math.imul;
  var fround = stdlib.Math.fround;

  var sqrt = stdlib.Math.sqrt;
  var sin = stdlib.Math.sin;
  var cos = stdlib.Math.cos;
  var atan2 = stdlib.Math.atan2;
  var floor = stdlib.Math.floor;
  var exp = stdlib.Math.exp;
  var log = stdlib.Math.log;
  var pow = stdlib.Math.pow;
  var fabs = stdlib.Math.abs;
  var fmin = stdlib.Math.min;
  var fmax = stdlib.Math.max;

  var SSMOD = foreign.SSMOD;
  var Call = foreign.Call;
  var COMMA = foreign.COMMA;
  var CCOMMA = foreign.CCOMMA;
  var DOES = foreign.DOES;
  var DOIMMEDIATE = foreign.DOIMMEDIATE;
  var UNSMUDGE = foreign.UNSMUDGE;
  var TOBODY = foreign.TOBODY;
  var create = foreign.create;
  var find = foreign.find;
  var parse = foreign.parse;
  var convert = foreign.convert;
  var fconvert = foreign.fconvert;
  var evaluate1 = foreign.evaluate1;
  var emitlog = foreign.log;
  var trace = foreign.trace;

  var u8 = new stdlib.Uint8Array(heap);
  var i16 = new stdlib.Int16Array(heap);
  var i32 = new stdlib.Int32Array(heap);
  var f32 = new stdlib.Float32Array(heap);

  const g_sys = 256;
  const g_sys_heap = 256;
  const g_sys_current = 260;
  const g_sys_context = 264;
  const g_sys_latestxt = 268;
  const g_sys_notfound = 272;
  const g_sys_heap_start = 276;
  const g_sys_heap_size = 280;
  const g_sys_stack_cells = 284;
  const g_sys_boot = 288;
  const g_sys_boot_size = 292;
  const g_sys_tib = 296;
  const g_sys_ntib = 300;
  const g_sys_tin = 304;
  const g_sys_state = 308;
  const g_sys_base = 312;
  const g_sys_argc = 316;
  const g_sys_argv = 320;
  const g_sys_runner = 324;
  const g_sys_throw_handler = 328;
  const g_sys_rp = 332;
  const g_sys_DOLIT_XT = 336;
  const g_sys_DOFLIT_XT = 340;
  const g_sys_DOEXIT_XT = 344;
  const g_sys_YIELD_XT = 348;
  const g_sys_DOCREATE_OP = 352;
  const g_sys_builtins = 356;
  const OP_DOCREATE = 159;
  const OP_DODOES = 160;
  const OP_DOCOL = 156;
  const OP_DOVAR = 158;
  const OP_DOCON = 157;


  function memset(dst, ch, n) {
    dst = dst | 0;
    ch = ch | 0;
    n = n | 0;
    while (n | 0) {
      u8[dst] = ch;
      dst = (dst + 1) | 0;
      n = (n - 1) | 0;
    }
  }

  function memmove(dst, src, n) {
    dst = dst | 0;
    src = src | 0;
    n = n | 0;
    if ((src | 0) < (dst | 0)) {
      src = (src + n - 1) | 0;
      dst = (dst + n - 1) | 0;
      while (n | 0) {
        u8[dst] = u8[src];
        src = (src - 1) | 0;
        dst = (dst - 1) | 0;
        n = (n - 1) | 0;
      }
    } else {
      while (n | 0) {
        u8[dst] = u8[src];
        src = (src + 1) | 0;
        dst = (dst + 1) | 0;
        n = (n - 1) | 0;
      }
    }
  }

  function run() {
    var tos = 0;
    var ip = 0;
    var sp = 0;
    var rp = 0;
    var fp = 0;
    var w = 0;
    var ir = 0;
    var ft = fround(0.0);

    // UNPARK
    rp = i32[g_sys_rp>>2]|0;
    sp = i32[rp>>2]|0; rp = (rp - 4)|0;
    tos = i32[sp>>2]|0; sp = (sp - 4)|0;
    fp = i32[rp>>2]|0; rp = (rp - 4)|0;
    ip = i32[rp>>2]|0; rp = (rp - 4)|0;
    for (;;) {
      //trace(ip|0, sp|0, tos|0);
      w = i32[ip>>2]|0;
      ip = (ip + 4)|0;
      decode: for (;;) {
        ir = u8[w]|0;
        switch (ir&0xff) {
          case 0:  // CALL
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            sp = Call(sp|0)|0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 1:  // DOFLIT
            fp = (fp + 4) | 0, f32[fp>>2] = f32[ip>>2];
            ip = (ip + 4) | 0;
            break;
          case 2:  // FP@
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = fp;
            break;
          case 3:  // FP!
            fp = (tos|0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 4:  // SF@
            fp = (fp + 4) | 0, f32[fp>>2] = f32[tos>>2];
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 5:  // SF!
            f32[tos>>2] = fround(f32[fp>>2]), fp = (fp - 4) | 0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 6:  // FDUP
            f32[(fp + 4)>>2] = fround(f32[fp>>2]);
            fp = (fp + 4) | 0;
            break;
          case 7:  // FNIP
            f32[(fp - 4)>>2] = fround(f32[fp>>2]);
            fp = (fp - 4) | 0;
            break;
          case 8:  // FDROP
            fp = (fp - 4) | 0;
            break;
          case 9:  // FOVER
            f32[(fp + 4)>>2] = fround(f32[(fp - 4)>>2]);
            fp = (fp + 4) | 0;
            break;
          case 10:  // FSWAP
            ft = fround(f32[(fp - 4)>>2]);
            f32[(fp - 4)>>2] = fround(f32[fp>>2]);
            f32[fp>>2] = ft;
            break;
          case 11:  // FROT
            ft = fround(f32[(fp - 8)>>2]);
            f32[(fp - 8)>>2] = fround(f32[(fp - 4)>>2]);
            f32[(fp - 4)>>2] = fround(f32[fp>>2]);
            f32[fp>>2] = ft;
            break;
          case 12:  // FNEGATE
            f32[fp>>2] = -fround(f32[fp>>2]);
            break;
          case 13:  // F0<
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = fround(f32[fp>>2]) < fround(0.0) ? -1 : 0;
            fp = (fp - 4) | 0;
            break;
          case 14:  // F0=
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = fround(f32[fp>>2]) == fround(0.0) ? -1 : 0;
            fp = (fp - 4) | 0;
            break;
          case 15:  // F=
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = fround(f32[(fp - 4)>>2]) == fround(f32[fp>>2]) ? -1 : 0;
            fp = (fp - 8) | 0;
            break;
          case 16:  // F<
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = fround(f32[(fp - 4)>>2]) < fround(f32[fp>>2]) ? -1 : 0;
            fp = (fp - 8) | 0;
            break;
          case 17:  // F>
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = fround(f32[(fp - 4)>>2]) > fround(f32[fp>>2]) ? -1 : 0;
            fp = (fp - 8) | 0;
            break;
          case 18:  // F<>
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = fround(f32[(fp - 4)>>2]) != fround(f32[fp>>2]) ? -1 : 0;
            fp = (fp - 8) | 0;
            break;
          case 19:  // F<=
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = fround(f32[(fp - 4)>>2]) <= fround(f32[fp>>2]) ? -1 : 0;
            fp = (fp - 8) | 0;
            break;
          case 20:  // F>=
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = fround(f32[(fp - 4)>>2]) >= fround(f32[fp>>2]) ? -1 : 0;
            fp = (fp - 8) | 0;
            break;
          case 21:  // F+
            f32[(fp - 4)>>2] = fround(f32[(fp - 4)>>2]) + fround(f32[fp>>2]);
            fp = (fp - 4) | 0;
            break;
          case 22:  // F-
            f32[(fp - 4)>>2] = fround(f32[(fp - 4)>>2]) - fround(f32[fp>>2]);
            fp = (fp - 4) | 0;
            break;
          case 23:  // F*
            f32[(fp - 4)>>2] = fround(f32[(fp - 4)>>2]) * fround(f32[fp>>2]);
            fp = (fp - 4) | 0;
            break;
          case 24:  // F/
            f32[(fp - 4)>>2] = fround(f32[(fp - 4)>>2]) / fround(f32[fp>>2]);
            fp = (fp - 4) | 0;
            break;
          case 25:  // 1/F
            f32[fp>>2] = fround(1.0) / fround(f32[fp>>2]);
            break;
          case 26:  // S>F
            fp = (fp + 4) | 0, f32[fp>>2] = fround(tos|0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 27:  // F>S
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = ~~fround(f32[fp>>2]), fp = (fp - 4) | 0;
            break;
          case 28:  // S>FLOAT?
            tos = fconvert((i32[sp>>2]|0), (tos|0), fp|0)|0;
            sp = (sp - 4) | 0;
            break;
          case 29:  // SFLOAT
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = 4;
            break;
          case 30:  // SFLOATS
            tos = (tos * 4)|0;
            break;
          case 31:  // SFLOAT+
            tos = (tos + 4)|0;
            break;
          case 32:  // PI
            fp = (fp + 4) | 0, f32[fp>>2] = 3.14159265359;
            break;
          case 33:  // FSIN
            f32[fp>>2] = sin(+fround(f32[fp>>2]));
            break;
          case 34:  // FCOS
            f32[fp>>2] = cos(+fround(f32[fp>>2]));
            break;
          case 35:  // FSINCOS
            f32[(fp + 4)>>2] = cos(+fround(f32[fp>>2]));
            f32[fp>>2] = sin(+fround(f32[fp>>2]));
            fp = (fp + 4) | 0;
            break;
          case 36:  // FATAN2
            f32[(fp - 4)>>2] = atan2(+fround(f32[(fp - 4)>>2]), +fround(f32[fp>>2]));
            fp = (fp - 4) | 0;
            break;
          case 37:  // F**
            f32[(fp - 4)>>2] = pow(+fround(f32[(fp - 4)>>2]), +fround(f32[fp>>2]));
            fp = (fp - 4) | 0;
            break;
          case 38:  // FLOOR
            f32[fp>>2] = floor(+fround(f32[fp>>2]));
            break;
          case 39:  // FEXP
            f32[fp>>2] = exp(+fround(f32[fp>>2]));
            break;
          case 40:  // FLN
            f32[fp>>2] = log(+fround(f32[fp>>2]));
            break;
          case 41:  // FABS
            f32[fp>>2] = fabs(+fround(f32[fp>>2]));
            break;
          case 42:  // FMIN
            f32[(fp - 4)>>2] = fmin(+fround(f32[(fp - 4)>>2]), +fround(f32[fp>>2]));
            fp = (fp - 4) | 0;
            break;
          case 43:  // FMAX
            f32[(fp - 4)>>2] = fmax(+fround(f32[(fp - 4)>>2]), +fround(f32[fp>>2]));
            fp = (fp - 4) | 0;
            break;
          case 44:  // FSQRT
            f32[fp>>2] = sqrt(+fround(f32[fp>>2]));
            break;
          case 45:  // nip
            (sp = (sp - 4) | 0);
            break;
          case 46:  // rdrop
            rp = (rp - 4) | 0;
            break;
          case 47:  // */
            sp = (sp + 4)|0;
            i32[sp>>2] = (tos|0)|0;
            SSMOD(sp|0);
            tos = i32[sp>>2]|0;
            sp = (sp - 8)|0;
            (sp = (sp - 4) | 0);
            break;
          case 48:  // *
            tos = imul(tos, (i32[sp>>2]|0));
            sp = (sp - 4) | 0;
            break;
          case 49:  // /mod
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            i32[sp>>2] = 1;
            sp = (sp + 4)|0;
            i32[sp>>2] = (tos|0)|0;
            SSMOD(sp|0);
            tos = i32[sp>>2]|0;
            sp = (sp - 8)|0;
            break;
          case 50:  // /
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            i32[sp>>2] = 1;
            sp = (sp + 4)|0;
            i32[sp>>2] = (tos|0)|0;
            SSMOD(sp|0);
            tos = i32[sp>>2]|0;
            sp = (sp - 8)|0;
            (sp = (sp - 4) | 0);
            break;
          case 51:  // mod
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            i32[sp>>2] = 1;
            sp = (sp + 4)|0;
            i32[sp>>2] = (tos|0)|0;
            SSMOD(sp|0);
            tos = i32[sp>>2]|0;
            sp = (sp - 8)|0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 52:  // invert
            tos = ~tos;
            break;
          case 53:  // negate
            tos = (-tos)|0;
            break;
          case 54:  // -
            tos = ((i32[sp>>2]|0) - (tos|0))|0;
            sp = (sp - 4) | 0;
            break;
          case 55:  // rot
            w = (i32[(sp - 4)>>2]|0);
            i32[(sp - 4)>>2] = (i32[sp>>2]|0);
            i32[sp>>2] = (tos|0);
            tos = w;
            break;
          case 56:  // -rot
            w = (tos|0);
            tos = (i32[sp>>2]|0);
            i32[sp>>2] = (i32[(sp - 4)>>2]|0);
            i32[(sp - 4)>>2] = w;
            break;
          case 57:  // ?dup
            if (tos) (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            break;
          case 58:  // <
            tos = (i32[sp>>2]|0) < (tos|0) ? -1 : 0;
            sp = (sp - 4) | 0;
            break;
          case 59:  // >
            tos = (i32[sp>>2]|0) > (tos|0) ? -1 : 0;
            sp = (sp - 4) | 0;
            break;
          case 60:  // <=
            tos = (i32[sp>>2]|0) <= (tos|0) ? -1 : 0;
            sp = (sp - 4) | 0;
            break;
          case 61:  // >=
            tos = (i32[sp>>2]|0) >= (tos|0) ? -1 : 0;
            sp = (sp - 4) | 0;
            break;
          case 62:  // =
            tos = (i32[sp>>2]|0) == (tos|0) ? -1 : 0;
            sp = (sp - 4) | 0;
            break;
          case 63:  // <>
            tos = (i32[sp>>2]|0) != (tos|0) ? -1 : 0;
            sp = (sp - 4) | 0;
            break;
          case 64:  // 0<>
            tos = (tos|0) ? -1 : 0;
            break;
          case 65:  // bl
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = 32;
            break;
          case 66:  // nl
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = 10;
            break;
          case 67:  // 1+
            tos = (tos + 1)|0;
            break;
          case 68:  // 1-
            tos = (tos - 1)|0;
            break;
          case 69:  // 2*
            tos = (tos|0) << 1;
            break;
          case 70:  // 2/
            tos = (tos|0) >> 1;
            break;
          case 71:  // 4*
            tos = (tos|0) << 2;
            break;
          case 72:  // 4/
            tos = (tos|0) >> 2;
            break;
          case 73:  // +!
            i32[tos>>2] = ((i32[tos>>2]|0) + (i32[sp>>2]|0))|0;
            sp = (sp - 4) | 0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 74:  // cell+
            tos = (tos + 4)|0;
            break;
          case 75:  // cells
            tos = (tos * 4)|0;
            break;
          case 76:  // cell/
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = 4;
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            i32[sp>>2] = 1;
            sp = (sp + 4)|0;
            i32[sp>>2] = (tos|0)|0;
            SSMOD(sp|0);
            tos = i32[sp>>2]|0;
            sp = (sp - 8)|0;
            (sp = (sp - 4) | 0);
            break;
          case 77:  // 2drop
            (sp = (sp - 4) | 0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 78:  // 2dup
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = (i32[(sp - 4)>>2]|0);
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = (i32[(sp - 4)>>2]|0);
            break;
          case 79:  // 2@
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            i32[sp>>2] = (i32[tos>>2]|0);
            tos = (i32[(tos + 4)>>2]|0);
            break;
          case 80:  // 2!
            i32[tos>>2] = (i32[(sp - 4)>>2]|0);
            i32[(tos + 4)>>2] = (i32[sp>>2]|0);
            sp = (sp - 8) | 0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 81:  // cmove
            memmove((i32[sp>>2]|0), (i32[(sp - 4)>>2]|0), (tos|0));
            sp = (sp - 8) | 0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 82:  // cmove>
            memmove((i32[sp>>2]|0), (i32[(sp - 4)>>2]|0), (tos|0));
            sp = (sp - 8) | 0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 83:  // fill
            memset((i32[(sp - 4)>>2]|0), (tos|0), (i32[sp>>2]|0));
            sp = (sp - 8) | 0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 84:  // erase
            memset((i32[sp>>2]|0), 0, (tos|0));
            (sp = (sp - 4) | 0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 85:  // blank
            memset((i32[sp>>2]|0), 32, (tos|0));
            (sp = (sp - 4) | 0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 86:  // min
            tos = (tos|0) < (i32[sp>>2]|0) ? (tos|0) : (i32[sp>>2]|0);
            (sp = (sp - 4) | 0);
            break;
          case 87:  // max
            tos = (tos|0) > (i32[sp>>2]|0) ? (tos|0) : (i32[sp>>2]|0);
            (sp = (sp - 4) | 0);
            break;
          case 88:  // abs
            tos = (tos|0) < 0 ? (-tos)|0 : (tos|0);
            break;
          case 89:  // here
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = (i32[g_sys_heap>>2]|0);
            break;
          case 90:  // allot
            i32[g_sys_heap>>2] = (tos + (i32[g_sys_heap>>2]|0));
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 91:  // ,
            COMMA(tos|0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 92:  // c,
            CCOMMA(tos|0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 93:  // 'heap
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_heap;
            break;
          case 94:  // current
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_current;
            break;
          case 95:  // 'context
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_context;
            break;
          case 96:  // 'latestxt
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_latestxt;
            break;
          case 97:  // 'notfound
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_notfound;
            break;
          case 98:  // 'heap-start
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_heap_start;
            break;
          case 99:  // 'heap-size
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_heap_size;
            break;
          case 100:  // 'stack-cells
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_stack_cells;
            break;
          case 101:  // 'boot
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_boot;
            break;
          case 102:  // 'boot-size
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_boot_size;
            break;
          case 103:  // 'tib
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_tib;
            break;
          case 104:  // #tib
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_ntib;
            break;
          case 105:  // >in
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_tin;
            break;
          case 106:  // state
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_state;
            break;
          case 107:  // base
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_base;
            break;
          case 108:  // 'argc
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_argc;
            break;
          case 109:  // 'argv
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_argv;
            break;
          case 110:  // 'runner
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_runner;
            break;
          case 111:  // 'throw-handler
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys_throw_handler;
            break;
          case 112:  // context
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = (i32[g_sys_context>>2]|0 + 4)|0;
            break;
          case 113:  // latestxt
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = (i32[g_sys_latestxt>>2]|0);
            break;
          case 114:  // [
            i32[g_sys_state>>2] = 0;
            break;
          case 115:  // ]
            i32[g_sys_state>>2] = -1;
            break;
          case 116:  // literal
            COMMA((i32[g_sys_DOLIT_XT>>2]|0));
            COMMA(tos|0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 117:  // NOP
            ;
            break;
          case 118:  // 0=
            tos = !tos ? -1 : 0;
            break;
          case 119:  // 0<
            tos = (tos|0) < 0 ? -1 : 0;
            break;
          case 120:  // +
            tos = (tos + (i32[sp>>2]|0))|0;
            sp = (sp - 4) | 0;
            break;
          case 121:  // U/MOD
            w = (i32[sp>>2]|0);
            i32[sp>>2] = (w>>>0) % (tos>>>0);
            tos = ((w>>>0) / (tos>>>0))|0;
            break;
          case 122:  // */MOD
            sp = (sp + 4)|0;
            i32[sp>>2] = (tos|0)|0;
            SSMOD(sp|0);
            tos = i32[sp>>2]|0;
            sp = (sp - 8)|0;
            break;
          case 123:  // LSHIFT
            tos = ((i32[sp>>2]|0) << (tos|0));
            sp = (sp - 4) | 0;
            break;
          case 124:  // RSHIFT
            tos = ((((i32[sp>>2]|0>>>0))) >> (tos|0));
            sp = (sp - 4) | 0;
            break;
          case 125:  // ARSHIFT
            tos = ((i32[sp>>2]|0) >> (tos|0));
            sp = (sp - 4) | 0;
            break;
          case 126:  // AND
            tos = (tos|0) & (i32[sp>>2]|0), sp = (sp - 4) | 0;
            break;
          case 127:  // OR
            tos = (tos|0) | (i32[sp>>2]|0), sp = (sp - 4) | 0;
            break;
          case 128:  // XOR
            tos = (tos|0) ^ (i32[sp>>2]|0), sp = (sp - 4) | 0;
            break;
          case 129:  // DUP
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            break;
          case 130:  // SWAP
            w = (tos|0);
            tos = (i32[sp>>2]|0);
            i32[sp>>2] = w;
            break;
          case 131:  // OVER
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = (i32[(sp - 4)>>2]|0);
            break;
          case 132:  // DROP
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 133:  // @
            tos = (i32[tos>>2]|0);
            break;
          case 134:  // SL@
            tos = (i32[tos>>2]|0);
            break;
          case 135:  // UL@
            tos = (i32[tos>>2]>>>0);
            break;
          case 136:  // SW@
            tos = (i16[tos>>1]|0);
            break;
          case 137:  // UW@
            tos = (i16[tos>>1]>>>0);
            break;
          case 138:  // C@
            tos = (u8[tos]|0);
            break;
          case 139:  // !
            i32[tos>>2] = (i32[sp>>2]|0), sp = (sp - 4) | 0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 140:  // L!
            i32[tos>>2] = (i32[sp>>2]|0), sp = (sp - 4) | 0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 141:  // W!
            i16[tos>>1] = (i32[sp>>2]|0), sp = (sp - 4) | 0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 142:  // C!
            u8[tos] = (i32[sp>>2]|0), sp = (sp - 4) | 0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 143:  // SP@
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = sp;
            break;
          case 144:  // SP!
            sp = (tos|0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 145:  // RP@
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = rp;
            break;
          case 146:  // RP!
            rp = (tos|0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 147:  // >R
            rp = (rp + 4) | 0, i32[rp>>2] = (tos|0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 148:  // R>
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = (i32[rp>>2]|0);
            rp = (rp - 4) | 0;
            break;
          case 149:  // R@
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = (i32[rp>>2]|0);
            break;
          case 150:  // EXECUTE
            w = (tos|0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            continue decode;
            break;
          case 151:  // BRANCH
            ip = (i32[ip>>2]|0);
            break;
          case 152:  // 0BRANCH
            if (!tos) ip = (i32[ip>>2]|0);
            else ip = (ip + 4) | 0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 153:  // DONEXT
            i32[rp>>2] = (i32[rp>>2]|0) - 1;
            if (~(i32[rp>>2]|0)) ip = (i32[ip>>2]|0);
            else (rp = (rp - 4) | 0, ip = (ip + 4) | 0);
            break;
          case 154:  // DOLIT
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = (i32[ip>>2]|0), ip = (ip + 4) | 0;
            break;
          case 155:  // DOSET
            i32[i32[ip>>2]>>2] = (tos|0);
            ip = (ip + 4) | 0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 156:  // DOCOL
            rp = (rp + 4) | 0;
            i32[rp>>2] = ip;
            ip = ((w+4)|0);
            break;
          case 157:  // DOCON
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = (i32[((w+4)|0)>>2]|0);
            break;
          case 158:  // DOVAR
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = (w+4)|0;
            break;
          case 159:  // DOCREATE
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = (w+8)|0;
            break;
          case 160:  // DODOES
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = (w+8)|0;
            rp = (rp + 4) | 0;
            i32[rp>>2] = ip;
            ip = (i32[((w+4)|0)>>2]|0);
            break;
          case 161:  // ALITERAL
            COMMA((i32[g_sys_DOLIT_XT>>2]|0));
            COMMA(tos|0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 162:  // CELL
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = 4;
            break;
          case 163:  // LONG-SIZE
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = 4;
            break;
          case 164:  // FIND
            tos = find((i32[sp>>2]|0), (tos|0))|0;
            sp = (sp - 4) | 0;
            break;
          case 165:  // PARSE
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = parse(tos|0, sp|0)|0;
            break;
          case 166:  // S>NUMBER?
            tos = convert((i32[sp>>2]|0), (tos|0), (i32[g_sys_base>>2]|0), sp|0)|0;
            if (!tos) sp = (sp - 4) | 0;
            break;
          case 167:  // CREATE
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = parse(32, sp|0)|0;
            create((i32[sp>>2]|0), (tos|0), 0, OP_DOCREATE);
            COMMA(0);
            ((sp = (sp - 4) | 0), (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0));
            break;
          case 168:  // VARIABLE
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = parse(32, sp|0)|0;
            create((i32[sp>>2]|0), (tos|0), 0, OP_DOVAR);
            COMMA(0);
            ((sp = (sp - 4) | 0), (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0));
            break;
          case 169:  // CONSTANT
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = parse(32, sp|0)|0;
            create((i32[sp>>2]|0), (tos|0), 0, OP_DOCON);
            ((sp = (sp - 4) | 0), (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0));
            COMMA(tos|0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 170:  // DOES>
            DOES(ip|0);
            ip = (i32[rp>>2]|0);
            rp = (rp - 4) | 0;
            break;
          case 171:  // IMMEDIATE
            DOIMMEDIATE();
            break;
          case 172:  // >BODY
            tos = TOBODY(tos|0)|0;
            break;
          case 173:  // 'SYS
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = g_sys;
            break;
          case 174:  // YIELD
            rp = (rp + 4) | 0, i32[rp>>2] = ip;
            rp = (rp + 4) | 0, i32[rp>>2] = fp;
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            rp = (rp + 4) | 0, i32[rp>>2] = sp;;
            i32[g_sys_rp>>2] = rp | 0;
            return;
            break;
          case 175:  // :
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = parse(32, sp|0)|0;
            create((i32[sp>>2]|0), (tos|0), 2, OP_DOCOL);
            i32[g_sys_state>>2] = -1;
            sp = (sp - 4) | 0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            break;
          case 176:  // EVALUATE1
            rp = (rp + 4) | 0, i32[rp>>2] = ip;
            rp = (rp + 4) | 0, i32[rp>>2] = fp;
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            rp = (rp + 4) | 0, i32[rp>>2] = sp;;
            rp = evaluate1(rp|0)|0;
            sp = (i32[rp>>2]|0), rp = (rp - 4) | 0;
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            fp = (i32[rp>>2]|0), rp = (rp - 4) | 0;
            ip = (i32[rp>>2]|0), rp = (rp - 4) | 0;;
            w = (tos|0);
            (tos = (i32[sp>>2]|0), sp = (sp - 4) | 0);
            if (w) continue decode;
            break;
          case 177:  // EXIT
            ip = (i32[rp>>2]|0), rp = (rp - 4) | 0;
            break;
          case 178:  // 'builtins
            (sp = (sp + 4) | 0, i32[sp>>2] = (tos|0));
            tos = ((i32[g_sys_builtins>>2] + 8)|0);
            break;
          case 179:  // ;
            COMMA((i32[g_sys_DOEXIT_XT>>2]|0));
            UNSMUDGE();
            i32[g_sys_state>>2] = 0;
            break;

          default:
            break;
        }
        break;
      }
    }
  }
  return {run: run};
}

var ffi = {
  'Call': Call,
  'create': function(name, len, flags, op) { Create(GetString(name, len), flags, op); },
  'parse': function(sep, ret) { return Parse(sep, ret); },
  'find': function(a, n) { return Find(GetString(a, n)); },
  'convert': function(pos, n, base, ret) { return Convert(pos, n, base, ret); },
  'fconvert': function(pos, n, ret) { return FConvert(pos, n, ret); },
  'evaluate1': function(rp) { return Evaluate1(rp); },
  'log': function(n) { console.log(n); },
  'trace': function(ip, sp, tos) { trace(ip, sp, tos); },
  'COMMA': function(n) { COMMA(n); },
  'CCOMMA': function(n) { CCOMMA(n); },
  'SSMOD': function(sp) { SSMOD(sp); },
  'TOBODY': function(tos) { return TOBODY(tos); },
  'DOES': function(ip) { DOES(ip); },
  'DOIMMEDIATE': function() { DOIMMEDIATE(); },
  'UNSMUDGE': function() { UNSMUDGE(); },
};

function getGlobalObj() {
  return (function(g) {
    return g;
  })(new Function('return this')());
}
var globalObj = getGlobalObj();

var module = VM(globalObj, ffi, heap);

function run() {
  module.run();
  setTimeout(run, 0);
}

function Start() {
  LoadScripts(function() {
    Init();
    setTimeout(run, 0);
  });
}

if (globalObj.write) {
  Start();
} else {
  if (globalObj.ueforth === null) {
    globalObj.ueforth = context;
    context.Start = Start;
  } else {
    window.addEventListener('load', function() {
      Start();
    });
  }
}

})();

