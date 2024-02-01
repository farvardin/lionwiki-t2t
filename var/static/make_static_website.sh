# #######################
# Lionwiki static version 
# #######################
#
# this script will generate a static version from your lionwiki website 
#  (/var/pages) into the output/ folder
#
# <!> It must be run from "your_lionwiki_root_folder/var/static/"
#
# You might need to fix a few link yourself (see html templates in this folder)
#  and adapt the lionwiki txt2tags pages to suit a static version.
#
# By default main.txt is the index so you might need to copy the resulting 
#  file main.html into index.html 
#

THEME=dandelion
THEME=cafe


if [ ! -d output ]; then mkdir output ; fi

printf "Page List\n\n" > /tmp/lionwikipagelist.t2t


cd ../pages/
for FILENAME in *.txt ; do 
	printf "${FILENAME%.*}" > /tmp/lionwikistatic.t2t
	printf "\n\n\n" >> /tmp/lionwikistatic.t2t ; \
	cat "${FILENAME%.*}.txt" >>  /tmp/lionwikistatic.t2t ; \
	txt2tags -T ../static/${THEME}_static.html -t html --config-file ../static/config_static.t2t  --config-file ../../config.t2t --css-inside  --toc --outfile ../static/output/"${FILENAME%.*}".html /tmp/lionwikistatic.t2t ; \

	printf "* [${FILENAME%.*} ${FILENAME%.*}.html] \n" >> /tmp/lionwikipagelist.t2t
	done

cd ../static/

txt2tags -T ${THEME}_static.html -t html --config-file config_static.t2t  --config-file ../../config.t2t --css-inside  --toc --outfile ./output/pagelist.html /tmp/lionwikipagelist.t2t 

cp ${THEME}.css ./output/

mkdir -p ./output/var/upload/
cp -fr ../upload/* ./output/var/upload/

printf "\n\nThe generated website is in output/ \n\n"