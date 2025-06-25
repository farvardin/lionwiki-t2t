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
#THEME=the-monospace-web
THEME=minimaxing_linktree


### Files locations ###

## all in the same place ?

SAME=1

if [ ${SAME} == 0 ] ; then
printf "normal generation\n" 
	
## Choose the folder for sources (it will build the static site from this folder)
#LOCATION=pages
LOCATION=`pwd`/../minisite

# STATIC = the folder from which this script is run
STATIC=`pwd`/

## Config files
# static adjustement
CONFIGFILE01=`pwd`/../static/config_static.t2t
# main txt2tags config file
CONFIGFILE02=`pwd`/../../config.t2t

## Lionwiki upload folder 
UPLOAD=`pwd`/../upload/

## Output folder 
OUTPUT=`pwd`/../static/output/

else

printf "custom generation\n"

## Choose the folder from for sources (it will build the static site from this folder)
#LOCATION=pages
LOCATION=`pwd`/src
#LOCATION=`pwd`/../minisite

# STATIC = the folder from which this script is run
STATIC=`pwd`/

## Config files
# static adjustement
CONFIGFILE01=`pwd`/tools/config_static.t2t
# main txt2tags config file
CONFIGFILE02=`pwd`/tools/config.t2t


## Lionwiki upload folder 
UPLOAD=`pwd`/upload/

## Output folder 
OUTPUT=`pwd`/output/

fi


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
		${TXT2TAGS} -T ${STATIC}/${THEME}_static.html -t html --config-file ${CONFIGFILE01}  --config-file ${CONFIGFILE02} --css-inside  ${TOC} --outfile ${OUTPUT}/"${FILENAME%.*}".html /tmp/lionwikistatic.t2t ; \
		printf "* [${FILENAME%.*} ${FILENAME%.*}.html] \n" >> /tmp/lionwikipagelist.t2t
}

generate_all() {

	if [ ! -d ${OUTPUT}/ ]; then mkdir -p ${OUTPUT}/ ; fi
	
	printf "${SITENAME}\n" >  /tmp/lionwikipagelist.t2t
	printf "Pages List\n\n\n" >> /tmp/lionwikipagelist.t2t


	cd ${LOCATION}/
	for FILENAME in *.txt *.t2t *.gmi ; do     # TODO : select only available extension
		generation ; done

	cd ${STATIC}/

	${TXT2TAGS} -T ${STATIC}/${THEME}_static.html -t html --config-file ${CONFIGFILE01}  --config-file ${CONFIGFILE02} --css-inside ${TOC} --outfile ./output/pagelist.html /tmp/lionwikipagelist.t2t 

	cp ${THEME}.css ./output/

	mkdir -p ${OUTPUT}/var/upload/
	cp -fr ${UPLOAD}/* ./output/var/upload/
	
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
	cd ${LOCATION}/
		for FILENAME in ${FILE} ; do 
			generation ; 	done
		
}

		
generate_single0() {
	cd ../${LOCATION}/
		printf "${FILE%.*}" > /tmp/lionwikistatic.t2t
		printf "\n\n\n" >> /tmp/lionwikistatic.t2t 
		cat "${FILE}" >>  /tmp/lionwikistatic.t2t 
		txt2tags -T ../static/${THEME}_static.html -t html --config-file ${CONFIGFILE01}  --config-file ${CONFIGFILE02} --css-inside  ${TOC} --outfile ../static/output/"${FILE%.*}".html /tmp/lionwikistatic.t2t 
		
}


prepare() {
	printf "prepare\n"
		if [ ! -d ./tools/ ] ; then
			mkdir ./tools/
		fi
	cp ../static/config_static.t2t ./tools/
	cp ../../config.t2t ./tools/
	cp ${TXT2TAGS} ./tools/
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
			if [ $1 == 'prepare' ]
				then
			prepare
		else
		if [ -f ${LOCATION}/$1 ]
			then
				FILE=$1
				generate_single
			else 
				printf "\n File doesn't exist, please choose another one\n\n"
			fi
		fi
		fi
fi



