TAG="latest"

if [ ! -z "$2" ]
then
    TAG="$2"
fi

case "$1" in

"init")
    docker create --name guy-db-data postgres:9.5 /bin/true
;;

"build")
    docker build --rm -t open/guy-server .
;;

"run")
    docker stop guy-server
    docker rm guy-server
    docker run --name guy-server -d -p 9004:9001 -e NODE_ENV=production --link guy-db-server:postgres --link guy-redis:redis --restart=always open/guy-server:$TAG
;;

"enter")
    docker exec -i -t guy-server /bin/bash
;;

"logs")
	docker exec -i guy-server bash -c "cat /opt/etherpad/etherpad.out.log"
;;

"db")
    docker stop guy-db-server
    docker rm guy-db-server
    docker run --name guy-db-server -d --volumes-from guy-db-data -v /var/lib/postgresql/data --restart=always postgres:9.5
;;

"migrate")
    docker exec -i guy-server bash -c "cd /opt/etherpad/plugins/ep_open && npm run migrate"
;;

"psql")
    docker run -it --rm --link guy-db-server:postgres postgres psql -h postgres -U postgres
;;

"redis")
    docker stop guy-redis
    docker rm guy-redis
    docker run --name guy-redis -d --restart=always redis
;;

"backup")
    docker run --rm --volumes-from guy-db-data -v $(pwd)/backups:/backups busybox tar cvf /backups/backup_$(date +"%Y-%m-%dT%H-%M-%S").tar /var/lib/postgresql/data
;;

"restore")
    BACKUP_FILE="$2"

    if [ -z "$2" ]
    then
       BACKUP_FILE="$(ls -t backups | head -n 1)"
       echo "Backup file: $BACKUP_FILE"
    fi
    docker stop guy-db-server
    docker run --rm --volumes-from guy-db-data -v $(pwd)/backups:/backups busybox tar xvf /backups/$BACKUP_FILE
    docker start guy-db-server
;;

"clear")
    docker rmi $(docker images | grep "^<none>" | awk '{print $3}')
;;

esac