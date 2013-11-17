<?php
/*
 * Upload plugin for LionWiki, (c) Adam Zivner and WiKiss programmers
 *
 * Accessible through index.php?action=upload
 *
 * Based on WiKiss 0.4svn
 */

class Upload
{
	var $desc = array(
		array("Upload plugin", ".")
	);

	var $version = "1.0";

	var $datadir;

	var $blacklist = array(".php", ".phtml", ".php3", ".php4", ".js", ".shtml", ".pl" ,".py", ".asp", ".jsp", ".sh", ".cgi", ".htaccess"); // forbidden file extensions

	// permissions of uploaded files and directories. Leading zeroes are necessary!
	var $chmod_dir = 0755;
	var $chmod_file = 0644;

	function Upload()
	{
		global $VAR_DIR, $self;

		$this->datadir = $VAR_DIR . "upload/";

		if(!file_exists($this->datadir))
			mkdir(rtrim($this->datadir, "/"), 0777);

		$this->localize();

		$this->desc = array(
			array("<a href=\"$self?action=upload\" rel=\"nofollow\">Upload plugin</a>", "provides uploading files to the server.")
		);
	}

	function action($action)
	{
		global $CON, $TITLE, $editable, $T_PASSWORD, $T_WRONG_PASSWORD, $error;

		if($action == "upload") {
			$CON = "";

			$TITLE = $this->TP_FILE_UPLOAD;

			if(is_dir($this->datadir)) {
				$rel_dir = ltrim(clear_path($_REQUEST['curdir']), "/");
				$abs_dir = $this->datadir . $rel_dir;

				if(authentified()) {
					if(!empty($_POST['dir2create']))
						@mkdir($abs_dir . '/' . clear_path($_POST['dir2create']), $this->chmod_dir);
					elseif(!empty($_FILES['file']['tmp_name'])) { // anything to upload?
						if(is_uploaded_file($_FILES['file']['tmp_name'])) {
							$filename = clear_path($_FILES['file']['name']);

							foreach($this->blacklist as $file) // executable files not allowed
								if(preg_match("/" . preg_quote($file) . "/i", $filename)) {
									$error .= $this->TP_NO_EXECUTABLE;

									break;
								}

							if(empty($error)) {
								@move_uploaded_file($_FILES['file']['tmp_name'], $abs_dir . '/' . $filename);
								@chmod($abs_dir . '/' . $filename, $this->chmod_file);
							}
						}
					} elseif($_FILES['file']['error'] != UPLOAD_ERR_OK)
						$error = "$this->TP_ERROR_UPLOADING ($_FILES[file][error])";

					if(isset($_GET['del'])) { // delete file/directory
						$file = clear_path($_GET['del']);

						$ret = is_dir($this->datadir . $file) ? @rmdir($this->datadir . $file) : @unlink($this->datadir . $file);
					}
				} elseif($_SERVER['REQUEST_METHOD'] == 'POST')
					$error = $T_WRONG_PASSWORD;

				// list of files
				if($opening_dir = @opendir($abs_dir)) {
					$CON .= '<h2>' . $this->TP_DIRECTORY . " " . $rel_dir . '</h2><table id="fileTable" style="min-width : 600px;"><col span="2" style="color : red;" /><col /><col style="text-align : right;" /><col style="text-align : center;" /><tr><th>' . $this->TP_FILE_NAME . '</th><th>' . $this->TP_FILE_TYPE . '</th><th>' . $this->TP_FILE_SIZE . '</th><th>' . $this->TP_DELETE . '</th></tr>';

					$files = array();

					while($filename = @readdir($opening_dir)) // do not add link to parent of data_dir
						if(strcasecmp($filename, '.htaccess') && $filename != '.' && ($filename != '..' || $rel_dir != ""))
							$files[] = array($filename, is_dir($abs_dir . "/" . $filename));


					function cmp_files($a, $b) // sort directories first, then files.
					{
						if($a[1] == $b[1])
							return strcmp($a[0], $b[0]) < 0 ? -1 : 1;
						else
							return $b[1];
					}

					if($files)
						usort($files, "cmp_files");

					foreach($files as $file) {
						if($file[0] == '..')
							$path = substr($rel_dir, 0, strrpos($rel_dir, '/'));
						else
							$path = (empty($rel_dir) ? '' : $rel_dir . '/') . $file[0];

						$CON .= "<tr>";

						if(is_dir($this->datadir . $path))
							$CON = $CON . '<td><a href="'.$self.'?action=' . $action . '&curdir=' . u($path) . '">[' . $file[0] . ']</a></td><td>' . $this->TP_DIRECTORY . '</td><td>-</td>';
						else
							$CON = $CON . '<td><a href="' . $this->datadir . $path . '">' . $file[0] . '</a></td><td>' . $this->TP_FILE . '</td><td>' . @number_format(@filesize($this->datadir . $path), 0, ".", " ") . ' B</td>';

						if((authentified()) && ($file[0] != '..'))
							$CON .= '<td><a title="delete" href="'.$self.'?action=upload&del=' . u($path) . "&curdir=" . u($rel_dir) . '">&times;</a></td>';
						else
							$CON .= "<td>&nbsp;</td>";

						$CON .= "</tr>\n";
					}

					$CON .= "</table>";
				}

				$CON .= '
	<h2>Upload</h2>

	<div id="upload-form">
	  <form method="post" action="'.$self.'?action=' . $action . '" enctype= "multipart/form-data">
	  <input type="hidden" name="curdir" value="' . $rel_dir . '" />
	';
				$CON .= "$this->TP_FILE: <input type=\"file\" name=\"file\" />\n";

				if(!authentified())
					$CON .= "$T_PASSWORD: <input type=\"password\" name=\"sc\" />\n";

				$CON .= "<input type=\"submit\" value=\"$this->TP_UPLOAD\" />";

				$CON .= "</form>";

				$CON .= "<p><em>$this->TP_MAXIMUM_SIZE_IS " . ini_get('upload_max_filesize') . "</em></p>";

				$CON .= '
		<form method="post" action="'.$self.'?action=' . $action . '" enctype= "multipart/form-data">
	  <input type="hidden" name="curdir" value="' . $rel_dir . '" />';

				$CON .= "$this->TP_CREATE_DIRECTORY: <input type=\"text\" name=\"dir2create\" />\n";

				if(!authentified())
					$CON .= "$T_PASSWORD: <input type=\"password\" name=\"sc\" />\n";

				$CON .= "<input type=\"submit\" value=\"$this->TP_CREATE\" />";

				$CON .= "</form></div>";

			} else
				$CON = "<div class=\"error\">$this->TP_NO_DATA_DIR ($this->datadir).</div>";

			return true;
		}

		return false;
	}

	function template()
	{
		global $html;

		$html = template_replace("plugin:UPLOAD", "<a href=\"$self?action=upload\" rel=\"nofollow\">Upload</a>", $html);
	}

	// Localization strings

	var $cs_strings = array(
		array("TP_FILE_UPLOAD", "Upload souborů"),
		array("TP_FILE_NAME", "Jméno souboru"),
		array("TP_FILE_TYPE", "Typ souboru"),
		array("TP_FILE_SIZE", "Velikost"),
		array("TP_DELETE", "Smazat"),
		array("TP_ERROR_UPLOADING", "Nastala chyba při uploadu souboru"),
		array("TP_FILE", "Soubor"),
		array("TP_DIRECTORY", "Adresář"),
		array("TP_CREATE_DIRECTORY", "Vytvořit adresář"),
		array("TP_CREATE", "Vytvořit"),
		array("TP_UPLOAD", "Nahrát"),
		array("TP_MAXIMUM_SIZE_IS", "Maximální velikost souboru je"),
		array("TP_NO_DATA_DIR", "Adresář pro data neexistuje"),
		array("TP_NO_EXECUTABLE", "Uploadování spustitelných souborů je zakázané.")
	);


	var $en_strings = array(
		array("TP_FILE_UPLOAD", "File upload"),
		array("TP_FILE_NAME", "File name"),
		array("TP_FILE_TYPE", "Type"),
		array("TP_FILE_SIZE", "Size"),
		array("TP_DELETE", "Delete"),
		array("TP_ERROR_UPLOADING", "Error ocurred during uploading file"),
		array("TP_FILE", "File"),
		array("TP_DIRECTORY", "Directory"),
		array("TP_CREATE_DIRECTORY", "Create directory"),
		array("TP_CREATE", "Create"),
		array("TP_UPLOAD", "Upload"),
		array("TP_MAXIMUM_SIZE_IS", "Maximum size of uploaded file is"),
		array("TP_NO_DATA_DIR", "Data directory doesn't exist"),
		array("TP_NO_EXECUTABLE", "Upload of executable files is not permitted.")
	);

	var $eo_strings = array(
		array('TP_FILE_UPLOAD', 'Alŝuti dosierojn'),
		array('TP_FILE_NAME', 'Dosier-nomo'),
		array('TP_FILE_TYPE', 'Speco'),
		array('TP_FILE_SIZE', 'Grando'),
		array('TP_DELETE', 'Forviŝi'),
		array('TP_ERROR_UPLOADING', 'Okazis eraro dum la dosier-alŝuto.'),
		array('TP_FILE', 'Dosiero'),
		array('TP_DIRECTORY', 'Dosierujo'),
		array('TP_CREATE_DIRECTORY', 'Krei dosierujon'),
		array('TP_CREATE', 'Krei'),
		array('TP_UPLOAD', 'Alŝuti'),
		array('TP_MAXIMUM_SIZE_IS', 'La maksimuma grando por alŝuteblaj dosieroj estas'),
		array('TP_NO_DATA_DIR', 'La dosierujo ne ekzistas.'),
		array('TP_NO_EXECUTABLE', 'Estas malpermesite alŝuti programajn dosierojn.')
	);

	var $es_strings = array(
		array('TP_FILE_UPLOAD', 'Subir ficheros'),
		array('TP_FILE_NAME', 'Nombre'),
		array('TP_FILE_TYPE', 'Tipo'),
		array('TP_FILE_SIZE', 'Tamaño'),
		array('TP_DELETE', 'Borrar'),
		array('TP_ERROR_UPLOADING', 'Ocurrió un error durante la subida del fichero.'),
		array('TP_FILE', 'Fichero'),
		array('TP_DIRECTORY', 'Directorio'),
		array('TP_CREATE_DIRECTORY', 'Crear directorio'),
		array('TP_CREATE', 'Crear'),
		array('TP_UPLOAD', 'Subir'),
		array('TP_MAXIMUM_SIZE_IS', 'El tamaño máximo permitido para cada fichero es'),
		array('TP_NO_DATA_DIR', 'El directorio de ficheros no existe.'),
		array('TP_NO_EXECUTABLE', 'No está permitido subir ficheros ejecutables.')
	);

	var $fr_strings = array(
		array("TP_FILE_UPLOAD", "File upload"),
		array("TP_FILE_NAME", "Nom du fichier/dossier"),
		array("TP_FILE_TYPE", "Type"),
		array("TP_FILE_SIZE", "Taille"),
		array("TP_DELETE", "Supprimer"),
		array("TP_ERROR_UPLOADING", "Une erreur a empêché le téléversement du fichier"),
		array("TP_FILE", "Fichier"),
		array("TP_DIRECTORY", "Dossier"),
		array("TP_CREATE_DIRECTORY", "Créer un dossier"),
		array("TP_UPLOAD", "Upload"),
		array("TP_MAXIMUM_SIZE_IS", "Si vous avez besoin d'un dossier dans lequel vous voulez déposer un fichier, vous devez d'abord créer le dossier dans un premier temps puis téléverser le fichier.<br />La taille maximum à utiliser pour un fichier transféré est de"),
		array("TP_NO_DATA_DIR", "Cet élément n'existe pas"),
		array("TP_NO_EXECUTABLE", "Le téléversement de fichiers éxécutables n'est pas autorisé.")
	);

	function localize()
	{
		global $LANG;

		foreach($this->en_strings as $str)
			$this->$str[0] = $str[1];

		if($LANG != "en" && isset($this->{$LANG . "_strings"}))
			foreach($this->{$LANG . "_strings"} as $str)
				$this->$str[0] = $str[1];
	}
}
