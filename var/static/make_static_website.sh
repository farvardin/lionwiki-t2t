# #######################
# Lionwiki static version 
# #######################
#
# this script will generate a static version from your lionwiki website 
#  (/var/pages or whatever you choose) into the output/ folder
#
# <!> It must be run from "your_lionwiki_root_folder/var/static/"
#
# You might need to fix a few link yourself (see html templates in this folder)
#  and adapt the lionwiki txt2tags pages to suit a static version.
#
# By default main.txt is the index so you might need to copy the resulting 
#  file main.html into index.html 
#
#


## Choose site name (it will appear in the top header)
SITENAME="Lionwiki-t2t"

## Choose index page name (default first / home page)
INDEX=index

## Choose to use page name as second header (1) or use your own titles instead (0)
SUBHEADER=0

## Choose table of content (option 1) or not (option 2)
#TOC=--toc
TOC=""

## Choose your prefered theme:

THEME=dandelion
THEME=cafe
#THEME=simple
#THEME=mimoza
#THEME=ten


### Files locations ###

## all in the same place ?

SAME=0

if [ ${SAME} == 0 ] ; then
printf "test" 
	fi

## Choose the subfolder from lionwiki/var/ (it will build the static site from this folder)
#LOCATION=pages
LOCATION=minisite

## Config files
CONFIGFILE01=../static/config_static.t2t
CONFIGFILE02=../../config.t2t

## Output folder 
OUTPUT=../static/output/


## txt2tags version
TXT2TAGS=`pwd`/txt2tags

help() {
	printf "\nLionwiki static site generator "
	printf "\n---------------------- \n"
	printf "command line arguments: \n"
	printf "./make_static_website.sh all : generate all the .txt files from pages/ \n"
	printf "./make_static_website.sh file.txt : generate a single file.txt located into ${LOCATION} folder \n\n"
}

generation() {
printf "${SITENAME}\n" > /tmp/lionwikistatic.t2t
		if [ ${SUBHEADER} == 1 ]; then 
			printf "${FILENAME%.*}\n" >> /tmp/lionwikistatic.t2t
			fi
		printf "\n\n\n" >> /tmp/lionwikistatic.t2t ; \
		cat "${FILENAME}" >>  /tmp/lionwikistatic.t2t ; \
		${TXT2TAGS} -T ../static/${THEME}_static.html -t html --config-file ../static/config_static.t2t  --config-file ../../config.t2t --css-inside  ${TOC} --outfile ../static/output/"${FILENAME%.*}".html /tmp/lionwikistatic.t2t ; \
		printf "* [${FILENAME%.*} ${FILENAME%.*}.html] \n" >> /tmp/lionwikipagelist.t2t
}

generate_all() {

	if [ ! -d output ]; then mkdir output ; fi
	
	printf "${SITENAME}\n" >  /tmp/lionwikipagelist.t2t
	printf "Pages List\n\n\n" >> /tmp/lionwikipagelist.t2t


	cd ../${LOCATION}/
	for FILENAME in *.txt *.txt *.gmi ; do 
		generation ; done

	cd ../static/

	${TXT2TAGS} -T ${THEME}_static.html -t html --config-file config_static.t2t  --config-file ../../config.t2t --css-inside ${TOC} --outfile ./output/pagelist.html /tmp/lionwikipagelist.t2t 

	cp ${THEME}.css ./output/

	mkdir -p ./output/var/upload/
	cp -fr ../upload/* ./output/var/upload/
	
	cp ./output/${INDEX}.html ./output/index.html
	
	if [ ${THEME} == mimoza ]
		then
			printf "copying fonts"
			mkdir ${OUTPUT}/fonts/
			cp -fr ../../templates/fonts/Luciole* ${OUTPUT}/fonts/
			cp -fr ../../templates/fonts/Josefin* ${OUTPUT}/fonts/
		else
			printf "not copying fonts"
	fi

	printf "\n\nThe generated website is in output/ \n\n"

}



		
		
generate_single() {
	cd ../${LOCATION}/
		for FILENAME in ${FILE} ; do 
			generation ; 	done
		
}

		
generate_single0() {
	cd ../${LOCATION}/
		printf "${FILE%.*}" > /tmp/lionwikistatic.t2t
		printf "\n\n\n" >> /tmp/lionwikistatic.t2t 
		cat "${FILE}" >>  /tmp/lionwikistatic.t2t 
		txt2tags -T ../static/${THEME}_static.html -t html --config-file ../static/config_static.t2t  --config-file ../../config.t2t --css-inside  ${TOC} --outfile ../static/output/"${FILE%.*}".html /tmp/lionwikistatic.t2t 
		
}


if [ $# -eq 0 ]
then 
	help
fi


if [ $# -eq 1 ]
	then 
		if [ $1 == 'all' ]
			then
		generate_all
	 else
		if [ -f ../${LOCATION}/$1 ]
		then
			FILE=$1
			generate_single
		else 
			printf "\n File doesn't exist, please choose another one\n\n"
		fi
		fi
fi



