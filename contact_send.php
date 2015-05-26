<html>
<head>
<META NAME="ROBOTS" CONTENT="NOINDEX,NOFOLLOW">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">

<?php
$WikiTitle = "Lionwiki-t2t" ;
?>

<title><?php echo "$WikiTitle"; ?></title>

		<link rel="stylesheet/less" href="templates/minimaxing/minimaxing.less" />
		
		<script src="templates/js/less.js" type="text/javascript"></script>

</head>

<body bgcolor="#dddddd" text="#111111" link="#222222" vlink="#232323" topmargin=0 leftmargin=0 marginwidth=0 marginheight=0>
<div align=center>
<br/>
<br/>
<br/>
<br/>
<br/>
<br/>

<?php
$email=$_POST['email'];
$message=$_POST['message'];
$sujet=$_POST['sujet'];
$name=$_POST['name'];
$verif=$_POST['verif'];
?>

<?php

 $Jour = date("d/m/Y H:i:s");
 
//foncton verifiant la validite d'un email (dans la forme)
function verifie_email($email)
{
	if (strlen($email)>255)
        { return "$email : Email too long. <br/>";}
	if (empty($email))
		{ return "You havent entered your email. <br/>"; }
	if (!ereg("@",$email))
		{ return "$email : email should have an arobase (@). <br/>"; }
	if (preg_match_all("/([^a-zA-Z0-9_\@\.\-])/i", $email, $trouve))
		{ return "$email : forbidden character found in email adress (".implode(", ",$trouve[0])."). <br/>"; }
	if (!preg_match("/^([a-z0-9_]|\\-|\\.)+@(([a-z0-9_]|\\-)+\\.)+[a-z]{2,4}\$/i", $email))
		{ return "$email : email is not valid (name@hostname.com).  <br/>"; }
	list($compte,$domaine)=split("@",$email,2);
 /* if (!checkdnsrr($domaine,"MX")) { return "$email : Ce domaine ($domaine) n'accepte pas les emails. <br/>"; }*/

 return $email;
 }
 
//fin de fonction

// init pg
$err="";

// test du mail

if ($email != ($testi=verifie_email($email)))
$err=$testi;

$email = strtolower($email);

// test du sujet
if (empty($sujet)||($sujet=="Enter your topic"))
$sujet = "Sans sujet";

//test du message
if (empty($message))
$err=$err." Enter a non-empty message<br/>";

if (strlen($message)>10000)
$err=$err." Your message is too long. 10000 chars maximum<br/>";

// test du code de verification
if (!eregi("(dog)|(cat)|(wolf)|(bird)|(fish)",$verif))
$err=$err."$verif : The verification code is not correct<br/>"; 


// si la personne a fait des erreurs
if (!empty($err))
{
echo "Your message couldnt be sent because of this: <br/><br/>";
echo $err;
echo " <br/> Please change your informations. <br/> ";
echo '<br/><a href="javascript:history.go(-1)">Back</a>';

}
else
{
// on envoie le mail
mail("youremailaddress@hostname.com","Contact PmWiki","** Name:   $name\n\n** Message: \n\n$message \n\n\n\n-------------------------------------------------------------------------------- \nfrom IP address: $_SERVER[REMOTE_ADDR], at this date: $Jour, verif code:$verif ",
"From: $email 
Reply-To: $email"); 
// copie a l'expediteur 
mail("$email","Copy of your message sent from the website PmWiki","** Name:   $name\n\n** Message: \n\n$message \n\n\n\n-------------------------------------------------------------------------------- \nfrom IP address: $_SERVER[REMOTE_ADDR], at this date: $Jour ",
"From: $email 
Reply-To: $email"); 
echo "Your message should have been sent correctly.<br/><br/>";
echo "A copy has been sent to $email. <br/><br/>";
echo '<br/><a href="index.php">Index</a>';

}

?>
</body></html>
