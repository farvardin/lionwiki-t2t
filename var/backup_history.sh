
CURRENTDATE=`date +%Y-%m-%d`

zip -r history_${CURRENTDATE}.zip history

rm -fr history/*
