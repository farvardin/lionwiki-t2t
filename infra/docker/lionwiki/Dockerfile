## Dockerfile for lionwiki-t2t

#FROM debian:stable-slim
#FROM php:7.4-apache-buster
#FROM php:8.2.26-zts-alpine
FROM php:8.2-apache-bookworm
#FROM php:8.2-apache-bullseye
#FROM php:7.4-apache-bullseye

ENV DEBIAN_FRONTEND=noninteractive

SHELL ["/bin/bash", "-c"]
#SHELL ["/bin/sh", "-c"]

## image metadata
LABEL version="1.0" maintainer="farvardin"

## temporary variables
ARG DOCUMENTROOT="/var/www/html"

# switch to alpine one day?
#RUN apk update
#RUN apk upgrade
#RUN apk --no-cache add bash
#RUN apk --no-cache add curl
#RUN apk --no-cache add zip

## download source
# doesn't work: wget "https://sourceforge.net/projects/lionwiki-t2t/files/latest/download" -O lionwiki-t2t.zip
# RUN curl -L https://sourceforge.net/projects/lionwiki-t2t/files/latest/download > lionwiki-t2t.zip
RUN curl -L https://github.com/farvardin/lionwiki-t2t/archive/refs/heads/master.zip > lionwiki-t2t.zip


## install additional packages
RUN apt-get update  && apt install -y less unzip nano node-less


# Extract the files to the actual webserver folder

RUN unzip lionwiki-t2t.zip 

# for github instead of sourceforge
RUN mv lionwiki-t2t-master lionwiki-t2t

RUN cp -fr lionwiki-t2t/* /var/www/html/ 

RUN cd /var/www/html/ \
    && find . -type d -exec chmod 755 {} \; \
    && find . -type f -exec chmod 644 {} \; \
    && chown -R www-data:www-data .


# add more files to the project
#COPY test.html /var/www/html/

#RUN rm -fr /var/www/html/lionwiki-t2t/plugins/wkp_Upload.php
#RUN rm -fr /var/www/html/lionwiki-t2t/plugins/wkp_BetterEditor.php
RUN cp /usr/local/etc/php/php.ini-production /usr/local/etc/php/php.ini

# Opening HTTP(s) ports
EXPOSE 80
EXPOSE 443


#Create self certificat 
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout /etc/ssl/private/ssl-cert-snakeoil.key \     
     -out /etc/ssl/certs/ssl-cert-snakeoil.pem \     
     -subj "/C=AT/ST=Farvardin/L=Farvardin/O=Dev/OU=Development/CN=localhost"

#Enable SSL
RUN a2enmod rewrite 
RUN a2ensite default-ssl 
RUN a2enmod ssl


# workspace

# WORKDIR ${DOCUMENTROOT}


# starting 





#ENTRYPOINT service apache start && apache2ctl -D FOREGROUND


