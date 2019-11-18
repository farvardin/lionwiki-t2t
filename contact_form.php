<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">

<?
$WikiTitle = "Lionwiki-t2t" ;
?>

	<head>
		<title><?php echo "$WikiTitle"; ?></title>
		<meta http-equiv="content-type" content="text/html; charset=utf-8" />
		<meta name="description" content="" />
		<meta name="viewport" content="width=device-width" />
		<link rel="icon" href="templates/favicon.png" type="image/png" />
		<meta name="keywords" content="" />
		<link rel="stylesheet" href="templates/minimaxing/5grid/core.css" />
		<link rel="stylesheet/less" href="templates/minimaxing/minimaxing.less" />
		
		<script src="templates/js/less.js" type="text/javascript"></script>

	</head>
	


<script language="JavaScript" type="text/javascript">
<!-- Hide from older browsers
function SwitchImg()
{ 
  var rem, keep=0, store, obj, switcher=new Array, history=document.Data;
    for (rem=0; rem < (SwitchImg.arguments.length-2); rem+=3) {
    	store = SwitchImg.arguments[(navigator.appName == 'Netscape')?rem:rem+1];
    if ((store.indexOf('document.layers[')==0 && document.layers==null) ||
        (store.indexOf('document.all[')==0 && document.all==null))
         store = 'document'+store.substring(store.lastIndexOf('.'),store.length);
         obj = eval(store);
    if (obj != null) {
   	   switcher[keep++] = obj;
      switcher[keep++] = (history==null || history[keep-1]!=obj)?obj.src:history[keep];
      obj.src = SwitchImg.arguments[rem+2];
  } }
  document.Data = switcher;
} 

function RestoreImg()
{ 
  if (document.Data != null)
    for (var rem=0; rem<(document.Data.length-1); rem+=2)
      document.Data[rem].src=document.Data[rem+1];
} 

// end hiding contents -->
</script>




	<body>
	<!-- ********************************************************* -->
		<div id="header-wrapper">
			<!--<h1>{WIKI_TITLE}</h1>-->
			<div class="5grid">
				<div class="12u-first">
					<header id="header">
					<h1><? echo "$WikiTitle"; ?></h1>
						
						<nav>
							<?php include "menu.php" ?>
						</nav>
					</header>
				
				</div>
			</div>
		</div>
			<div id="banner-wrapper">
			<div class="5grid">
				<div class="12u-first">
					
					
						<h1>Contact</h1>
					
				
				</div>
			</div>
		</div>
		<div id="main">
			<div class="5grid">
				<div class="main-row">
					<div class="12u-first">
						
						<section>
										

					
						



<form action="contact_send.php" method="post">



<p>
Your name:     &nbsp; &nbsp; &nbsp; 
<input name="name" style="border: 1px solid rgb(150, 150, 150); background-color: rgb(240, 240, 240); color: rgb(0, 0, 0); font-family: Verdana; font-size: 10pt;" size="26" maxlength="35">
<br/><br/>Your email address: &nbsp; 
<input name="email" style="border: 1px solid rgb(150, 150, 150); background-color: rgb(240, 240, 240); color: rgb(0, 0, 0); font-family: Verdana; font-size: 10pt;" size="26" maxlength="35">

<?php
$guessword="";
$hasard=rand(1,5);
/* entrées à rajouter également dans le fichier contact_send */
switch ($hasard){
case 1:
	$guessword="dog";
	break;
case 2:
	$guessword="cat";
	break;
case 3:
	$guessword="wolf";
	break;
case 4:
	$guessword="bird";
	break;
case 5:
	$guessword="fish";
	break;
}
?>

<br/><br/>
<?php echo "Word verification: Please enter this word in the field <i>$guessword</i> " 
?>
<input name="verif" style="border: 1px solid rgb(150, 150, 150); background-color: rgb(240, 240, 240); color: rgb(0, 0, 0); font-family: Verdana; font-size: 10pt;" size="26" maxlength="35">
</p>

<p>
<br/>
Your message <i>(10000 chars maxi)</i> : 
<br/>

<textarea name="message" cols="60" rows="10" style="border: 1px solid rgb(150, 150, 150); background-color: rgb(240, 240, 240); color: rgb(0, 0, 0); font-family: Verdana; font-size: 10pt;"></textarea>
<br/>
<input value="Send message" style="border: 1px solid rgb(120, 120, 120); background-color: rgb(200, 200, 200); color: rgb(70, 70, 70); font-family: Verdana; font-size: 9pt;" size="17" maxlength="25" type="submit">
</p>

</form>


<center><b><a href="index.php">index</a></b></center>	
	
		</section>
					
					</div>
				</div>
			</div>
		</div>
		<div id="footer-wrapper">
			<div class="5grid">
				
				<div class="12u-first">

					<div id="copyright">
					
					<br />
						Design CC-BY-SA based on <a href="http://n33.co/">n33</a>. Powered by <a href="https://bitbucket.org/farvardin/lionwiki-t2t/">LionWiki-t2t</a> <br/>
					</div>

				</div>
			</div>
		</div>
	<!-- ********************************************************* -->
	</body>
</html>








