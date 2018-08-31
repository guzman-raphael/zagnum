# Sample Implementation - PEPN (Postgres, Express, Polymer, Node)

## Clean everything
docker stop $(docker ps -a -q) && docker system prune -fa

## Create a Network
docker network ls
docker network create -d bridge main-bridge

## Remove a Network
docker network rm [name]

## First build
docker network create -d bridge main-bridge && docker build -t app_dev_image:v8.11.1 . && docker run -v ~/Documents/dev/app-sample/src:/app/src --name be_con -h backend -d=true app_dev_image:v8.11.1 && docker network connect --alias backend main-bridge be_con

docker run -v ~/Documents/dev/app-sample/src:/app/src --name client_con -h client -d=true app_dev_image:v8.11.1 && docker network connect --alias client main-bridge client_con

## Restart container_name (take dev changes for node)
docker restart be_con

## Update container (need to install new packages)
docker stop be_con && docker rm be_con && docker rmi app_dev_image:v8.11.1 && docker build -t app_dev_image:v8.11.1 . && docker run -v ~/Documents/dev/app-sample/src:/app/src --name be_con -d=true app_dev_image:v8.11.1


## sh into app_con
docker exec -it --user node be_con /bin/sh

## test endpoint

http://backend:8080/

## debug endpoint

http://backend:9229/
