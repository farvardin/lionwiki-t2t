<html>
	<head>
		<title>Generate PDF from txt2tags syntax</title>
		<meta http-equiv="content-type" content="text/html; charset=utf-8" />
		<meta name="robots" content="noindex, nofollow"/>
		<meta name="description" content="" />
		<meta name="viewport" content="width=device-width" />
		<link rel="icon" href="../templates/favicon.png" type="image/png" />
		<meta name="keywords" content="" />
		<link rel="stylesheet" href="lionwiki.css" />


<?php
	system("rm -fr *.pdf");		
    $action = $_GET['action'];
	if ($_GET['action'] != "undefined")
    {
        switch($action) {
				case "booklet":
					system("make booklet");
					break;
				case "pdf":
					system("make pdf");
					break;
				case "lettre":
					system("make lettre");
					break;
				case "cyoa-pdf":
					system("make cyoa-pdf");
					break;
				case "clean":
					system("make clean");
					break;
				default:
					system("echo '<a href='../index.php?page=textallion'><b>edit textallion page</b></a><br/><br/><a href='lionwiki.pdf'><b>Load PDF</b></a><br/><br/>' && make pdf");
					//system('/usr/bin/xvfb-run --server-args="-screen 0, 1920x1080x24"  /usr/bin/wkhtmltopdf --page-size A4 --margin-top 1.0cm --margin-bottom 1.0cm --margin-left 0.5cm --margin-right 0.5cm lionwiki.html lionwiki.pdf 2>&1');
					break;
			}
	}	

echo("<br/><br/>");
echo("<b>done</b><br/>");
echo('<INPUT Type="button" VALUE="Back" onClick="history.go(-1);return true;"></FORM>');

?>

</html>
