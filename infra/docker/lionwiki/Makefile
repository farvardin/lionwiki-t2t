PROJET = lionwiki


build:
	docker build -t ${PROJET} .
	

run:
	make build
	make composeup
	

run-volatile:
	docker run -d -p 80:80 --name ${PROJET}  ${PROJET}
	#docker run -d -p 8080:80 --name ${PROJET}  ${PROJET}
	#docker run -d -p 1443:443 --name ${PROJET}  ${PROJET}
	
run-it:	
	docker run -it ${PROJET}
	
	
run-local:
	#make build
	#mkdir -p $$HOME/lionwiki_t2t_data
	#docker run -v $$HOME/lionwiki_t2t_data:/var/www/html/var/pages -d -p 8080:80 --name lionwiki_t2t  lionwiki_t2t

listimages:
	docker images -a
	
listcontainers:
	docker ps -a
	#docker container ls -a
	
deleteimage:
	docker rmi ${PROJET}
	
deletecontainer:
	docker stop ${PROJET}
	docker rm ${PROJET}


removecontainer:
	docker ps -a
	echo "docker container rm ID"
	
prune:
	docker system prune -a
	
clean:
	make deletecontainer
	make deleteimage
	
shell:
	docker exec -ti ${PROJET}_${PROJET}_1 /bin/bash
	

shell-volatile:
	docker exec -ti ${PROJET} /bin/bash
	
	

doc:
	echo "voir https://devopssec.fr/article/creer-ses-propres-images-docker-dockerfile"
	
composeup:
	make build
	docker-compose up -d ${PROJET}
	
composedown:
	docker-compose down

inspect:
	docker volume inspect ${PROJET}_data
	#or lionwiki-t2t_docker_data

kubernetes:
	docker stack deploy --orchestrator=kubernetes -c docker-compose.yml ${PROJET}
	
	
