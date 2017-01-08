TAG="latest"

if [ ! -z "$2" ]
then
   TAG="$2"
fi

case "$1" in

"init")
    docker create --name openai-db-data postgres:9.5 /bin/true
;;

"build")
    docker build --rm -t open/openai-server .
;;

"run")
    docker stop openai-server
    docker rm openai-server
    docker run --name openai-server -d -p 9002:9001 -e NODE_ENV=production --link openai-db-server:postgres open/openai-server:$TAG
;;

"enter")
    docker exec -i -t openai-server /bin/bash
;;

"logs")
	docker exec -i openai-server bash -c "cat /opt/etherpad/etherpad.out.log"
;;

"db")
    docker stop openai-db-server
    docker rm openai-db-server
    docker run --name openai-db-server -d --volumes-from openai-db-data -v /var/lib/postgresql/data postgres:9.5
;;

"migrate")
    docker exec -i openai-server bash -c "cd /opt/etherpad/plugins/ep_open && npm run migrate"
;;

"psql")
    docker run -it --rm --link openai-db-server:postgres postgres psql -h postgres -U postgres
;;

"backup")
    docker run --rm --volumes-from openai-db-data -v $(pwd)/backups:/backups busybox tar cvf /backups/backup_$(date +"%Y-%m-%dT%H-%M-%S").tar /var/lib/postgresql/data
;;

"restore")
    BACKUP_FILE="$2"

    if [ -z "$2" ]
    then
       BACKUP_FILE="$(ls -t backups | head -n 1)"
       echo "Backup file: $BACKUP_FILE"
    fi
    docker stop openai-db-server
    docker run --rm --volumes-from openai-db-data -v $(pwd)/backups:/backups busybox tar xvf /backups/$BACKUP_FILE
    docker start openai-db-server
;;

"clear")
    docker rmi $(docker images | grep "^<none>" | awk '{print $3}')
;;

esac