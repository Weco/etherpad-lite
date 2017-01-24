# Installation

1. Install and launch PostgresDB and Redis
2. Create credentials.json file in the root of project with further settings:

  ```json
  {
    "dbType": "postgres",
    "dbSettings": {
      "user": "postgres",
      "host": "postgres",
      "password": "mysecretpassword",
      "database": "postgres"
    },
    "redisSettings": {
      "host": "redis",
      "port": 6379
    },
    "users": {
      "github": {
        "clientId": "65f12998d7e051ea0a2f",
        "clientSecret": "452d2a735d416a1f6af1ee80b
  e08ed5d674cb7dd"
      },
      "google": {
        "clientId": "765602845305-v8k5ibtj76qvtr77
  qjnkae8itiq1etth.apps.googleusercontent.com",
        "clientSecret": "RbuRb_kzKbiVwewL48Q9G8IE"
      },
      "admin": {
        "password": "Etherpass",
        "is_admin": true
      }
    }
  }
  ```

3. To be able use oAuth on the local dev server, you should use `open.dev` host
4. Run `bin/run.sh`
5. App should be available on http://open.dev:9001


# Development

Project is built on top of [Etherpad](https://github.com/ether/etherpad-lite) project and uses its [plugin](https://github.com/Weco/etherpad-lite/blob/develop/doc/plugins.md) system for extension. The main extension plugin is located in `plugins/ep_open`, it attaches separate API/static server to Etherpad's express instance. So basically the project has 2 levels:

**Top level**, separate API and static server (from ep_open) with its own db structure and React/Baobab client app. When you open browser you use this part of app, it's responsible for authorization, access control, navigation, creation and manipulation with pads, etc.

**Etherpad level**, original Etherpad app, it's used only for rendering of pad's editor and time slider through an iframe from the top level client app.

So if you need to add some new feature out of editor, you use top level, if you need to add some feature to editor, you are trying to use Etherpad plugins for that, if it's not possible to do using plugins, do the changes right in the Etherpad core code.

Top level [API](https://github.com/Weco/etherpad-lite/tree/develop/plugins/ep_open/api) is quite simple, for models it uses sequelize ORM, all API related code is located in controllers folder, for async operations it uses generators with coroutines.

For building of React app we use gulp, you can check it config [file](https://github.com/Weco/etherpad-lite/blob/develop/plugins/ep_open/gulpfile.js) for more details.

# Deployment

We use docker for deployment, since we don't have CI, we do build of images right on the server. [Here](https://console.cloud.google.com/compute/instancesDetail/zones/europe-west1-c/instances/open?project=cool-plasma-778&graph=GCE_CPU&duration=PT1H) is the current server. Right now we have 4 different apps on top of this project and each of them use individual branch for building:

| Host | Branch | Server path |
| --- | --- | --- |
| http://pad.open.xyz | develop | `/var/etherpad` |
| http://beta.wikineering.org | wikineering | `/var/wikineering` |
| http://beta.open.ai | openai | `/var/open_ai` |
| http://guy.open.ai | guy | `/var/guy_etherpad` |

For more convenient work with docker we have script file [docker.sh](https://github.com/Weco/etherpad-lite/blob/develop/docker.sh)

So the basic workflow looks so:

1. You do some changes in the project and commit them to needed branch
2. Go to the server to project folder
3. Do `git pull` to fetch updates
4. If you do initial build, you need create and run PostgreSQL and Redis containers:

    ```
    sh docker.sh init
    sh docker.sh db
    sh docker.sh redis
    ```
5. Run `sh docker.sh build` to build new project image
6. Run `sh docker.sh run` to run new project image
7. Run `sh docker.sh migrate` if you did some migrations in this update

