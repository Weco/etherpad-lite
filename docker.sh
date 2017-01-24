TAG="latest"

if [ ! -z "$2" ]
then
    TAG="$2"
fi

case "$1" in

"init")
    docker create --name wikineering-db-data postgres:9.5 /bin/true
;;

"build")
    docker build --rm -t open/wikineering-server .
;;

"run")
    docker stop wikineering-server
    docker rm wikineering-server
    docker run --name wikineering-server -d -p 9002:9001 -e NODE_ENV=production --link wikineering-db-server:postgres --link wikineering-redis:redis --restart=always open/wikineering-server:$TAG
;;

"enter")
    docker exec -i -t wikineering-server /bin/bash
;;

"logs")
	docker exec -i wikineering-server bash -c "cat /opt/etherpad/etherpad.out.log"
;;

"db")
    docker stop wikineering-db-server
    docker rm wikineering-db-server
    docker run --name wikineering-db-server -d --volumes-from wikineering-db-data -v /var/lib/postgresql/data --restart=always postgres:9.5
;;

"migrate")
    docker exec -i wikineering-server bash -c "cd /opt/etherpad/plugins/ep_open && npm run migrate"
;;

"psql")
    docker run -it --rm --link wikineering-db-server:postgres postgres psql -h postgres -U postgres
;;

"redis")
    docker stop wikineering-redis
    docker rm wikineering-redis
    docker run --name wikineering-redis -d --restart=always redis
;;

"backup")
    docker run --rm --volumes-from wikineering-db-data -v $(pwd)/backups:/backups busybox tar cvf /backups/backup_$(date +"%Y-%m-%dT%H-%M-%S").tar /var/lib/postgresql/data
;;

"restore")
    BACKUP_FILE="$2"

    if [ -z "$2" ]
    then
       BACKUP_FILE="$(ls -t backups | head -n 1)"
       echo "Backup file: $BACKUP_FILE"
    fi
    docker stop wikineering-db-server
    docker run --rm --volumes-from wikineering-db-data -v $(pwd)/backups:/backups busybox tar xvf /backups/$BACKUP_FILE
    docker start wikineering-db-server
;;

"clear")
    docker rmi $(docker images | grep "^<none>" | awk '{print $3}')
;;

esac