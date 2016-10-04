// -------------------------------------------------------------------
// markItUp!
// -------------------------------------------------------------------
// Copyright (C) 2009 Florent Gallaire <fgallaire@gmail.com>  
// License GNU GPLv3 or any later version.
// Copyright (C) 2008 Jay Salvat
// http://markitup.jaysalvat.com/
// -------------------------------------------------------------------
// Txt2tags tags example
// http://txt2tags.org/markup.html
// -------------------------------------------------------------------
// Feel free to add more tags
// -------------------------------------------------------------------
mySettings = {
	previewParserPath:	'', // path to your Txt2tags parser
	onShiftEnter:		{keepDefault:false, replaceWith:'\n\n'},
	markupSet: [
		{name:'Titre 1', key:'1', openWith:'= ', closeWith:' =', placeHolder:'Titre' },
		{name:'Titre 2', key:'2', openWith:'== ', closeWith:' ==', placeHolder:'Titre' },
		{name:'Titre 3', key:'3', openWith:'=== ', closeWith:' ===', placeHolder:'Titre' },
		{name:'Titre 4', key:'4', openWith:'==== ', closeWith:' ====', placeHolder:'Titre' },
		{name:'Titre 5', key:'5', openWith:'===== ', closeWith:' =====', placeHolder:'Titre' },
		{separator:' ' },		
		{name:'Gras', key:'B', openWith:'**', closeWith:'**'}, 
		{name:'Italique', key:'I', openWith:'//', closeWith:'//'}, 
		{name:'Souligné', key:'U', openWith:'__', closeWith:'__'}, 
		{name:'Barré', key:'S', openWith:'--', closeWith:'--'}, 
		{separator:' ' },
		{name:'Effacer', openWith:''},
		{separator:' ' },
		{name:'Liste à puces', openWith:'- '},
		{name:'Liste ordonnées', openWith:'+ '},
		{name:'Table'},
		{separator:' ' },
		{name:'Image', key:'P', openWith:'[', closeWith:']', placeHolder:'votre_image.jpg'},
		{name:'Document', openWith:'[', closeWith:']', placeHolder:'Votre document'},
		{name:'LienLocal', openWith:'[[[![Description:!:Description]!]', closeWith:'[![LienLocal:!:LienLocal]!]]]', placeHolder:' | '},
		{name:'Lien', key:'L', openWith:'[[![Description:!:Description]!]', closeWith:' [![Lien:!:http://]!]]', placeHolder:''},
		{separator:' '},	
		{name:'Citation', openWith:'\t'},
		{name:'Code', openWith:'``', closeWith:'``'},
		{name:'Raw', key:'R', openWith:'""', closeWith:'""', placeHolder:'Pas de code text2tags interprété ici'},		
		//{separator:'---------------' },
		//{name:'Preview', call:'preview', className:'preview'}
	]
}
