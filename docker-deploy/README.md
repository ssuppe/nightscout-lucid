# Deploying Nightscout Lucid with Docker

## Prerequisites

- Docker / [Docker Desktop](https://docs.docker.com/) installed with commandline access

- **Dockerfile**

  Used to build the Nightscout Lucid docker image

- **docker-compose.yml**

  Docker compose file for building and running the docker container

- **nightscout-lucid.env**

  Applications environment varaible defintions

- **Caddyfile.prod**
  Application Cadyfile production file (copy from main github reporsitory)

## Use:

Update the following files for your use:

 - **nightscout-lucid.env** (environemnt parameters)

    ```
    NURSE_ACCESS_CODE=test
    NURSE_NIGHTSCOUT_URL=http://192.168.1.32:1337
    NURSE_NIGHTSCOUT_TOKEN=glucocheck-7d07fd946841cf35
    ```
- **docker-compose.yml**

Adapt the image reference to either a local image or (optional) an image in your docker image repsoitory, for instance in your docker repository at httos://hub.docker.com.

# Building the docker image image

1. Make sure Docker is installed on your system. From the commandline try running `docker system`

2. Clone this repository and build the image

    ```
    git clone https://github.com/ssuppe/nightscout-lucid
    ```

    Optonally, update the local version of `Cadyfile.prod` with a more resent version from the the repository:
    ```
    cd docker-deploy
    cp ../Cadyfile.prod .
    ```


3. Build the image

    ```
    cd nighscout-lucid/ docker-deploy
    docker compose build --no-cache
    ```

    Any build errors will show her.

4. Test the application

    ```
    docker compose up -d    
    ```
    Then open your browser at http://localhost:8120/

5. *Optional*: Push the image to your docker image repository

    Make sure the docker-compose.yml image is referencing the image in your docker repository. Example:
    ```
    image: 'myreponame/nightscout-lucid:latest'
    ```

    To push the repo:
    ```
    docker compose push
    ```
    
    Note:
    You will need to login docker for this.

Remark:
By default this wil build a docker image based on your build envrionment's hardware platform. So for instance when building the docker image on Intel harware (x86-64) the resulting docker container image runs on a MacBook Pro (x86-64) but does not run a the MacBook Air (AMD64).

**Remarks:**
```
pull_policy: if_not_present
```
On startup docker compose with first search for the docker image referenced. If the image referenced is not local it will automatically downoaded.

If the image referenced can not be found docker compose will try to build it. This will fail when this docker-deploy directory is not part of the local nightscout-lcuid git repository cloned.

For testing you can remove the local docker image using:

```
docker images
docker rmi <imageID>
```

# Stand-alone depoyment

To deploy the application, copy the 'docker-deply' directory to your hosting device. This could any device supporting Docker. For example a Synology NAS, a Raspberry Pi, Windows/WSL2+Ubuntu, a VM running locally or in the cloud or a hosting provider supporting Docker compose deployments.

##Installation:

1. Push the docker image to your docker image repository (e.g. Docker Hub)
2. Copy the `docker-deply` directory to the hosting device
3. Check the `image:` referece in the docker-compose.yml
4. Change "nurse" ENV variable defeintions in `nightscout-lucid.env` to your needs
5. Optional: Log in to docker with your Docker account (`docker login`)

With the above you should be able to start the approcation container using the docker CLI command `docker compose up -d`

Withe above the application is available at http://localhost:8120.
From there, configure you hosting device to make the application available on your network.

## Debug en testing tips

1. Run the container from the commandline without detaching by leaving out the '-d' argument. This ables you to trace the running containers serial output. Any startup errors will also show here.

    ```
    # CLI command:
    docker compose
    ```


2. Login to a running docker container.
    ```
    # CLI command:
    docker exec -it /bin/bash
    ```
   This will get you at the internal bash prompt of the running container instance. 


## Related

- [Docker Desktop](https://docs.docker.com/)  -> Install Docker

- [Docker Hub](https://hub.docker.com/)       -> Deploy docker image to the Docker hub repository
