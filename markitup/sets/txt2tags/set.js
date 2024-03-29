// -------------------------------------------------------------------
// markItUp!
// -------------------------------------------------------------------
// Copyright (C) 2009 Florent Gallaire <fgallaire@gmail.com>  
// Copyright (C) 2021 Eric Forgeot  
// License GNU GPLv3 or any later version.
// Copyright (C) 2008-2018 Jay Salvat
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
		{name:'Heading 1', key:'1', openWith:'= ', closeWith:' =', placeHolder:'Your title here...' },
		{name:'Heading 2', key:'2', openWith:'== ', closeWith:' ==', placeHolder:'Your title here...' },
		{name:'Heading 3', key:'3', openWith:'=== ', closeWith:' ===', placeHolder:'Your title here...' },
		{name:'Heading 4', key:'4', openWith:'==== ', closeWith:' ====', placeHolder:'Your title here...' },
		{name:'Heading 5', key:'5', openWith:'===== ', closeWith:' =====', placeHolder:'Your title here...' },
		{separator:' ' },		
		{name:'Bold', key:'B', openWith:'**', closeWith:'**'}, 
		{name:'Italic', key:'I', openWith:'//', closeWith:'//'}, 
		{name:'Underline', key:'U', openWith:'__', closeWith:'__'}, 
		{name:'Strike', key:'S', openWith:'--', closeWith:'--'}, 
		{separator:' ' },
		{name:'Clear formatting marks', openWith:''},
		{separator:' ' },
		{name:'Bulleted list', openWith:'- '},
		{name:'Numeric list', openWith:'+ '},
		{name:'Table'},
		{separator:' ' },
		{name:'Picture', key:'P', openWith:'[', closeWith:'[![Your picture name or URL:!:http://]!]]', placeHolder:''},
		{name:'Document', openWith:'[', closeWith:']', placeHolder:'Your text to document here...'},
		{name:'LocalLink', openWith:'[[[![Description:!:Description]!]', closeWith:'[![LocalLink:!:LocalLink]!]]]', placeHolder:' | '},
		{name:'Link', key:'L', openWith:'[[![Description:!:Description]!]', closeWith:' [![Link:!:http://]!]]', placeHolder:''},
		{separator:' '},	
		{name:'Quote', openWith:'\t'},
		{name:'Code', openWith:'``', closeWith:'``'},
		{name:'Raw', key:'R', openWith:'""', closeWith:'""', placeHolder:'No txt2tags in here!'},
//		{name:'Date', key:'D', openWith:'===', closeWith:'===', placeHolder:' 202x-00-00 '},			
		//{separator:'---------------' },
		//{name:'Preview', call:'preview', className:'preview'}
		{	name:'Date of the Day', 
			className:"dateoftheday", 
			replaceWith:function(h) { 
				var date = getDate();
				return date;
			}
		}
	]
}


function getDate()
{
var today = new Date();
var dd = String(today.getDate()).padStart(2, '0');
var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
var yyyy = today.getFullYear();

today = '=== ' + yyyy + '-' + mm + '-' + dd + ' ===';
	
	return today;
	
}