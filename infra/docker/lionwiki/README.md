




# lionwiki-t2t-docker
Simple to use and highly versatile open-source wiki... conveniently packaged as a container image

> This Dockerfile contains a streamlined and not blown-up approach to run a dockerized version of lionwiki-t2t. 
> It's based on the php:7.x-apache image which ships with apache and php7 right out of the box.

## How-to use

You can use the Makefile to start some conveniant commands.

Install docker.io and add yourself to the docker group:

`sudo apt install docker.io docker-compose`

`sudo usermod -aG docker $USER`



Get the code (you might need to install mercurial to get the `hg` command to clone the repository):


`hg clone http://hg.code.sf.net/p/lionwiki-t2t/code lionwiki-t2t-code`

`cd lionwiki-t2t-code/infra/docker/lionwiki`


Then run `make run` to set it up. It will use docker-compose and website will be available at http://localhost:11080/ or at https://localhost:11443/ (using a self-certificate). 


If you are running this from a VPS, use your IP instead of localhost.


To enter the shell, type `make shell` and you'll enter the Docker container.

They will also be persistent on the server, into /var/lib/docker/volumes/lionwiki_lionwiki_data



You can have more control on the output though:


### Dockerfile

Type 

> docker build -t lionwiki .

to create the image.

Type 

> docker run -d -p 8080:80 --name lionwiki  lionwiki

to run the image and access it at http://localhost:8080 from a web browser.

Beware, if you make some modifications to the wiki, the data won't be persistent.


### docker-compose


**Start the Service with**

`docker-compose up -d lionwiki`

It will be accessible at http://localhost:11080 from a web browser.

Type `docker volume inspect lionwiki_lionwiki_data` to see the location of the persistent data (usually /var/lib/docker/volumes/lionwiki_lionwiki_data/_data)

**Stop the Service via**

`docker-compose down`


### Using with Coolify

Create a new ressource > docker based > Dockerfile
copy the Dockerfile from /infra/docker/lionwiki
save
deploy


# Credit

This was inspired by https://github.com/nevotheless/dokuwiki-docker


# Licence

MIT License

Copyright (c) 2020-2021 

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


# more info

https://www.docker.com/blog/simplifying-kubernetes-with-docker-compose-and-friends/

https://devopssec.fr/article/gerez-vos-conteneurs-docker-compose

portainer.io

--------------

## Troubleshooting

listen tcp 0.0.0.0:10443: bind: address already in use

sudo netstat -ntulp | grep 10443


curl https://sourceforge.net/p/lionwiki-t2t/code/ci/default/tree/config.t2t?format=raw > config.t2t 




kompose convert
INFO Kubernetes file "lionwiki-service.yaml" created 
INFO Kubernetes file "lionwiki-deployment.yaml" created 
INFO Kubernetes file "data-persistentvolumeclaim.yaml" created 
